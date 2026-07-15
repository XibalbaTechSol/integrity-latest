// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IRouterClient} from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import {CCIPReceiver} from "@chainlink/contracts-ccip/contracts/applications/CCIPReceiver.sol";
import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ReputationRegistry} from "./ReputationRegistry.sol";
import {XibalbaAgentRegistry} from "../framework/XibalbaAgentRegistry.sol";

/// @title CCIPReputationBridge
/// @notice Synchronizes an agent's base AIS across chains via Chainlink CCIP, so a
/// reputation earned on the home chain is visible (not re-earned from scratch) on a
/// destination chain's ReputationRegistry deployment.
/// @dev Deliberately propagates only `baseScore`, never the ZK-boost state. A ZK boost
/// means "this chain independently verified a Barretenberg proof against a root this
/// chain anchored" (see ReputationRegistry.submitZkAttestation) — that is a locally
/// earned property of *this* StateAnchor/IZkVerifier deployment. Blindly trusting a
/// remote chain's claim that "the boost was active" would let a single compromised or
/// buggy verifier deployment on one chain inflate scores everywhere the bridge reaches.
/// If a destination chain wants the boost, the agent submits its own ZK attestation
/// there too, against that chain's own anchored state.
///
/// REWORKED 2026-07-11 for the per-agent EIP-1167 clone model: this contract used to
/// hold one immutable `ReputationRegistry` address, a leftover from before per-agent
/// clones existed (see AgentPrimitivesFactory / XibalbaAgentRegistry.PrimitiveSet).
/// `registry.getAgent(agent)`/`registry.updateScoreByBridge(agent, baseScore)` never
/// resolved to "the" registry for an arbitrary agent once every agent got its own
/// clone. Now holds `XibalbaAgentRegistry` instead and resolves each agent's own
/// `ReputationRegistry` clone via `agentRegistry.resolveAgent(agent).primitives.
/// reputationRegistry` on every call — the same resolution pattern already established
/// by `EHRGate`/`IntegrityMarket`/`A2ACapitalPool` (grep `resolveAgent(` in `src/` to
/// confirm this is the established idiom, not a new one invented for this fix).
///
/// One consequence of this fix, not present in the old single-registry design: this
/// contract has no standing `BRIDGE_ROLE` on any agent's `ReputationRegistry` clone
/// (each clone's `DEFAULT_ADMIN_ROLE` belongs to that agent's own `SovereignAgent`
/// contract, per `initialize`'s `admin` param — see AgentPrimitivesFactory.sol).
/// Bridging is opt-in per agent: an agent's controller must call
/// `SovereignAgent.execute(reputationRegistryClone, 0, grantRoleCalldata)` granting
/// this bridge `BRIDGE_ROLE` on its own clone before `_ccipReceive` can update that
/// agent's score. This is a deliberate, self-sovereignty-consistent property of the
/// per-agent-clone model, not an oversight — a global bridge with standing write access
/// to every agent's score would be exactly the kind of privileged-third-party control
/// this protocol's core thesis rejects.
///
/// Still not deployed by `script/Deploy.s.sol` — cross-chain bridging needs a peer
/// bridge deployed on a real second chain to be meaningful, which is an operational
/// decision (which second chain, real CCIP lane fees) beyond this rework's scope, not
/// a remaining code gap.
contract CCIPReputationBridge is CCIPReceiver, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IRouterClient public immutable router;
    XibalbaAgentRegistry public immutable agentRegistry;

    /// @dev Trusted peer bridge contract per remote chain selector. `_ccipReceive` only
    /// accepts messages whose `sender` matches this — otherwise anyone could deploy a
    /// throwaway contract on a remote chain and push arbitrary scores into our registry.
    mapping(uint64 => address) public trustedBridges;

    event TrustedBridgeSet(uint64 indexed chainSelector, address indexed bridge);
    event ReputationSent(bytes32 indexed messageId, uint64 indexed destinationChainSelector, address indexed agent, uint256 baseScore);
    event ReputationReceived(bytes32 indexed messageId, uint64 indexed sourceChainSelector, address indexed agent, uint256 baseScore);

    error DestinationBridgeNotConfigured();
    error UntrustedSender();
    error InsufficientFee();
    error RefundFailed();

    constructor(address _router, address _agentRegistry, address admin) CCIPReceiver(_router) {
        router = IRouterClient(_router);
        agentRegistry = XibalbaAgentRegistry(_agentRegistry);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @dev Shared per-agent clone resolution for both `bridgeReputation` and
    /// `_ccipReceive` below. Reverts (via `XibalbaAgentRegistry.resolveAgent`'s own
    /// `UnknownAgent` error) if `agent` isn't a real registered agent -- bridging an
    /// unregistered agent's reputation is meaningless, so failing loudly here is
    /// correct, not a gap to work around.
    function _reputationRegistryOf(address agent) internal view returns (ReputationRegistry) {
        return ReputationRegistry(agentRegistry.resolveAgent(agent).primitives.reputationRegistry);
    }

    function setTrustedBridge(uint64 chainSelector, address bridge) external onlyRole(DEFAULT_ADMIN_ROLE) {
        trustedBridges[chainSelector] = bridge;
        emit TrustedBridgeSet(chainSelector, bridge);
    }

    /// @dev Both CCIPReceiver and AccessControl declare `supportsInterface`, with
    /// different (incompatible-to-mix-via-`super`) state mutability: CCIPReceiver's is
    /// `pure`, AccessControl's is `view`. Solidity only allows overriding *towards* a
    /// stricter mutability (view -> pure is fine, pure -> view is not), so the combined
    /// override here must itself be `pure`, and it re-checks the IAccessControl
    /// interface ID directly (mirroring AccessControl.supportsInterface's own body)
    /// rather than delegating to it, since delegating to a `view` function from a
    /// `pure` one isn't permitted regardless of what that function's body actually does.
    function supportsInterface(bytes4 interfaceId) public pure override(CCIPReceiver, AccessControl) returns (bool) {
        return interfaceId == type(IAccessControl).interfaceId || CCIPReceiver.supportsInterface(interfaceId);
    }

    /// @notice Sends `agent`'s current base AIS to the peer bridge on `destinationChainSelector`.
    /// @param feeToken address(0) to pay the CCIP fee in native gas token, or an ERC20
    /// fee token (e.g. LINK) address to pay in that token.
    /// @dev `nonReentrant`: the native-fee refund below is a raw `.call` to an
    /// arbitrary `msg.sender`, which (unlike the trusted, fixed-address CCIP router
    /// call above it) is attacker-controlled and can run arbitrary code on receipt.
    function bridgeReputation(uint64 destinationChainSelector, address agent, address feeToken)
        external
        payable
        nonReentrant
        returns (bytes32 messageId)
    {
        address destinationBridge = trustedBridges[destinationChainSelector];
        if (destinationBridge == address(0)) revert DestinationBridgeNotConfigured();

        (uint256 baseScore,,,) = _reputationRegistryOf(agent).getAgent(agent);
        bytes memory payload = abi.encode(agent, baseScore);

        Client.EVM2AnyMessage memory message = Client.EVM2AnyMessage({
            receiver: abi.encode(destinationBridge),
            data: payload,
            tokenAmounts: new Client.EVMTokenAmount[](0),
            extraArgs: Client._argsToBytes(Client.EVMExtraArgsV1({gasLimit: 200_000})),
            feeToken: feeToken
        });

        uint256 fee = router.getFee(destinationChainSelector, message);

        if (feeToken == address(0)) {
            if (msg.value < fee) revert InsufficientFee();
            messageId = router.ccipSend{value: fee}(destinationChainSelector, message);

            // Refund any excess native fee -- callers must pad msg.value against
            // getFee() drift between quote and send (a normal, expected pattern for
            // CCIP callers), and without this the excess was previously trapped here
            // permanently: no receive()/withdraw()/sweep function existed anywhere in
            // this contract to recover it.
            uint256 excess = msg.value - fee;
            if (excess > 0) {
                (bool sent,) = msg.sender.call{value: excess}("");
                if (!sent) revert RefundFailed();
            }
        } else {
            IERC20(feeToken).safeTransferFrom(msg.sender, address(this), fee);
            IERC20(feeToken).forceApprove(address(router), fee);
            messageId = router.ccipSend(destinationChainSelector, message);
        }

        emit ReputationSent(messageId, destinationChainSelector, agent, baseScore);
    }

    /// @dev CCIPReceiver hook. Reverts (not a soft failure) if `agent` hasn't granted
    /// this bridge `BRIDGE_ROLE` on its own `ReputationRegistry` clone -- see this
    /// contract's top-level NatSpec on why that grant is per-agent and opt-in rather
    /// than something a deploy script can wire up globally.
    function _ccipReceive(Client.Any2EVMMessage memory message) internal override {
        address sender = abi.decode(message.sender, (address));
        if (sender != trustedBridges[message.sourceChainSelector]) revert UntrustedSender();

        (address agent, uint256 baseScore) = abi.decode(message.data, (address, uint256));
        _reputationRegistryOf(agent).updateScoreByBridge(agent, baseScore);

        emit ReputationReceived(message.messageId, message.sourceChainSelector, agent, baseScore);
    }
}
