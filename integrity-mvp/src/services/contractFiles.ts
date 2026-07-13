export const REAL_FILES = [
  { name: 'VerifierRegistry.sol', content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {IZkVerifier} from "./IZkVerifier.sol";

/// @title VerifierRegistry
/// @notice Per-agent EIP-1167 clone holding a versioned, agent-controlled pointer to
/// whichever global \`IZkVerifier\` implementation (UltraPlonkVerifier, or a future
/// circuit version) this agent currently trusts.
/// @dev Exists so a single global circuit upgrade doesn't force every agent onto the new
/// version simultaneously — an agent can pin an older, still-verifying version while it
/// validates the new one, implementing the "Versioned Circuit Registry" ingestion
/// hardening item (docs/INTERFACE_CONTRACT.md). \`verify\` forwards to whichever impl is
/// current; this contract does no verification logic of its own.
contract VerifierRegistry is Initializable, AccessControlUpgradeable, IZkVerifier {
    mapping(uint256 => address) public verifierImpl;
    uint256 public currentVersion;

    event VersionPinned(uint256 indexed version, address indexed impl);
    event CurrentVersionSet(uint256 indexed version);

    error UnknownVersion(uint256 version);

    /// @dev Implementation contract itself is never initializable — only its clones are.
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin, address initialVerifier) external initializer {
        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        if (initialVerifier != address(0)) {
            verifierImpl[1] = initialVerifier;
            currentVersion = 1;
            emit VersionPinned(1, initialVerifier);
            emit CurrentVersionSet(1);
        }
    }

    /// @notice Registers a new circuit version's verifier address without switching to
    /// it yet — lets an agent (or its operator) stage a version before adopting it.
    function pinVersion(uint256 version, address impl) external onlyRole(DEFAULT_ADMIN_ROLE) {
        verifierImpl[version] = impl;
        emit VersionPinned(version, impl);
    }

    /// @notice Switches which pinned version \`verify\` forwards to.
    function setCurrentVersion(uint256 version) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (verifierImpl[version] == address(0)) revert UnknownVersion(version);
        currentVersion = version;
        emit CurrentVersionSet(version);
    }

    /// @inheritdoc IZkVerifier
    function verify(bytes calldata proof, bytes32[] calldata publicInputs) external view returns (bool) {
        address impl = verifierImpl[currentVersion];
        if (impl == address(0)) revert UnknownVersion(currentVersion);
        return IZkVerifier(impl).verify(proof, publicInputs);
    }
}
` },
  { name: 'Slasher.sol', content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IntegrityToken} from "./IntegrityToken.sol";

/// @title Slasher
/// @notice Holds agents' \$ITK collateral and executes programmatic, dispute-gated
/// slashing when an agent is found to have violated protocol rules.
/// @dev Self-contained: unlike the old prototype's Slasher (which read "deals" from a
/// separate marketplace contract not in this rewrite's scope), staking and dispute
/// state both live here, so this contract's guarantees don't depend on an external
/// contract this package doesn't control.
///
/// Why a dispute window exists at all: DISPUTER_ROLE is meant to be held by the
/// integrity-oracle backend, which raises a dispute automatically off the back of an
/// automated signal (e.g. a BCC commitment that didn't match the agent's actual
/// on-chain action). Automated signals can be wrong — a bug in the oracle, a
/// mis-parsed payload, a compromised oracle signing key. If \`raiseDispute\` could
/// immediately move funds, a single bad oracle report (or a briefly compromised oracle
/// key) could destroy an agent's entire stake before any human ever looked at it.
/// Instead, raising a dispute only *locks* the disputed amount (the agent can't
/// withdraw it, so it can't be front-run away), and actual fund movement
/// (\`resolveDispute\`) requires both (a) the challenge window to have fully elapsed,
/// giving the agent/operator time to present counter-evidence off-chain, and (b) a
/// separate arbiter role (DEFAULT_ADMIN_ROLE, expected to be a multisig/governance
/// address, not the same key as DISPUTER_ROLE) to make the actual call.
/// @dev Per-agent EIP-1167 clone (see AgentPrimitivesFactory). \`itk\` stays a real
/// Solidity \`immutable\` rather than an \`initialize()\` parameter: it is baked into the
/// implementation contract's own runtime bytecode at that implementation's one-time
/// deployment, and since every clone delegatecalls into that same bytecode, every
/// agent's Slasher clone reads the identical, correct \$ITK address for free — no need to
/// spend a storage write repeating a value that never varies per agent. \`admin\`
/// (arbiter) and \`disputer\` DO vary in spirit (they're protocol-governance/oracle
/// signers, not the agent) but are passed as \`initialize()\` params rather than
/// implementation-immutables so a future re-key of governance doesn't require
/// redeploying the implementation and every dependent clone.
contract Slasher is Initializable, AccessControlUpgradeable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant DISPUTER_ROLE = keccak256("DISPUTER_ROLE");

    IntegrityToken public immutable itk;

    // Slashed collateral is burned via IntegrityToken.burn (see resolveDispute) rather
    // than routed to an arbitrary treasury address — that removes any incentive for
    // whoever controls DEFAULT_ADMIN_ROLE to raise/resolve disputes for personal gain,
    // since there is no address that profits from a slash.

    /// @dev Deliberately NOT given an inline initializer (\`= 3 days\`) — inline field
    /// initializers compile into the *constructor*, which never runs for an EIP-1167
    /// clone (clones only ever delegatecall into \`initialize\`). Left as a bare
    /// declaration (defaults to 0) and set explicitly in \`initialize\` instead; a
    /// previous version of this contract kept the inline initializer after the
    /// Initializable conversion and every clone silently got a 0-length dispute window,
    /// meaning \`resolveDispute\` never actually enforced the challenge period.
    uint256 public disputeWindow;

    struct Dispute {
        address agent;
        uint256 amount;
        uint256 raisedAt;
        bool resolved;
        bool slashed;
        string reason;
    }

    mapping(address => uint256) public stakeOf;
    mapping(address => uint256) public lockedStakeOf;
    mapping(uint256 => Dispute) public disputes;
    uint256 public nextDisputeId;

    event Staked(address indexed agent, uint256 amount);
    event Unstaked(address indexed agent, uint256 amount);
    event DisputeRaised(uint256 indexed disputeId, address indexed agent, uint256 amount, string reason);
    event DisputeResolved(uint256 indexed disputeId, address indexed agent, bool slashed, uint256 amount);
    event DisputeWindowUpdated(uint256 newWindow);

    error ZeroAmount();
    error InsufficientAvailableStake();
    error DisputeNotFound();
    error DisputeAlreadyResolved();
    error ChallengeWindowNotElapsed();

    constructor(address _itk) {
        itk = IntegrityToken(_itk);
        _disableInitializers();
    }

    /// @param admin Arbiter role (DEFAULT_ADMIN_ROLE) — protocol governance, deliberately
    /// never the agent itself (see contract-level NatSpec: an agent cannot be trusted to
    /// arbitrate its own slashing dispute).
    /// @param disputer DISPUTER_ROLE — the protocol's oracle/dispute signer.
    /// @dev Uses the plain (non-upgradeable) \`ReentrancyGuard\`, not
    /// \`ReentrancyGuardUpgradeable\` — OZ 5.6.x's upgradeable package no longer ships that
    /// variant. This is safe under EIP-1167 clones without an explicit init step because
    /// \`ReentrancyGuard\`'s modifier only ever checks \`slot == ENTERED (2)\`, never
    /// \`== NOT_ENTERED (1)\`; a freshly-cloned contract's guard slot is zero-initialized,
    /// which is neither value, so the very first call behaves identically to a properly
    /// initialized guard. OZ's own NatSpec on that contract flags it as safe to reuse
    /// this way for exactly this reason.
    function initialize(address admin, address disputer) external initializer {
        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        if (disputer != address(0)) {
            _grantRole(DISPUTER_ROLE, disputer);
        }
        disputeWindow = 3 days;
    }

    function setDisputeWindow(uint256 newWindow) external onlyRole(DEFAULT_ADMIN_ROLE) {
        disputeWindow = newWindow;
        emit DisputeWindowUpdated(newWindow);
    }

    function stake(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        IERC20(address(itk)).safeTransferFrom(msg.sender, address(this), amount);
        stakeOf[msg.sender] += amount;
        emit Staked(msg.sender, amount);
    }

    /// @notice Withdraws stake. Only the *unlocked* portion (total minus whatever is
    /// currently tied up in open disputes) can be withdrawn — this is what makes
    /// \`raiseDispute\` meaningful; without it, an agent could see a dispute coming (or
    /// simply front-run the oracle's report in the mempool) and withdraw before the
    /// lock ever applies.
    function unstake(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        uint256 available = stakeOf[msg.sender] - lockedStakeOf[msg.sender];
        if (available < amount) revert InsufficientAvailableStake();
        stakeOf[msg.sender] -= amount;
        IERC20(address(itk)).safeTransfer(msg.sender, amount);
        emit Unstaked(msg.sender, amount);
    }

    /// @notice Opens a dispute against \`agent\` for \`amount\` of their staked collateral,
    /// locking it immediately. Does not move funds — only \`resolveDispute\`, after the
    /// challenge window, can do that.
    function raiseDispute(address agent, uint256 amount, string calldata reason)
        external
        onlyRole(DISPUTER_ROLE)
        returns (uint256 disputeId)
    {
        if (amount == 0) revert ZeroAmount();
        uint256 available = stakeOf[agent] - lockedStakeOf[agent];
        if (available < amount) revert InsufficientAvailableStake();

        lockedStakeOf[agent] += amount;
        disputeId = nextDisputeId++;
        disputes[disputeId] = Dispute({
            agent: agent,
            amount: amount,
            raisedAt: block.timestamp,
            resolved: false,
            slashed: false,
            reason: reason
        });

        emit DisputeRaised(disputeId, agent, amount, reason);
    }

    /// @notice Arbiter resolves a dispute once the challenge window has elapsed, either
    /// slashing (burning) the locked amount or releasing the lock back to the agent.
    function resolveDispute(uint256 disputeId, bool slash) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        Dispute storage d = disputes[disputeId];
        if (d.raisedAt == 0) revert DisputeNotFound();
        if (d.resolved) revert DisputeAlreadyResolved();
        if (block.timestamp < d.raisedAt + disputeWindow) revert ChallengeWindowNotElapsed();

        d.resolved = true;
        d.slashed = slash;
        lockedStakeOf[d.agent] -= d.amount;

        if (slash) {
            stakeOf[d.agent] -= d.amount;
            itk.burn(d.amount);
        }

        emit DisputeResolved(disputeId, d.agent, slash, d.amount);
    }
}
` },
  { name: 'CCIPReputationBridge.sol', content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IRouterClient} from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import {CCIPReceiver} from "@chainlink/contracts-ccip/contracts/applications/CCIPReceiver.sol";
import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReputationRegistry} from "./ReputationRegistry.sol";
import {XibalbaAgentRegistry} from "../framework/XibalbaAgentRegistry.sol";

/// @title CCIPReputationBridge
/// @notice Synchronizes an agent's base AIS across chains via Chainlink CCIP, so a
/// reputation earned on the home chain is visible (not re-earned from scratch) on a
/// destination chain's ReputationRegistry deployment.
/// @dev Deliberately propagates only \`baseScore\`, never the ZK-boost state. A ZK boost
/// means "this chain independently verified a Barretenberg proof against a root this
/// chain anchored" (see ReputationRegistry.submitZkAttestation) — that is a locally
/// earned property of *this* StateAnchor/IZkVerifier deployment. Blindly trusting a
/// remote chain's claim that "the boost was active" would let a single compromised or
/// buggy verifier deployment on one chain inflate scores everywhere the bridge reaches.
/// If a destination chain wants the boost, the agent submits its own ZK attestation
/// there too, against that chain's own anchored state.
///
/// REWORKED 2026-07-11 for the per-agent EIP-1167 clone model: this contract used to
/// hold one immutable \`ReputationRegistry\` address, a leftover from before per-agent
/// clones existed (see AgentPrimitivesFactory / XibalbaAgentRegistry.PrimitiveSet).
/// \`registry.getAgent(agent)\`/\`registry.updateScoreByBridge(agent, baseScore)\` never
/// resolved to "the" registry for an arbitrary agent once every agent got its own
/// clone. Now holds \`XibalbaAgentRegistry\` instead and resolves each agent's own
/// \`ReputationRegistry\` clone via \`agentRegistry.resolveAgent(agent).primitives.
/// reputationRegistry\` on every call — the same resolution pattern already established
/// by \`EHRGate\`/\`IntegrityMarket\`/\`A2ACapitalPool\` (grep \`resolveAgent(\` in \`src/\` to
/// confirm this is the established idiom, not a new one invented for this fix).
///
/// One consequence of this fix, not present in the old single-registry design: this
/// contract has no standing \`BRIDGE_ROLE\` on any agent's \`ReputationRegistry\` clone
/// (each clone's \`DEFAULT_ADMIN_ROLE\` belongs to that agent's own \`SovereignAgent\`
/// contract, per \`initialize\`'s \`admin\` param — see AgentPrimitivesFactory.sol).
/// Bridging is opt-in per agent: an agent's controller must call
/// \`SovereignAgent.execute(reputationRegistryClone, 0, grantRoleCalldata)\` granting
/// this bridge \`BRIDGE_ROLE\` on its own clone before \`_ccipReceive\` can update that
/// agent's score. This is a deliberate, self-sovereignty-consistent property of the
/// per-agent-clone model, not an oversight — a global bridge with standing write access
/// to every agent's score would be exactly the kind of privileged-third-party control
/// this protocol's core thesis rejects.
///
/// Still not deployed by \`script/Deploy.s.sol\` — cross-chain bridging needs a peer
/// bridge deployed on a real second chain to be meaningful, which is an operational
/// decision (which second chain, real CCIP lane fees) beyond this rework's scope, not
/// a remaining code gap.
contract CCIPReputationBridge is CCIPReceiver, AccessControl {
    using SafeERC20 for IERC20;

    IRouterClient public immutable router;
    XibalbaAgentRegistry public immutable agentRegistry;

    /// @dev Trusted peer bridge contract per remote chain selector. \`_ccipReceive\` only
    /// accepts messages whose \`sender\` matches this — otherwise anyone could deploy a
    /// throwaway contract on a remote chain and push arbitrary scores into our registry.
    mapping(uint64 => address) public trustedBridges;

    event TrustedBridgeSet(uint64 indexed chainSelector, address indexed bridge);
    event ReputationSent(bytes32 indexed messageId, uint64 indexed destinationChainSelector, address indexed agent, uint256 baseScore);
    event ReputationReceived(bytes32 indexed messageId, uint64 indexed sourceChainSelector, address indexed agent, uint256 baseScore);

    error DestinationBridgeNotConfigured();
    error UntrustedSender();
    error InsufficientFee();

    constructor(address _router, address _agentRegistry, address admin) CCIPReceiver(_router) {
        router = IRouterClient(_router);
        agentRegistry = XibalbaAgentRegistry(_agentRegistry);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @dev Shared per-agent clone resolution for both \`bridgeReputation\` and
    /// \`_ccipReceive\` below. Reverts (via \`XibalbaAgentRegistry.resolveAgent\`'s own
    /// \`UnknownAgent\` error) if \`agent\` isn't a real registered agent -- bridging an
    /// unregistered agent's reputation is meaningless, so failing loudly here is
    /// correct, not a gap to work around.
    function _reputationRegistryOf(address agent) internal view returns (ReputationRegistry) {
        return ReputationRegistry(agentRegistry.resolveAgent(agent).primitives.reputationRegistry);
    }

    function setTrustedBridge(uint64 chainSelector, address bridge) external onlyRole(DEFAULT_ADMIN_ROLE) {
        trustedBridges[chainSelector] = bridge;
        emit TrustedBridgeSet(chainSelector, bridge);
    }

    /// @dev Both CCIPReceiver and AccessControl declare \`supportsInterface\`, with
    /// different (incompatible-to-mix-via-\`super\`) state mutability: CCIPReceiver's is
    /// \`pure\`, AccessControl's is \`view\`. Solidity only allows overriding *towards* a
    /// stricter mutability (view -> pure is fine, pure -> view is not), so the combined
    /// override here must itself be \`pure\`, and it re-checks the IAccessControl
    /// interface ID directly (mirroring AccessControl.supportsInterface's own body)
    /// rather than delegating to it, since delegating to a \`view\` function from a
    /// \`pure\` one isn't permitted regardless of what that function's body actually does.
    function supportsInterface(bytes4 interfaceId) public pure override(CCIPReceiver, AccessControl) returns (bool) {
        return interfaceId == type(IAccessControl).interfaceId || CCIPReceiver.supportsInterface(interfaceId);
    }

    /// @notice Sends \`agent\`'s current base AIS to the peer bridge on \`destinationChainSelector\`.
    /// @param feeToken address(0) to pay the CCIP fee in native gas token, or an ERC20
    /// fee token (e.g. LINK) address to pay in that token.
    function bridgeReputation(uint64 destinationChainSelector, address agent, address feeToken)
        external
        payable
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
        } else {
            IERC20(feeToken).safeTransferFrom(msg.sender, address(this), fee);
            IERC20(feeToken).forceApprove(address(router), fee);
            messageId = router.ccipSend(destinationChainSelector, message);
        }

        emit ReputationSent(messageId, destinationChainSelector, agent, baseScore);
    }

    /// @dev CCIPReceiver hook. Reverts (not a soft failure) if \`agent\` hasn't granted
    /// this bridge \`BRIDGE_ROLE\` on its own \`ReputationRegistry\` clone -- see this
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
` },
  { name: 'IntegrityToken.sol', content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title IntegrityToken (\$ITK)
/// @notice The staking/collateral asset for the Integrity Protocol: agents stake it in
/// \`Slasher\` to back their reputation, and lock it in \`shield/SmartBAA\` as HIPAA
/// business-associate collateral.
/// @dev Plain capped-supply ERC20 with role-gated minting — no transfer fee, no
/// rebasing. The old prototype's ITK charged a fee-on-transfer (burn + treasury cut) on
/// every transfer; that silently breaks any contract that does
/// \`transferFrom(x, address(this), amount)\` and then trusts its own balance increased
/// by exactly \`amount\` (Slasher, SmartBAA and ReputationRegistry all do exactly that).
/// Rather than carry that accounting bug forward, fee-on-transfer is left out entirely;
/// if a protocol fee is wanted later it belongs in the contracts that move value
/// (Slasher/SmartBAA), where the accounting can account for it explicitly.
contract IntegrityToken is ERC20, ERC20Burnable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    uint256 public constant MAX_SUPPLY = 100_000_000 ether;

    /// @notice Cumulative amount ever minted. Tracked separately from \`totalSupply()\`
    /// so the issuance cap is on lifetime minting, not circulating supply — otherwise
    /// burning tokens (e.g. a Slasher penalty) would silently reopen mint headroom,
    /// letting the protocol re-inflate supply it had deliberately destroyed.
    uint256 public totalMinted;

    error ExceedsMaxSupply(uint256 requested, uint256 remaining);
    error ZeroAmount();

    constructor(address admin, uint256 initialMint) ERC20("Integrity Token", "ITK") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);

        if (initialMint > 0) {
            if (initialMint > MAX_SUPPLY) revert ExceedsMaxSupply(initialMint, MAX_SUPPLY);
            totalMinted = initialMint;
            _mint(admin, initialMint);
        }
    }

    /// @notice Mints new ITK, capped at MAX_SUPPLY total ever minted (mint does not
    /// "un-cap" itself as tokens are burned — burning reduces circulating supply, not
    /// the lifetime issuance ceiling, which is what actually bounds dilution).
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        if (amount == 0) revert ZeroAmount();
        if (totalMinted + amount > MAX_SUPPLY) {
            revert ExceedsMaxSupply(amount, MAX_SUPPLY - totalMinted);
        }
        totalMinted += amount;
        _mint(to, amount);
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
` },
  { name: 'UltraPlonkVerifier.sol', content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IZkVerifier} from "./IZkVerifier.sol";

/// =============================================================================
///  PLACEHOLDER — THIS FILE WILL BE REPLACED WHOLESALE, NOT EDITED.
/// =============================================================================
/// @title UltraPlonkVerifier (placeholder)
/// @notice Stand-in for the real UltraPlonk/Honk verifier that \`bb write_solidity_verifier\`
/// generates from the compiled \`integrity-zkp/src/main.nr\` circuit (see §5 of
/// docs/INTERFACE_CONTRACT.md and script/GenerateVerifier.sh in this package).
///
/// @dev THIS IS NOT THE OLD PROTOTYPE'S MOCK. The previous version of this file
/// (\`/INTEGRITY/contracts/src/oracle/UltraPlonkVerifier.sol\`) had \`verify()\` return
/// \`true\` for any non-empty proof — i.e. it failed OPEN: a caller who did nothing but
/// pass non-empty garbage bytes got treated as a valid ZK proof. That is exactly the
/// "silent mock" the interface contract's ground rule (docs/INTERFACE_CONTRACT.md, the
/// "no silent mocks" paragraph) forbids.
///
/// This placeholder instead fails CLOSED: every call to \`verify\` reverts, unconditionally.
/// That means:
///   1. It is IMPOSSIBLE for any transaction depending on ZK verification (see
///      ReputationRegistry.submitZkAttestation) to be silently treated as "proof
///      accepted" or "proof rejected but let's proceed anyway" — it simply cannot be
///      exercised end-to-end until the real verifier is generated and swapped in.
///   2. Tests that need to exercise the *rest* of the ZK-attestation code path (the
///      Merkle-anchor check, the AIS boost bookkeeping) do so honestly, by pointing
///      ReputationRegistry at a \`vm.mockCall\`-controlled stand-in for IZkVerifier in the
///      test file, not at this contract — see test/ReputationRegistry.t.sol. That mock
///      call lives in test code, which is expected and inspectable, not hidden inside a
///      "production" contract.
///
/// To replace this file for real: run \`make generate-verifier\` from this package (see
/// script/GenerateVerifier.sh), which compiles the Noir circuit in ../integrity-zkp,
/// runs \`bb write_vk\` + \`bb write_solidity_verifier\`, and overwrites this exact file
/// with the generated contract. The generated contract must keep implementing
/// IZkVerifier so ReputationRegistry needs no changes.
contract UltraPlonkVerifier is IZkVerifier {
    /// @notice Always reverts. See contract-level NatSpec for why this fails closed
    /// instead of returning a hardcoded boolean.
    error PlaceholderVerifierNotYetGenerated();

    function verify(bytes calldata, /* proof */ bytes32[] calldata /* publicInputs */ )
        external
        pure
        override
        returns (bool)
    {
        revert PlaceholderVerifierNotYetGenerated();
    }
}
` },
  { name: 'IZkVerifier.sol', content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IZkVerifier
/// @notice The interface every on-chain UltraPlonk/Honk verifier generated by
/// Barretenberg's \`bb write_solidity_verifier\` implements.
/// @dev This exact signature — \`verify(bytes calldata proof, bytes32[] calldata
/// publicInputs) external view returns (bool)\` — is what \`bb\`'s codegen emits for a
/// Noir circuit compiled with \`nargo compile\` (see integrity-zkp/README.md for the full
/// \`nargo compile\` -> \`bb write_vk\` -> \`bb write_solidity_verifier\` pipeline, §5 of the
/// interface contract). \`view\` rather than \`pure\` because the real generated verifier
/// reads no storage but is not literally side-effect-free at the EVM level (it uses
/// precompiled contracts for the pairing check); \`bytes32[]\` for public inputs matches
/// Noir's field-element public input encoding (each Noir \`Field\` public input becomes
/// one bytes32 word, big-endian, reduced mod the BN254 scalar field).
///
/// Every contract in this package that needs to check a ZK proof (ReputationRegistry)
/// depends on this interface, never on the concrete UltraPlonkVerifier implementation —
/// that's what lets \`make generate-verifier\` swap the placeholder for the real generated
/// contract without touching a single calling contract.
interface IZkVerifier {
    function verify(bytes calldata proof, bytes32[] calldata publicInputs) external view returns (bool);
}
` },
  { name: 'StateAnchor.sol', content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/// @title StateAnchor
/// @notice Anchors Merkle roots of the off-chain "Trust Vault" (the state integrity-oracle
/// computes AIS sub-scores and ZK attestation eligibility from) so that any individual
/// leaf of that off-chain state can be proven, on demand, to have been part of a root
/// this contract actually anchored.
/// @dev Tree convention (must match integrity-oracle bit-for-bit — see
/// docs/INTERFACE_CONTRACT.md §4.4):
///   - leaves: \`keccak256(abi.encodePacked(leafData))\`
///   - parents: \`keccak256(a < b ? (a,b) : (b,a))\` — children sorted ascending before
///     hashing.
/// The pair is sorted (rather than hashed in insertion/positional order) so that a
/// verifier does not need to know whether a given sibling is the "left" or "right" child
/// while walking the proof — OZ's \`MerkleProof.verify\` assumes exactly this convention.
/// Sorting also closes off a second-preimage/ambiguity issue where two different trees
/// could be built from the same leaf set by permuting left/right at each level; with
/// sorted pairs there is exactly one valid parent hash for a given set of two children,
/// so the root is a true function of the *set* of leaves, not their arrangement.
contract StateAnchor is AccessControl {
    bytes32 public constant ANCHOR_ROLE = keccak256("ANCHOR_ROLE");

    bytes32 public latestRoot;
    uint256 public latestEpoch;
    uint256 public latestTimestamp;

    /// @dev Every root we have ever anchored remains individually verifiable — a proof
    /// generated against last week's root must still verify today. Only \`latestRoot\`
    /// advances "what's current"; \`isAnchoredRoot\` never un-anchors an old root.
    mapping(bytes32 => bool) public isAnchoredRoot;
    mapping(uint256 => bytes32) public rootAtEpoch;

    event RootAnchored(uint256 indexed epoch, bytes32 indexed root, uint256 timestamp);

    error EmptyRoot();

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ANCHOR_ROLE, admin);
    }

    /// @notice Anchors a new Merkle root for the next epoch. Called by integrity-oracle's
    /// signer (or, cross-chain, indirectly via CCIPReputationBridge) each time it
    /// recomputes the Trust Vault.
    function anchorRoot(bytes32 root) external onlyRole(ANCHOR_ROLE) returns (uint256 epoch) {
        if (root == bytes32(0)) revert EmptyRoot();
        epoch = ++latestEpoch;
        rootAtEpoch[epoch] = root;
        isAnchoredRoot[root] = true;
        latestRoot = root;
        latestTimestamp = block.timestamp;
        emit RootAnchored(epoch, root, block.timestamp);
    }

    /// @notice Verifies that \`leaf\` is included under \`root\`, and that \`root\` is one
    /// this contract actually anchored (not just any Merkle-valid root a caller made up
    /// on the spot — anchoring is what gives a root its authority).
    function verifyLeaf(bytes32 root, bytes32 leaf, bytes32[] calldata proof) external view returns (bool) {
        if (!isAnchoredRoot[root]) return false;
        return MerkleProof.verify(proof, root, leaf);
    }

    /// @notice Convenience wrapper that verifies against the current \`latestRoot\`.
    function verifyLeafAtLatest(bytes32 leaf, bytes32[] calldata proof) external view returns (bool) {
        return MerkleProof.verify(proof, latestRoot, leaf);
    }
}
` },
  { name: 'ReputationRegistry.sol', content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {IZkVerifier} from "./IZkVerifier.sol";
import {StateAnchor} from "./StateAnchor.sol";

/// @title ReputationRegistry
/// @notice Per-agent EIP-1167 clone: the on-chain ledger for one agent's Agent Integrity
/// Score (AIS, §4.3 of the interface contract). This contract does not *compute* the AIS
/// formula \`(S_entropy*wE + S_grounding*wG + S_sacrifice*wS + S_compliance*wC) * ZK_boost\`
/// — that weighted-sum computation is integrity-oracle's job, and stays the single place
/// it's computed (per the interface contract, every other package calls the oracle's
/// \`/v1/agent/{id}/ais\` HTTP endpoint rather than recompute it). What this contract owns
/// is the one component that *cannot* be trusted from an off-chain HTTP response alone:
/// the \`ZK_boost\` multiplier, which is only legitimate if a real Barretenberg proof
/// verified on-chain, against a leaf that is itself anchored in a Merkle root this chain
/// anchored. So the division of labour is: oracle pushes \`baseScore\` (the pre-boost
/// weighted sum) via \`updateScore\`; this contract independently earns the right to apply
/// the 1.15x multiplier by verifying a ZK proof itself, in \`submitZkAttestation\`.
/// @dev Was a directly-deployed singleton; now a per-agent clone (see
/// AgentPrimitivesFactory) so one agent's score storage never shares a slot with
/// another's, and \`DEFAULT_ADMIN_ROLE\` (config: which verifier/anchor this agent trusts)
/// belongs to that agent's own SovereignAgent contract rather than a shared protocol
/// admin — \`ORACLE_ROLE\` remains a separate, protocol-held signer so the oracle can keep
/// pushing scores without needing the agent's own permission on every update.
contract ReputationRegistry is Initializable, AccessControlUpgradeable {
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");

    /// @dev ZK_boost = 1.15 per §4.3, expressed in basis points so Solidity integer
    /// arithmetic doesn't need a fixed-point library for a single constant multiplier.
    uint256 public constant ZK_BOOST_BPS = 11_500;
    uint256 public constant BPS_DENOMINATOR = 10_000;

    /// @notice How long a verified ZK proof's boost remains valid before it must be
    /// re-submitted. Mirrors "for the reporting period" in §4.3 — a proof verified once
    /// should not grant a permanent boost long after the period it attested to has
    /// passed, or the boost stops meaning "verified recently" and starts meaning
    /// "verified once, ever".
    /// @dev Deliberately NOT given an inline initializer here — inline field
    /// initializers compile into the constructor, which never runs for an EIP-1167
    /// clone. Set explicitly in \`initialize\` instead (see Slasher.disputeWindow for the
    /// same footgun, caught in that contract's own clone tests).
    uint256 public reportingPeriod;

    struct AgentScore {
        uint256 baseScore; // pre-boost weighted sum from integrity-oracle
        uint256 lastUpdate;
        uint256 zkBoostExpiry; // block.timestamp until which the ZK boost applies
    }

    mapping(address => AgentScore) public scores;

    IZkVerifier public zkVerifier;
    StateAnchor public stateAnchor;

    event ScoreUpdated(address indexed agent, uint256 oldBaseScore, uint256 newBaseScore, address indexed updatedBy);
    event ZkAttestationVerified(address indexed agent, bytes32 indexed leaf, uint256 boostExpiry);
    event ZkConfigUpdated(address indexed verifier, address indexed anchor);
    event ReportingPeriodUpdated(uint256 newPeriod);

    error ZkNotConfigured();
    error InvalidProof();
    error LeafNotAnchored();
    error OnlyAgentCanSubmitOwnProof();

    /// @dev Implementation contract itself is never initializable — only its clones are
    /// (standard OZ upgradeable-safety pattern: without this, someone could call
    /// \`initialize\` directly on the shared implementation and seize its admin role,
    /// though since this implementation is never delegatecalled into for its own storage
    /// that alone wouldn't be exploitable — but disabling it is free and removes the
    /// question entirely).
    constructor() {
        _disableInitializers();
    }

    /// @param admin Gets DEFAULT_ADMIN_ROLE — the agent's own SovereignAgent contract
    /// address, per the protocol's call-routing convention, so only that agent (acting
    /// through its own \`execute\`) can repoint its verifier/anchor.
    /// @param oracleSigner Gets ORACLE_ROLE — the protocol's oracle signer, kept
    /// separate from \`admin\` so the oracle can keep pushing scores independent of
    /// whatever the agent's own controller key is doing.
    function initialize(address admin, address oracleSigner, address _zkVerifier, address _stateAnchor)
        external
        initializer
    {
        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        if (oracleSigner != address(0)) {
            _grantRole(ORACLE_ROLE, oracleSigner);
        }
        zkVerifier = IZkVerifier(_zkVerifier);
        stateAnchor = StateAnchor(_stateAnchor);
        reportingPeriod = 7 days;
    }

    function setZkConfig(address _zkVerifier, address _stateAnchor) external onlyRole(DEFAULT_ADMIN_ROLE) {
        zkVerifier = IZkVerifier(_zkVerifier);
        stateAnchor = StateAnchor(_stateAnchor);
        emit ZkConfigUpdated(_zkVerifier, _stateAnchor);
    }

    function setReportingPeriod(uint256 newPeriod) external onlyRole(DEFAULT_ADMIN_ROLE) {
        reportingPeriod = newPeriod;
        emit ReportingPeriodUpdated(newPeriod);
    }

    /// @notice Oracle-pushed update of an agent's pre-boost weighted AIS. Does not
    /// touch \`zkBoostExpiry\` — a fresh score push should not silently extend or clear an
    /// independently-earned ZK boost.
    function updateScore(address agent, uint256 baseScore) external onlyRole(ORACLE_ROLE) {
        _setBaseScore(agent, baseScore, msg.sender);
    }

    /// @notice Same as \`updateScore\`, but for scores arriving from a trusted cross-chain
    /// bridge (see CCIPReputationBridge) rather than the local oracle signer directly.
    /// Kept as a separate role/function (not just adding CCIPReputationBridge to
    /// ORACLE_ROLE) so a bridge compromise and an oracle-signer compromise are
    /// independently revocable.
    function updateScoreByBridge(address agent, uint256 baseScore) external onlyRole(BRIDGE_ROLE) {
        _setBaseScore(agent, baseScore, msg.sender);
    }

    function _setBaseScore(address agent, uint256 baseScore, address updatedBy) internal {
        uint256 old = scores[agent].baseScore;
        scores[agent].baseScore = baseScore;
        scores[agent].lastUpdate = block.timestamp;
        emit ScoreUpdated(agent, old, baseScore, updatedBy);
    }

    /// @notice Verifies a Noir/Barretenberg ZK proof that the given \`leaf\` (an
    /// off-chain-committed fact about this agent's behavior, e.g. a hashed intent
    /// payload from a BCC commitment, §4.2) is both (a) part of a Merkle tree this chain
    /// has anchored via StateAnchor, and (b) attested to by a valid ZK proof over
    /// \`publicInputs\`. Only the agent itself may submit its own attestation — otherwise
    /// anyone could grab a valid (proof, publicInputs, leaf, merkleProof) tuple observed
    /// on-chain or off-chain and replay it to boost a *different* agent's score, since
    /// none of those values are, by themselves, bound to a caller.
    /// @param agent The agent this attestation is for. Must equal msg.sender.
    /// @param proof The UltraPlonk/Honk proof bytes from \`bb prove\`.
    /// @param publicInputs The circuit's public inputs (see integrity-zkp/src/main.nr for
    /// the exact layout); this contract does not interpret their contents beyond passing
    /// them to the verifier — the circuit itself encodes what they must mean.
    /// @param root The StateAnchor root the leaf is claimed to belong to.
    /// @param leaf The keccak256 leaf value (§4.4 leaf-hashing convention).
    /// @param merkleProof Sibling hashes proving \`leaf\` is included under \`root\`.
    function submitZkAttestation(
        address agent,
        bytes calldata proof,
        bytes32[] calldata publicInputs,
        bytes32 root,
        bytes32 leaf,
        bytes32[] calldata merkleProof
    ) external {
        if (agent != msg.sender) revert OnlyAgentCanSubmitOwnProof();
        if (address(zkVerifier) == address(0) || address(stateAnchor) == address(0)) revert ZkNotConfigured();

        if (!stateAnchor.verifyLeaf(root, leaf, merkleProof)) revert LeafNotAnchored();
        if (!zkVerifier.verify(proof, publicInputs)) revert InvalidProof();

        uint256 expiry = block.timestamp + reportingPeriod;
        scores[agent].zkBoostExpiry = expiry;
        emit ZkAttestationVerified(agent, leaf, expiry);
    }

    /// @notice The score other packages should actually use for threshold checks: the
    /// oracle-reported base score, boosted by ZK_boost only while a verified attestation
    /// is still within its reporting period.
    function effectiveScore(address agent) public view returns (uint256) {
        AgentScore storage s = scores[agent];
        if (block.timestamp <= s.zkBoostExpiry) {
            return (s.baseScore * ZK_BOOST_BPS) / BPS_DENOMINATOR;
        }
        return s.baseScore;
    }

    function isZkBoosted(address agent) external view returns (bool) {
        return block.timestamp <= scores[agent].zkBoostExpiry;
    }

    function getAgent(address agent)
        external
        view
        returns (uint256 baseScore, uint256 effective, bool zkBoosted, uint256 lastUpdate)
    {
        AgentScore storage s = scores[agent];
        return (s.baseScore, effectiveScore(agent), block.timestamp <= s.zkBoostExpiry, s.lastUpdate);
    }
}
` },
  { name: 'IAccount.sol', content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IAccount
/// @notice Minimal interface every SovereignAgent-style on-chain account must implement.
/// @dev Deliberately NOT an ERC-4337 \`IAccount\` (no \`validateUserOp\`/EntryPoint dependency).
///      The interface contract (docs/INTERFACE_CONTRACT.md) does not specify an EntryPoint
///      deployment or bundler infra anywhere, and pulling in ERC-4337 here would add an
///      entire subsystem (EntryPoint, paymasters, bundler assumptions) that no other
///      package in this monorepo talks to. Off-chain identity (the Ed25519 DID keypair,
///      see §4.1) is managed by integrity-sdk; this on-chain account is controlled by a
///      plain secp256k1 EOA/multisig "controller" address, and links to the off-chain DID
///      only by storing its string form for indexers. If ERC-4337 support is wanted later,
///      it can be layered on as an additional entrypoint without changing this interface.
interface IAccount {
    /// @notice Executes an arbitrary call on behalf of the agent. Restricted to the
    /// current controller (see SovereignAgent.onlyController).
    function execute(address target, uint256 value, bytes calldata data) external returns (bytes memory);

    /// @notice Oracle-role-gated cache update of the agent's current Agent Integrity Score.
    /// @dev The score itself is computed by integrity-oracle (see §4.3 of the interface
    /// contract) — this is a local, cheap-to-read cache, not a recomputation.
    function updateAIS(uint256 newScore) external;

    /// @notice The off-chain DID string (\`did:integrity:<fingerprint>\`) this account is
    /// linked to. Returned as a string rather than reconstructed on-chain because DID
    /// fingerprints are derived from an Ed25519 public key (see §4.1), and Ed25519 point
    /// encoding/hashing is not something we redundantly re-derive in Solidity — the
    /// binding is asserted once at registration time and trusted from there.
    function agentDID() external view returns (string memory);
}
` },
  { name: 'SovereignAgent.sol', content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IAccount} from "./IAccount.sol";

/// @title SovereignAgent
/// @notice The per-agent on-chain account for a single AI ("Sovereign") agent.
/// @dev One instance is deployed per agent by \`AgentFactory\`. It is intentionally a thin
/// account: identity + a cached reputation score + a generic \`execute\`. Everything
/// heavier (staking, slashing, cross-chain sync, HIPAA gating) lives in the shared
/// oracle/framework/shield contracts and simply *reads* this contract's controller/DID,
/// rather than being folded into it — that keeps a compromise of one agent's logic from
/// being able to reach into protocol-wide state it has no business touching.
contract SovereignAgent is AccessControl, IAccount {
    /// @dev Granted to the integrity-oracle backend's signer so it can push AIS cache
    /// updates. Deliberately *not* the same key as DEFAULT_ADMIN_ROLE (the controller):
    /// the oracle should never be able to rotate control of the agent or execute calls
    /// on its behalf, only report a score.
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    /// @dev Off-chain DID string this account is bound to, e.g.
    /// \`did:integrity:9f1c...\`. Set once at construction; the AgentFactory is
    /// responsible for ensuring DID uniqueness registry-wide (see AgentFactory.sol).
    string private _agentDID;

    /// @notice Cached Agent Integrity Score last reported by the oracle. This is a cache
    /// of \`ReputationRegistry\`'s value for cheap on-chain reads (e.g. by other
    /// contracts gating access on "this agent's score"); ReputationRegistry remains the
    /// canonical, cross-agent source of truth.
    uint256 public ais;

    /// @notice Monotonic nonce, bumped on every \`execute\`. Lets off-chain indexers
    /// (integrity-oracle, integrity-dashboard) correlate on-chain actions with the
    /// BCC commitments (\`nonce\` field, §4.2) an agent submitted off-chain.
    uint256 public executionNonce;

    /// @notice The factory that deployed this agent (informational / for indexers).
    address public immutable factory;

    event AISUpdated(uint256 oldScore, uint256 newScore);
    event ControllerRotated(address indexed oldController, address indexed newController);
    event AgentExecuted(address indexed target, uint256 value, bytes data, uint256 nonce);

    error NotController();

    modifier onlyController() {
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) revert NotController();
        _;
    }

    constructor(string memory did_, address controller_, address oracle_, address factory_) {
        require(controller_ != address(0), "SovereignAgent: zero controller");
        _agentDID = did_;
        factory = factory_;

        _grantRole(DEFAULT_ADMIN_ROLE, controller_);
        if (oracle_ != address(0)) {
            _grantRole(ORACLE_ROLE, oracle_);
        }
        // Baseline score before the oracle has ever reported one. 0 rather than an
        // arbitrary "starting reputation" — a nonzero default would let a freshly
        // created, never-scored agent masquerade as one with an established track
        // record in any downstream threshold check (e.g. shield/EHRGate.sol).
        ais = 0;
    }

    /// @inheritdoc IAccount
    function agentDID() external view returns (string memory) {
        return _agentDID;
    }

    /// @inheritdoc IAccount
    /// @dev Arbitrary external call gated to the controller only. Bubbles up the revert
    /// reason from the callee verbatim (via the assembly block) so failures are
    /// debuggable from the controller's perspective instead of collapsing to a generic
    /// "call failed".
    function execute(address target, uint256 value, bytes calldata data)
        external
        onlyController
        returns (bytes memory)
    {
        uint256 nonce = ++executionNonce;
        (bool success, bytes memory result) = target.call{value: value}(data);
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
        emit AgentExecuted(target, value, data, nonce);
        return result;
    }

    /// @inheritdoc IAccount
    function updateAIS(uint256 newScore) external onlyRole(ORACLE_ROLE) {
        uint256 old = ais;
        ais = newScore;
        emit AISUpdated(old, newScore);
    }

    /// @notice Rotates control of the agent to a new address.
    /// @dev Only the *current* controller may do this (a single AccessControl role,
    /// not an NFT-ownership check as older prototypes used) — collapsing "who can act
    /// as this agent" into one role avoids the two-sources-of-truth bug where an NFT
    /// transfer and a role grant could disagree about who is actually in control.
    function rotateController(address newController) external onlyController {
        require(newController != address(0), "SovereignAgent: zero controller");
        _revokeRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(DEFAULT_ADMIN_ROLE, newController);
        emit ControllerRotated(msg.sender, newController);
    }

    /// @notice Lets the account receive native value (e.g. refunds from \`execute\` calls).
    receive() external payable {}
}
` },
  { name: 'DomainRegistry.sol', content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title DomainRegistry
/// @notice Registers namespaces ("domains", e.g. \`healthcare.integrity\`) that agents
/// register under, and decides who is allowed to create an agent in a given domain.
/// @dev Domains exist so verticals (like the HIPAA "shield" stack) can require agents to
/// belong to a vetted namespace before they're eligible for domain-specific gating
/// (see shield/EHRGate.sol, which only trusts a CoveredEntityRegistry entry that in turn
/// only makes sense for agents joined to a healthcare-flavoured domain). Domain
/// membership is intentionally *not* the same thing as reputation/staking — a domain
/// answers "is this agent claiming to operate in the right vertical", reputation answers
/// "has this agent behaved well".
contract DomainRegistry is AccessControl {
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    enum JoinMode {
        Open, // anyone may register an agent under this domain
        Permissioned // only addresses the domain owner has approved may join
    }

    struct Domain {
        address owner;
        JoinMode mode;
        bool exists;
        uint256 memberCount;
    }

    /// @dev keyed by keccak256(bytes(domainName)) rather than the string itself — string
    /// keys in a mapping cost an extra hash anyway, so hashing once at the call boundary
    /// and reusing the bytes32 everywhere (events, approvals, membership) is both cheaper
    /// and gives every consumer a fixed-width identifier to index on.
    mapping(bytes32 => Domain) public domains;
    mapping(bytes32 => mapping(address => bool)) public approvedJoiners;
    mapping(bytes32 => mapping(address => bool)) public isMember;

    event DomainRegistered(bytes32 indexed domainId, string name, address indexed owner, JoinMode mode);
    event JoinerApproved(bytes32 indexed domainId, address indexed joiner);
    event JoinerRevoked(bytes32 indexed domainId, address indexed joiner);
    event MemberJoined(bytes32 indexed domainId, address indexed member);
    event DomainModeChanged(bytes32 indexed domainId, JoinMode newMode);

    error DomainAlreadyExists();
    error DomainDoesNotExist();
    error NotDomainOwner();
    error JoinNotApproved();

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function domainId(string memory name) public pure returns (bytes32) {
        return keccak256(bytes(name));
    }

    /// @notice Registers a new domain. Anyone can claim an unclaimed domain name and
    /// become its owner — first-come-first-served, same trust model as ENS second-level
    /// names. Governance/admin can still intervene via REGISTRAR_ROLE for disputes.
    function registerDomain(string calldata name, JoinMode mode) external returns (bytes32 id) {
        id = domainId(name);
        if (domains[id].exists) revert DomainAlreadyExists();
        domains[id] = Domain({owner: msg.sender, mode: mode, exists: true, memberCount: 0});
        emit DomainRegistered(id, name, msg.sender, mode);
    }

    function setJoinMode(bytes32 id, JoinMode mode) external {
        Domain storage d = domains[id];
        if (!d.exists) revert DomainDoesNotExist();
        if (msg.sender != d.owner && !hasRole(REGISTRAR_ROLE, msg.sender)) revert NotDomainOwner();
        d.mode = mode;
        emit DomainModeChanged(id, mode);
    }

    function approveJoiner(bytes32 id, address joiner) external {
        Domain storage d = domains[id];
        if (!d.exists) revert DomainDoesNotExist();
        if (msg.sender != d.owner && !hasRole(REGISTRAR_ROLE, msg.sender)) revert NotDomainOwner();
        approvedJoiners[id][joiner] = true;
        emit JoinerApproved(id, joiner);
    }

    function revokeJoiner(bytes32 id, address joiner) external {
        Domain storage d = domains[id];
        if (!d.exists) revert DomainDoesNotExist();
        if (msg.sender != d.owner && !hasRole(REGISTRAR_ROLE, msg.sender)) revert NotDomainOwner();
        approvedJoiners[id][joiner] = false;
        emit JoinerRevoked(id, joiner);
    }

    /// @notice Returns whether \`caller\` is currently allowed to register a new agent
    /// under domain \`id\`. Called by AgentFactory before it deploys a SovereignAgent.
    function canJoin(bytes32 id, address caller) public view returns (bool) {
        Domain storage d = domains[id];
        if (!d.exists) return false;
        if (d.mode == JoinMode.Open) return true;
        return approvedJoiners[id][caller];
    }

    /// @notice Records that \`member\` has joined domain \`id\`, on behalf of \`approvedAs\`.
    /// Restricted to REGISTRAR_ROLE, granted to AgentFactory at deploy time.
    /// @dev \`approvedAs\` and \`member\` are deliberately separate parameters: permission
    /// checks (\`canJoin\`/\`approvedJoiners\`) are naturally granted to the *controller*
    /// EOA that requested agent creation (that's the address a domain owner can vet
    /// ahead of time), while the actual domain *member* recorded here is the freshly
    /// deployed SovereignAgent contract address (that's the address downstream
    /// consumers like EHRGate check against, since access-control calls arrive with
    /// the agent contract as \`msg.sender\`). Conflating the two would force domain
    /// owners to pre-approve a CREATE address before it exists, which isn't possible.
    function recordJoin(bytes32 id, address approvedAs, address member) external onlyRole(REGISTRAR_ROLE) {
        Domain storage d = domains[id];
        if (!d.exists) revert DomainDoesNotExist();
        if (!canJoin(id, approvedAs)) revert JoinNotApproved();
        if (!isMember[id][member]) {
            isMember[id][member] = true;
            d.memberCount += 1;
            emit MemberJoined(id, member);
        }
    }
}
` },
  { name: 'AgentPrimitivesFactory.sol', content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {SovereignAgent} from "../core/SovereignAgent.sol";
import {XibalbaAgentRegistry} from "./XibalbaAgentRegistry.sol";
import {DomainRegistry} from "./DomainRegistry.sol";
import {ReputationRegistry} from "../oracle/ReputationRegistry.sol";
import {Slasher} from "../oracle/Slasher.sol";
import {VerifierRegistry} from "../oracle/VerifierRegistry.sol";
import {ComplianceGate} from "../shield/ComplianceGate.sol";
import {AgentProfile} from "./AgentProfile.sol";

/// @title AgentPrimitivesFactory
/// @notice The self-sovereign replacement for the old AgentFactory. An agent no longer
/// gets its identity contracts deployed on its behalf — it deploys its own
/// \`SovereignAgent\` and \`StateAnchor\` directly, from its own EVM wallet, so those two
/// deployment transactions are themselves the cryptographic proof of self-sovereign
/// control (see docs/INTERFACE_CONTRACT.md's "Agent Primitives" section). This
/// contract's job starts *after* that: given the two agent-deployed addresses, it clones
/// the other 5 primitives (cheap EIP-1167 proxies of shared implementation contracts),
/// initializes each with the agent's SovereignAgent contract as admin — never the raw
/// EOA, per the protocol's call-routing convention — and atomically registers the full
/// 7-address PrimitiveSet into XibalbaAgentRegistry and DomainRegistry so no consumer can
/// ever observe an agent that only half-exists.
/// @dev Bootstrap exception to "SovereignAgent routes everything": this call is EOA-signed
/// directly (SovereignAgent cannot route a call to register itself — that would be
/// circular), verified instead by checking the caller actually holds DEFAULT_ADMIN_ROLE
/// on the SovereignAgent it claims to own. Holds REGISTRAR_ROLE on both registries
/// (granted to this contract's address at deploy time, see script/Deploy.s.sol) — no
/// other contract should hold that role, same reasoning as the old AgentFactory.
contract AgentPrimitivesFactory {
    XibalbaAgentRegistry public immutable registry;
    DomainRegistry public immutable domainRegistry;

    /// @dev The 5 shared implementation contracts that every agent's clones
    /// delegatecall into. Deployed once by script/Deploy.s.sol with
    /// \`_disableInitializers()\` already called on each, so they can never be
    /// initialized/hijacked directly — only clones of them can.
    address public immutable reputationRegistryImpl;
    address public immutable slasherImpl;
    address public immutable verifierRegistryImpl;
    address public immutable complianceGateImpl;
    address public immutable agentProfileImpl;

    /// @dev Protocol-held signers/addresses passed into each clone's \`initialize\` — never
    /// the registering agent's own key. See ReputationRegistry/Slasher NatSpec for why
    /// these are kept distinct from the agent's own admin role.
    address public immutable oracleSigner;
    address public immutable disputer;
    address public immutable governance;
    address public immutable itk;
    address public immutable initialZkVerifier;

    event PrimitivesRegistered(
        bytes32 indexed didHash,
        address indexed sovereignAgent,
        address indexed controller,
        address stateAnchor,
        address reputationRegistry,
        address slasher,
        address verifierRegistry,
        address complianceGate,
        address agentProfile,
        bytes32 domainId
    );

    error NotAgentController();
    error DomainJoinNotApproved();

    constructor(
        address _registry,
        address _domainRegistry,
        address _reputationRegistryImpl,
        address _slasherImpl,
        address _verifierRegistryImpl,
        address _complianceGateImpl,
        address _agentProfileImpl,
        address _oracleSigner,
        address _disputer,
        address _governance,
        address _itk,
        address _initialZkVerifier
    ) {
        registry = XibalbaAgentRegistry(_registry);
        domainRegistry = DomainRegistry(_domainRegistry);
        reputationRegistryImpl = _reputationRegistryImpl;
        slasherImpl = _slasherImpl;
        verifierRegistryImpl = _verifierRegistryImpl;
        complianceGateImpl = _complianceGateImpl;
        agentProfileImpl = _agentProfileImpl;
        oracleSigner = _oracleSigner;
        disputer = _disputer;
        governance = _governance;
        itk = _itk;
        initialZkVerifier = _initialZkVerifier;
    }

    /// @notice Clones and registers the remaining 5 primitives for an agent that has
    /// already (a) deployed its own SovereignAgent, (b) deployed its own StateAnchor
    /// with that SovereignAgent as admin, and (c) routed a call through
    /// \`SovereignAgent.execute\` to grant the protocol's oracle signer ANCHOR_ROLE on
    /// that StateAnchor (see integrity-sdk's registration.py for the exact sequence).
    /// @param sovereignAgent The agent-deployed SovereignAgent address.
    /// @param stateAnchor The agent-deployed StateAnchor address.
    /// @param did The DID string this SovereignAgent was constructed with — re-hashed
    /// here and checked for uniqueness by the registry, same as the old AgentFactory.
    /// @param domainId The domain this agent is registering under.
    /// @param vertical The regulated-industry vertical this agent declares (None for
    /// most agents; Healthcare for Shield-integrated ones).
    /// @param profileURI Off-chain metadata pointer for AgentProfile.
    function registerPrimitives(
        address sovereignAgent,
        address stateAnchor,
        string calldata did,
        bytes32 domainId,
        ComplianceGate.Vertical vertical,
        string calldata profileURI
    )
        external
        returns (
            address reputationRegistry,
            address slasher,
            address verifierRegistry,
            address complianceGate,
            address agentProfile
        )
    {
        SovereignAgent sa = SovereignAgent(payable(sovereignAgent));
        if (!sa.hasRole(sa.DEFAULT_ADMIN_ROLE(), msg.sender)) revert NotAgentController();
        if (!domainRegistry.canJoin(domainId, msg.sender)) revert DomainJoinNotApproved();

        // Every clone's admin is the SovereignAgent contract address, not msg.sender —
        // see the interface contract's call-routing convention. Protocol-held roles
        // (oracle/disputer/governance) are this factory's own immutables, never
        // anything the registering agent controls.
        reputationRegistry = Clones.clone(reputationRegistryImpl);
        ReputationRegistry(reputationRegistry).initialize(sovereignAgent, oracleSigner, initialZkVerifier, stateAnchor);

        slasher = Clones.clone(slasherImpl);
        Slasher(slasher).initialize(governance, disputer);

        verifierRegistry = Clones.clone(verifierRegistryImpl);
        VerifierRegistry(verifierRegistry).initialize(sovereignAgent, initialZkVerifier);

        complianceGate = Clones.clone(complianceGateImpl);
        ComplianceGate(complianceGate).initialize(sovereignAgent, sovereignAgent, vertical);

        agentProfile = Clones.clone(agentProfileImpl);
        AgentProfile(agentProfile).initialize(sovereignAgent, sovereignAgent, domainId, profileURI);

        bytes32 didHash_ = registry.didHash(did);
        registry.registerPrimitives(
            didHash_,
            XibalbaAgentRegistry.PrimitiveSet({
                sovereignAgent: sovereignAgent,
                stateAnchor: stateAnchor,
                reputationRegistry: reputationRegistry,
                slasher: slasher,
                verifierRegistry: verifierRegistry,
                complianceGate: complianceGate,
                agentProfile: agentProfile
            }),
            msg.sender,
            domainId
        );
        domainRegistry.recordJoin(domainId, msg.sender, sovereignAgent);

        emit PrimitivesRegistered(
            didHash_,
            sovereignAgent,
            msg.sender,
            stateAnchor,
            reputationRegistry,
            slasher,
            verifierRegistry,
            complianceGate,
            agentProfile,
            domainId
        );
    }
}
` },
  { name: 'XibalbaAgentRegistry.sol', content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title XibalbaAgentRegistry
/// @notice The canonical index of every self-sovereign agent registered via
/// AgentPrimitivesFactory: maps the off-chain DID (§4.1 of the interface contract) to
/// the full set of 7 on-chain primitive contracts that represent it, and vice versa.
/// @dev This is deliberately a thin index, not a second copy of agent state — each
/// primitive owns its own state (AIS in ReputationRegistry, controller/execute in
/// SovereignAgent, etc). This contract's only job is "given a DID, which 7 addresses are
/// that agent's" and "given the agent's SovereignAgent address, which DID/domain/other
/// primitives go with it". integrity-oracle, integrity-sdk, integrity-cli and
/// EHRGate/ComplianceGate-adjacent consumers all resolve an agent's other primitives
/// through this contract rather than re-deriving the mapping off-chain, so it is the one
/// place that must never disagree with what AgentPrimitivesFactory actually deployed —
/// which is why \`registerPrimitives\` is restricted to REGISTRAR_ROLE (granted only to
/// AgentPrimitivesFactory).
contract XibalbaAgentRegistry is AccessControl {
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    /// @notice The 7 primitive contract addresses that make up one agent's identity.
    /// \`sovereignAgent\` and \`stateAnchor\` are deployed directly by the agent's own
    /// wallet; the other 5 are EIP-1167 clones deployed by AgentPrimitivesFactory in the
    /// same registration transaction. \`sovereignAgent\` is the canonical "this agent's
    /// address" used everywhere downstream (EHRGate, ReputationRegistry's
    /// submitZkAttestation caller check, etc) since that's the address every other
    /// primitive's admin role is granted to.
    struct PrimitiveSet {
        address sovereignAgent;
        address stateAnchor;
        address reputationRegistry;
        address slasher;
        address verifierRegistry;
        address complianceGate;
        address agentProfile;
    }

    struct AgentRecord {
        PrimitiveSet primitives;
        address controller;
        bytes32 domainId;
        uint256 registeredAt;
        bool exists;
    }

    /// @dev keyed by keccak256(bytes(did)) — see DomainRegistry for the same rationale.
    mapping(bytes32 => AgentRecord) private _byDID;
    /// @dev keyed by the agent's SovereignAgent address (not any of the other 6
    /// primitives) — that's the address every downstream consumer already has as
    /// \`msg.sender\` when it needs to look up "which agent is this and what are its
    /// other primitives".
    mapping(address => bytes32) public didHashOf;

    uint256 public totalAgents;

    event AgentRegistered(
        bytes32 indexed didHash, address indexed sovereignAgent, address indexed controller, bytes32 domainId
    );
    event PrimitivesRegistered(bytes32 indexed didHash, PrimitiveSet primitives);

    error AlreadyRegistered();
    error UnknownDID();
    error UnknownAgent();

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function didHash(string memory did) public pure returns (bytes32) {
        return keccak256(bytes(did));
    }

    /// @notice Registers a freshly self-deployed+cloned agent. Called exactly once per
    /// agent, by AgentPrimitivesFactory, immediately after cloning+initializing the 5
    /// proxy primitives.
    function registerPrimitives(bytes32 didHash_, PrimitiveSet calldata primitives, address controller, bytes32 domainId)
        external
        onlyRole(REGISTRAR_ROLE)
    {
        if (_byDID[didHash_].exists) revert AlreadyRegistered();
        _byDID[didHash_] = AgentRecord({
            primitives: primitives,
            controller: controller,
            domainId: domainId,
            registeredAt: block.timestamp,
            exists: true
        });
        didHashOf[primitives.sovereignAgent] = didHash_;
        totalAgents += 1;
        emit AgentRegistered(didHash_, primitives.sovereignAgent, controller, domainId);
        emit PrimitivesRegistered(didHash_, primitives);
    }

    function resolveDID(string calldata did) external view returns (AgentRecord memory record) {
        bytes32 h = didHash(did);
        record = _byDID[h];
        if (!record.exists) revert UnknownDID();
    }

    function resolveDIDHash(bytes32 didHash_) external view returns (AgentRecord memory record) {
        record = _byDID[didHash_];
        if (!record.exists) revert UnknownDID();
    }

    /// @notice Given an agent's SovereignAgent contract address (typically \`msg.sender\`
    /// from the caller's own perspective), resolves its full record including the other
    /// 6 primitive addresses.
    function resolveAgent(address sovereignAgent) external view returns (AgentRecord memory record) {
        bytes32 h = didHashOf[sovereignAgent];
        record = _byDID[h];
        if (!record.exists) revert UnknownAgent();
    }

    function isRegisteredAgent(address sovereignAgent) external view returns (bool) {
        return _byDID[didHashOf[sovereignAgent]].exists;
    }
}
` },
  { name: 'XibalbaNameService.sol', content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {XibalbaAgentRegistry} from "./XibalbaAgentRegistry.sol";

/// @title XibalbaNameService (XNS)
/// @notice Maps human-readable handles (e.g. "hermes.integrity") to a registered agent's
/// \`SovereignAgent\` contract address, so agents don't have to be addressed only by their
/// raw address or DID string. Per the root README's "Vision & long-term roadmap" table
/// and docs/wiki/concepts/xns.md, this was \`[PLANNED]\` — no contract existed anywhere in
/// this rewrite's \`contracts/src/\` until now.
/// @dev **Deliberately NOT a port of the legacy prototype's \`XibalbaNameService.sol\`.**
/// That contract restricted \`register()\` to an admin-only \`REGISTRAR_ROLE\`, i.e. a
/// privileged party registered handles ON BEHALF OF agents — the exact "nothing is
/// registered on behalf of the agent by a privileged factory" violation this whole
/// rewrite's self-sovereign thesis (see root README) was built to eliminate. This
/// version instead follows \`DomainRegistry.registerDomain\`'s already-established pattern
/// in this codebase: self-service, first-come-first-served, no privileged party in the
/// critical path. \`REGISTRAR_ROLE\` here is reserved for dispute intervention only
/// (\`revokeByRegistrar\`), mirroring \`DomainRegistry\`'s own REGISTRAR_ROLE scope — not a
/// normal-path registration mechanism.
contract XibalbaNameService is AccessControl {
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    /// @dev Immutable: the canonical \`XibalbaAgentRegistry\` singleton this deployment of
    /// XNS checks handle-registration eligibility against. A handle can only ever be
    /// claimed by an address \`isRegisteredAgent\` — i.e. a real \`SovereignAgent\` contract
    /// that completed the full self-sovereign registration flow (§6.1/§6.2 of
    /// docs/INTERFACE_CONTRACT.md) — not an arbitrary EOA or contract squatting names
    /// unrelated to any real agent.
    XibalbaAgentRegistry public immutable agentRegistry;

    struct HandleRecord {
        address sovereignAgent;
        uint256 registeredAt;
        bool exists;
    }

    /// @dev keyed by keccak256(bytes(handle)), same rationale as DomainRegistry.domainId:
    /// a fixed-width identifier is cheaper to index on and reused across events/mappings
    /// rather than a string key.
    mapping(bytes32 => HandleRecord) private _byHandle;
    /// @dev handleId => original string, so \`primaryHandle(address)\` can return a
    /// human-readable name rather than a hash back out to callers.
    mapping(bytes32 => string) private _handleName;
    /// @notice sovereignAgent => its current primary handle's id (bytes32(0) if none).
    mapping(address => bytes32) public primaryHandleOf;

    event HandleRegistered(bytes32 indexed handleId, string handle, address indexed sovereignAgent);
    event HandleRevoked(bytes32 indexed handleId, string handle, address indexed sovereignAgent);
    event PrimaryHandleChanged(address indexed sovereignAgent, bytes32 indexed handleId);

    error EmptyHandle();
    error NotRegisteredAgent();
    error HandleAlreadyRegistered();
    error HandleNotFound();
    error NotHandleOwner();

    constructor(address admin, address agentRegistry_) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        agentRegistry = XibalbaAgentRegistry(agentRegistry_);
    }

    function handleId(string memory handle) public pure returns (bytes32) {
        return keccak256(bytes(handle));
    }

    /// @notice Self-service handle registration. \`msg.sender\` must itself be a
    /// registered agent's \`SovereignAgent\` address (verified live against
    /// \`XibalbaAgentRegistry\`, not merely asserted) — matching how every other
    /// agent-facing contract in this codebase (\`ComplianceGate\`, \`EHRGate\`) treats the
    /// calling \`SovereignAgent\` contract as the acting agent's identity. First unclaimed
    /// handle wins, same trust model as \`DomainRegistry.registerDomain\`/ENS
    /// second-level names. An agent's first registered handle becomes its primary
    /// automatically; use \`setPrimaryHandle\` to change that later.
    function register(string calldata handle) external returns (bytes32 id) {
        if (bytes(handle).length == 0) revert EmptyHandle();
        if (!agentRegistry.isRegisteredAgent(msg.sender)) revert NotRegisteredAgent();

        id = handleId(handle);
        if (_byHandle[id].exists) revert HandleAlreadyRegistered();

        _byHandle[id] = HandleRecord({sovereignAgent: msg.sender, registeredAt: block.timestamp, exists: true});
        _handleName[id] = handle;
        emit HandleRegistered(id, handle, msg.sender);

        if (primaryHandleOf[msg.sender] == bytes32(0)) {
            primaryHandleOf[msg.sender] = id;
            emit PrimaryHandleChanged(msg.sender, id);
        }
    }

    /// @notice Lets an agent with multiple handles choose which one \`primaryHandle\`
    /// returns for it. Self-service — no registrar involved.
    function setPrimaryHandle(string calldata handle) external {
        bytes32 id = handleId(handle);
        HandleRecord storage rec = _byHandle[id];
        if (!rec.exists) revert HandleNotFound();
        if (rec.sovereignAgent != msg.sender) revert NotHandleOwner();
        primaryHandleOf[msg.sender] = id;
        emit PrimaryHandleChanged(msg.sender, id);
    }

    /// @notice Voluntary self-release of a handle the caller itself owns (e.g. to free
    /// it up, or before an agent decommissions).
    function release(string calldata handle) external {
        bytes32 id = handleId(handle);
        HandleRecord storage rec = _byHandle[id];
        if (!rec.exists) revert HandleNotFound();
        if (rec.sovereignAgent != msg.sender) revert NotHandleOwner();
        _revoke(id, handle, rec.sovereignAgent);
    }

    /// @notice Dispute-intervention path (e.g. a name used for impersonation, or a
    /// compromised agent) — mirrors \`DomainRegistry\`'s REGISTRAR_ROLE scope exactly:
    /// reserved for governance intervention, not a normal-path registration mechanism.
    /// Granted to nothing by default; a deploy script must explicitly grant it if this
    /// capability is wanted, same as every other REGISTRAR_ROLE in this codebase.
    function revokeByRegistrar(string calldata handle) external onlyRole(REGISTRAR_ROLE) {
        bytes32 id = handleId(handle);
        HandleRecord storage rec = _byHandle[id];
        if (!rec.exists) revert HandleNotFound();
        _revoke(id, handle, rec.sovereignAgent);
    }

    function _revoke(bytes32 id, string calldata handle, address owner) private {
        delete _byHandle[id];
        delete _handleName[id];
        if (primaryHandleOf[owner] == id) {
            delete primaryHandleOf[owner];
        }
        emit HandleRevoked(id, handle, owner);
    }

    /// @notice Resolves a handle to the agent's \`SovereignAgent\` address. Reverts on an
    /// unregistered/revoked handle rather than returning \`address(0)\` — callers that
    /// want a non-reverting existence check should use \`handleExists\` first.
    function resolve(string calldata handle) external view returns (address sovereignAgent) {
        HandleRecord storage rec = _byHandle[handleId(handle)];
        if (!rec.exists) revert HandleNotFound();
        return rec.sovereignAgent;
    }

    function handleExists(string calldata handle) external view returns (bool) {
        return _byHandle[handleId(handle)].exists;
    }

    /// @notice Returns the human-readable primary handle for an agent, or "" if it has
    /// none registered.
    function primaryHandle(address sovereignAgent) external view returns (string memory) {
        return _handleName[primaryHandleOf[sovereignAgent]];
    }
}
` },
  { name: 'AgentProfile.sol', content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {DomainRegistry} from "./DomainRegistry.sol";

/// @title AgentProfile
/// @notice Per-agent EIP-1167 clone holding a fast, agent-controlled read surface for
/// off-chain profile metadata (capabilities, service description) and a pointer to the
/// agent's primary domain.
/// @dev Domain membership itself is NOT tracked here — \`DomainRegistry.isMember\` remains
/// the single source of truth (you cannot answer "who is in healthcare.integrity" by
/// scanning N independent AgentProfile clones). \`primaryDomain\` below is only a
/// self-reported pointer for indexers/UI; \`isDomainMember\` cross-checks it live against
/// the shared registry so a consumer never has to trust the pointer by itself.
contract AgentProfile is Initializable, AccessControlUpgradeable {
    /// @dev Shared across every clone — see ComplianceGate for the same
    /// immutable-baked-into-the-implementation pattern.
    DomainRegistry public immutable domainRegistry;

    address public agent;
    bytes32 public primaryDomain;
    string public profileURI;

    event ProfileUpdated(bytes32 primaryDomain, string profileURI);

    constructor(address _domainRegistry) {
        domainRegistry = DomainRegistry(_domainRegistry);
        _disableInitializers();
    }

    function initialize(address _agent, address admin, bytes32 _primaryDomain, string calldata _profileURI)
        external
        initializer
    {
        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        agent = _agent;
        primaryDomain = _primaryDomain;
        profileURI = _profileURI;
        emit ProfileUpdated(_primaryDomain, _profileURI);
    }

    /// @notice Updates the agent's self-reported domain pointer and metadata URI.
    /// Routed through the agent's SovereignAgent.execute per the protocol's call-routing
    /// convention (admin == the agent's SovereignAgent address).
    function setProfile(bytes32 _primaryDomain, string calldata _profileURI) external onlyRole(DEFAULT_ADMIN_ROLE) {
        primaryDomain = _primaryDomain;
        profileURI = _profileURI;
        emit ProfileUpdated(_primaryDomain, _profileURI);
    }

    /// @notice Live cross-check against the shared DomainRegistry — callers should use
    /// this, not raw \`primaryDomain\`, whenever membership actually needs to be trusted.
    function isDomainMember() external view returns (bool) {
        return domainRegistry.isMember(primaryDomain, agent);
    }
}
` },
  { name: 'CoveredEntityRegistry.sol', content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title CoveredEntityRegistry
/// @notice Registry of HIPAA "Covered Entities" and "Business Associates" (the two party
/// types a Business Associate Agreement, see shield/SmartBAA.sol, is signed between).
/// @dev Registration is admin/REGISTRAR_ROLE-gated rather than permissionless: unlike a
/// generic domain (framework/DomainRegistry.sol), being listed here is a claim of actual
/// legal HIPAA status, which isn't something a smart contract can verify on its own —
/// it has to be vetted off-chain (by Xibalba Solutions or a delegated auditor) before
/// being anchored here. Everything downstream (SmartBAAFactory, EHRGate,
/// HIPAAGuardrailRegistry) trusts this registry as the root of "is this actually a
/// covered entity/BA", so the registrar role should be held by a small, audited set of
/// keys, not left open.
contract CoveredEntityRegistry is AccessControl {
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    enum EntityType {
        Unregistered,
        CoveredEntity,
        BusinessAssociate
    }

    struct Entity {
        EntityType entityType;
        string metadataURI; // off-chain profile (legal name, NPI, jurisdiction, etc.)
        bool active;
    }

    mapping(address => Entity) public entities;

    event EntityRegistered(address indexed entity, EntityType entityType, string metadataURI);
    event EntityRevoked(address indexed entity);

    error UnknownEntityType();

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(REGISTRAR_ROLE, admin);
    }

    function registerEntity(address entity, EntityType entityType, string calldata metadataURI)
        external
        onlyRole(REGISTRAR_ROLE)
    {
        if (entityType == EntityType.Unregistered) revert UnknownEntityType();
        entities[entity] = Entity({entityType: entityType, metadataURI: metadataURI, active: true});
        emit EntityRegistered(entity, entityType, metadataURI);
    }

    function revokeEntity(address entity) external onlyRole(REGISTRAR_ROLE) {
        entities[entity].active = false;
        emit EntityRevoked(entity);
    }

    function isActiveCoveredEntity(address entity) external view returns (bool) {
        Entity storage e = entities[entity];
        return e.active && e.entityType == EntityType.CoveredEntity;
    }

    function isActiveBusinessAssociate(address entity) external view returns (bool) {
        Entity storage e = entities[entity];
        return e.active && e.entityType == EntityType.BusinessAssociate;
    }
}
` },
  { name: 'ComplianceGate.sol', content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {CoveredEntityRegistry} from "./CoveredEntityRegistry.sol";
import {SmartBAAFactory} from "./SmartBAAFactory.sol";

/// @title ComplianceGate
/// @notice Per-agent EIP-1167 clone declaring which regulated vertical (if any) an agent
/// operates in, and exposing a single live read that other packages (integrity-oracle's
/// S_compliance AIS component, integrity-dashboard's Shield panel) can call without
/// needing to know Shield's internal multi-contract structure.
/// @dev Never fakes compliance: \`isHealthcareCompliant\` returns false unless the agent
/// declared \`Vertical.Healthcare\` AND a live on-chain read against the real,
/// already-tested \`CoveredEntityRegistry\`/\`SmartBAAFactory\` stack passes. The
/// self-declared flags below (mirroring integrity_sdk/telemetry/conventions.py's
/// \`IntegrityAttributes.COMPLIANCE_*\` span attributes) are exactly that — self-declared,
/// off-chain-attested claims — and are kept separate from the live-verified boolean so
/// no consumer can confuse the two. This contract does NOT replace \`EHRGate\` as the
/// PHI-access enforcement boundary; EHRGate still performs its own live checks at access
/// time. ComplianceGate is a read-optimized compliance summary, not a second enforcement
/// point.
contract ComplianceGate is Initializable, AccessControlUpgradeable {
    /// @dev New values appended after Healthcare -- existing numeric ids (None=0,
    /// Healthcare=1) never change, so this extension is additive-only and does not
    /// disturb any already-declared agent's stored vertical. PredictionMarket/Trading
    /// map to the same \`IntegrityMarket\`/\`MarketFactory\` application layer;
    /// CapitalAllocation maps to \`A2ACapitalPool\`. None of these verticals have a
    /// live-verified \`is*Compliant\` read yet (unlike Healthcare's
    /// \`isHealthcareCompliant\`) -- they exist so an agent can declare its operating
    /// domain for dashboard badges/discovery, same as Healthcare's self-declared flags,
    /// without implying an equivalent regulatory-grade on-chain check exists for them.
    enum Vertical {
        None,
        Healthcare,
        PredictionMarket,
        Trading,
        CapitalAllocation
    }

    /// @dev Shared across every clone: baked into the implementation contract's runtime
    /// bytecode at its own one-time deployment. EIP-1167 clones delegatecall into that
    /// bytecode, so every agent's clone reads the SAME immutable Shield registry
    /// addresses — exactly the intent, since domain-level compliance infrastructure
    /// stays global while only the per-agent declaration/state is cloned.
    CoveredEntityRegistry public immutable coveredEntityRegistry;
    SmartBAAFactory public immutable baaFactory;

    address public agent;
    Vertical public vertical;

    // Self-declared, off-chain-attested flags — mirror telemetry/conventions.py's
    // IntegrityAttributes.COMPLIANCE_* span attributes. Never consulted by
    // isHealthcareCompliant, which only trusts live on-chain state.
    bool public hipaaEligible;
    bool public zdrEnabled;
    bool public externalWebAccessDeclared;
    string public dataResidencyRegion;

    event VerticalDeclared(address indexed agent, Vertical vertical);
    event SelfDeclaredComplianceUpdated(
        bool hipaaEligible, bool zdrEnabled, bool externalWebAccessDeclared, string dataResidencyRegion
    );

    constructor(address _coveredEntityRegistry, address _baaFactory) {
        coveredEntityRegistry = CoveredEntityRegistry(_coveredEntityRegistry);
        baaFactory = SmartBAAFactory(_baaFactory);
        _disableInitializers();
    }

    function initialize(address _agent, address admin, Vertical _vertical) external initializer {
        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        agent = _agent;
        vertical = _vertical;
        emit VerticalDeclared(_agent, _vertical);
    }

    /// @notice Updates the agent's self-declared (not on-chain-verified) compliance
    /// posture. Routed through the agent's SovereignAgent.execute per the protocol's
    /// call-routing convention (admin == the agent's SovereignAgent address).
    function setSelfDeclaredCompliance(
        bool _hipaaEligible,
        bool _zdrEnabled,
        bool _externalWebAccessDeclared,
        string calldata _dataResidencyRegion
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        hipaaEligible = _hipaaEligible;
        zdrEnabled = _zdrEnabled;
        externalWebAccessDeclared = _externalWebAccessDeclared;
        dataResidencyRegion = _dataResidencyRegion;
        emit SelfDeclaredComplianceUpdated(
            _hipaaEligible, _zdrEnabled, _externalWebAccessDeclared, _dataResidencyRegion
        );
    }

    /// @notice True only if this agent declared the Healthcare vertical AND a live,
    /// currently-Active BAA exists between \`coveredEntity\` and this agent. Never returns
    /// true based on self-declared flags alone.
    function isHealthcareCompliant(address coveredEntity) external view returns (bool) {
        if (vertical != Vertical.Healthcare) return false;
        if (!coveredEntityRegistry.isActiveCoveredEntity(coveredEntity)) return false;
        return baaFactory.isBAAActive(coveredEntity, agent);
    }
}
` },
  { name: 'EHRGate.sol', content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ReputationRegistry} from "../oracle/ReputationRegistry.sol";
import {SmartBAAFactory} from "./SmartBAAFactory.sol";
import {XibalbaAgentRegistry} from "../framework/XibalbaAgentRegistry.sol";

/// @title EHRGate
/// @notice Patient-controlled access gate for AI agents requesting PHI (Protected Health
/// Information), with two additional institutional-level checks layered on top of raw
/// patient consent: an active Business Associate Agreement between the record's covered
/// entity and the requesting agent, and a minimum on-chain reputation score.
/// @dev The old prototype's EHRGate only ever checked patient consent — it never
/// actually enforced the BAA or reputation side of HIPAA compliance on-chain, so a
/// patient who consented had no real protection against a low-reputation or
/// contractually-unbound agent. All three checks are now required simultaneously
/// (patient consent AND active BAA AND AIS >= threshold): consent alone is necessary
/// but not sufficient — a patient can be tricked into granting access, but they cannot
/// grant access to an agent lacking institutional accountability.
///
/// Reputation used to be read from one immutable, global \`ReputationRegistry\`. Now that
/// every agent owns its own \`ReputationRegistry\` clone (see AgentPrimitivesFactory),
/// there is no single address to point at — this contract instead holds the shared
/// \`XibalbaAgentRegistry\` index and resolves \`msg.sender\`'s own clone address on every
/// call. That resolution is itself a meaningful check: an address that was never
/// registered through AgentPrimitivesFactory has no entry in the registry, so
/// \`checkAccess\` reverts before it can even reach the reputation check, closing off any
/// attempt to gate access using a hand-rolled contract that only pretends to be a
/// Sovereign Agent.
contract EHRGate {
    struct Gate {
        address coveredEntity;
        bool isUnlocked;
        uint256 grantedAt;
    }

    XibalbaAgentRegistry public immutable registry;
    SmartBAAFactory public immutable baaFactory;

    /// @notice Minimum effective AIS (post ZK-boost) an agent must hold to access PHI.
    /// Mutable (not immutable) because the AIS scale/formula weights are configurable
    /// per §4.3 and this threshold should move with them, not be frozen at deploy time.
    uint256 public minAisThreshold;
    address public admin;

    // patient => recordHash => agent => Gate
    mapping(address => mapping(bytes32 => mapping(address => Gate))) public accessGates;

    event AccessGranted(address indexed patient, bytes32 indexed recordHash, address indexed agent, address coveredEntity);
    event AccessRevoked(address indexed patient, bytes32 indexed recordHash, address indexed agent);
    event AccessLogged(address indexed patient, bytes32 indexed recordHash, address indexed agent, bool successful);
    event ThresholdUpdated(uint256 newThreshold);

    error NotAdmin();
    error GateAlreadyUnlocked();

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    constructor(address _registry, address _baaFactory, uint256 _minAisThreshold, address _admin) {
        registry = XibalbaAgentRegistry(_registry);
        baaFactory = SmartBAAFactory(_baaFactory);
        minAisThreshold = _minAisThreshold;
        admin = _admin;
    }

    function setThreshold(uint256 newThreshold) external onlyAdmin {
        minAisThreshold = newThreshold;
        emit ThresholdUpdated(newThreshold);
    }

    /// @notice The patient explicitly grants a specific agent access to a specific
    /// record, scoped to the covered entity that holds it (so the BAA check below has
    /// something concrete to check against).
    function grantAccess(bytes32 recordHash, address agent, address coveredEntity) external {
        Gate storage g = accessGates[msg.sender][recordHash][agent];
        if (g.isUnlocked) revert GateAlreadyUnlocked();
        g.coveredEntity = coveredEntity;
        g.isUnlocked = true;
        g.grantedAt = block.timestamp;
        emit AccessGranted(msg.sender, recordHash, agent, coveredEntity);
    }

    function revokeAccess(bytes32 recordHash, address agent) external {
        accessGates[msg.sender][recordHash][agent].isUnlocked = false;
        emit AccessRevoked(msg.sender, recordHash, agent);
    }

    /// @notice Checks all three gating conditions for \`msg.sender\` (expected to be the
    /// requesting SovereignAgent contract) against \`patient\`'s record. Returns \`false\`
    /// (does not revert) if \`msg.sender\` was never registered through
    /// AgentPrimitivesFactory, so that \`verifyAndLogAccess\` can still emit an auditable
    /// "denied" entry for a rogue caller instead of the whole call reverting and leaving
    /// no on-chain trace of the attempt.
    function checkAccess(address patient, bytes32 recordHash) public view returns (bool) {
        Gate storage g = accessGates[patient][recordHash][msg.sender];
        if (!g.isUnlocked) return false;
        if (!baaFactory.isBAAActive(g.coveredEntity, msg.sender)) return false;
        if (!registry.isRegisteredAgent(msg.sender)) return false;
        address reputationRegistry = registry.resolveAgent(msg.sender).primitives.reputationRegistry;
        if (ReputationRegistry(reputationRegistry).effectiveScore(msg.sender) < minAisThreshold) return false;
        return true;
    }

    /// @notice Same check as \`checkAccess\`, but emits an auditable log either way —
    /// intended to be called immediately before an agent performs off-chain inference
    /// over PHI, so there's an on-chain record of every access attempt (granted or
    /// denied) that integrity-oracle/bcc_middleware can correlate with the OPA policy
    /// decision made for the same request.
    function verifyAndLogAccess(address patient, bytes32 recordHash) external returns (bool) {
        bool granted = checkAccess(patient, recordHash);
        emit AccessLogged(patient, recordHash, msg.sender, granted);
        return granted;
    }
}
` },
  { name: 'HIPAAGuardrailRegistry.sol', content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title HIPAAGuardrailRegistry
/// @notice Anchors which version of the off-chain OPA HIPAA policy bundle
/// (\`bcc_middleware/policies/*.rego\`, §7 of the interface contract) is currently in
/// effect, and lets the oracle stamp an immutable, on-chain audit trail entry for each
/// PHI access decision bcc_middleware makes, referencing the exact policy hash that
/// governed it.
/// @dev This contract does not evaluate OPA policy itself — bcc_middleware and
/// integrity-sdk are the only components that call OPA's REST API (§7: "no local
/// regex-only fallback path"). What this contract adds is something OPA alone can't
/// give you: a tamper-evident, third-party-auditable record of *which* policy version
/// was live when a given decision was made, so a covered entity's later audit can
/// verify "the agent's access request was evaluated against policy version X" without
/// trusting bcc_middleware's own logs.
contract HIPAAGuardrailRegistry is AccessControl {
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    bytes32 public activePolicyHash;
    string public activePolicyVersion;
    uint256 public activeSince;

    struct AuditEntry {
        address agent;
        bytes32 patientRecordHash;
        bytes32 policyHash;
        bool allowed;
        uint256 timestamp;
    }

    AuditEntry[] public auditLog;

    event PolicyActivated(bytes32 indexed policyHash, string version, uint256 timestamp);
    event AccessAudited(
        uint256 indexed entryIndex,
        address indexed agent,
        bytes32 indexed patientRecordHash,
        bytes32 policyHash,
        bool allowed
    );

    error StalePolicyHash();
    error NoActivePolicy();

    constructor(address admin, address oracle) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        if (oracle != address(0)) {
            _grantRole(ORACLE_ROLE, oracle);
        }
    }

    /// @notice Marks a new OPA policy bundle hash (e.g. keccak256 of the concatenated
    /// \`.rego\` sources bcc_middleware just loaded) as the currently active one.
    function setActivePolicy(bytes32 policyHash, string calldata version) external onlyRole(DEFAULT_ADMIN_ROLE) {
        activePolicyHash = policyHash;
        activePolicyVersion = version;
        activeSince = block.timestamp;
        emit PolicyActivated(policyHash, version, block.timestamp);
    }

    /// @notice Anchors an audit entry for one PHI access decision. \`policyHashUsed\` must
    /// match whatever is currently marked active — this is what stops bcc_middleware (or
    /// a compromised oracle key) from retroactively claiming a stale or never-active
    /// policy version governed some past decision; the two must agree in real time.
    function anchorAccessAudit(address agent, bytes32 patientRecordHash, bytes32 policyHashUsed, bool allowed)
        external
        onlyRole(ORACLE_ROLE)
        returns (uint256 entryIndex)
    {
        if (activePolicyHash == bytes32(0)) revert NoActivePolicy();
        if (policyHashUsed != activePolicyHash) revert StalePolicyHash();

        entryIndex = auditLog.length;
        auditLog.push(
            AuditEntry({
                agent: agent,
                patientRecordHash: patientRecordHash,
                policyHash: policyHashUsed,
                allowed: allowed,
                timestamp: block.timestamp
            })
        );

        emit AccessAudited(entryIndex, agent, patientRecordHash, policyHashUsed, allowed);
    }

    function auditLogLength() external view returns (uint256) {
        return auditLog.length;
    }
}
` },
  { name: 'SmartBAAFactory.sol', content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {CoveredEntityRegistry} from "./CoveredEntityRegistry.sol";
import {SmartBAA} from "./SmartBAA.sol";

/// @title SmartBAAFactory
/// @notice Deploys one SmartBAA escrow per (covered entity, business associate) pair,
/// and is the canonical lookup other shield contracts (EHRGate, HIPAAGuardrailRegistry)
/// use to answer "is there an active BAA between this hospital and this agent".
/// @dev Enforces the entity-registry check exactly once, here, rather than inside
/// SmartBAA itself — SmartBAA has no idea CoveredEntityRegistry exists, which keeps it
/// a small, easily audited escrow rather than a contract that also has to reason about
/// registry trust.
contract SmartBAAFactory is AccessControl {
    CoveredEntityRegistry public immutable entityRegistry;
    address public immutable itk;
    address public arbitrator;

    /// @dev coveredEntity => businessAssociate => deployed SmartBAA address.
    mapping(address => mapping(address => address)) public baaOf;

    event BAACreated(address indexed coveredEntity, address indexed businessAssociate, address baa, bytes32 agreementHash);
    event ArbitratorUpdated(address indexed newArbitrator);

    error NotActiveCoveredEntity();
    error BAAAlreadyExists();

    constructor(address _entityRegistry, address _itk, address _arbitrator, address admin) {
        entityRegistry = CoveredEntityRegistry(_entityRegistry);
        itk = _itk;
        arbitrator = _arbitrator;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function setArbitrator(address newArbitrator) external onlyRole(DEFAULT_ADMIN_ROLE) {
        arbitrator = newArbitrator;
        emit ArbitratorUpdated(newArbitrator);
    }

    /// @notice Creates a new BAA escrow between \`msg.sender\` (must be a registered,
    /// active Covered Entity) and \`businessAssociate\` (any Sovereign Agent address —
    /// deliberately not required to be pre-registered anywhere, since "being a business
    /// associate" is exactly the status this agreement itself establishes).
    function createBAA(address businessAssociate, bytes32 agreementHash, uint256 requiredCollateral)
        external
        returns (address baa)
    {
        if (!entityRegistry.isActiveCoveredEntity(msg.sender)) revert NotActiveCoveredEntity();
        if (baaOf[msg.sender][businessAssociate] != address(0)) revert BAAAlreadyExists();

        baa = address(
            new SmartBAA(msg.sender, businessAssociate, arbitrator, agreementHash, requiredCollateral, itk)
        );
        baaOf[msg.sender][businessAssociate] = baa;

        emit BAACreated(msg.sender, businessAssociate, baa, agreementHash);
    }

    /// @notice True only if a BAA exists between the pair AND it is currently Active —
    /// the single check EHRGate/HIPAAGuardrailRegistry need before permitting PHI access.
    function isBAAActive(address coveredEntity, address businessAssociate) external view returns (bool) {
        address baa = baaOf[coveredEntity][businessAssociate];
        if (baa == address(0)) return false;
        return SmartBAA(baa).status() == SmartBAA.Status.Active;
    }
}
` },
  { name: 'SmartBAA.sol', content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title SmartBAA
/// @notice An on-chain Business Associate Agreement: a HIPAA Covered Entity and a
/// Sovereign Agent (acting as the Business Associate) post a hash of their off-chain
/// legal agreement, and the agent posts \$ITK collateral that can be slashed to the
/// covered entity if an arbitrator finds a breach.
/// @dev One instance per (coveredEntity, businessAssociate) pair, deployed by
/// SmartBAAFactory — never constructed directly, so \`entityRegistry\`-gating of who may
/// even become a covered entity happens once, at the factory, rather than being
/// re-checked (or forgotten) in every instance.
///
/// Collateral model is intentionally simple (a single ITK balance held by this
/// contract), unlike the old prototype's ISOLATED/POOLED escrow split against a shared
/// staking vault — pooled collateral shared across many BAAs means a slash on one
/// agreement can be starved by withdrawals from an unrelated one. Isolated,
/// per-agreement collateral can't have that cross-contamination: what's locked here is
/// only ever this agreement's.
contract SmartBAA is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Status {
        Proposed,
        Active,
        Disputed,
        Terminated
    }

    address public immutable coveredEntity;
    address public immutable businessAssociate;
    address public immutable arbitrator;
    bytes32 public immutable agreementHash;
    uint256 public immutable requiredCollateral;
    IERC20 public immutable itk;

    Status public status;

    event BAASigned(address indexed businessAssociate, uint256 collateral);
    event DisputeRaised(address indexed coveredEntity);
    event DisputeResolved(bool slashed);
    event BAARevoked(address indexed by);

    error NotCoveredEntity();
    error NotBusinessAssociate();
    error NotArbitrator();
    error WrongStatus(Status current);

    modifier onlyCE() {
        if (msg.sender != coveredEntity) revert NotCoveredEntity();
        _;
    }

    modifier onlyBA() {
        if (msg.sender != businessAssociate) revert NotBusinessAssociate();
        _;
    }

    modifier onlyArbitrator() {
        if (msg.sender != arbitrator) revert NotArbitrator();
        _;
    }

    constructor(
        address _coveredEntity,
        address _businessAssociate,
        address _arbitrator,
        bytes32 _agreementHash,
        uint256 _requiredCollateral,
        address _itk
    ) {
        coveredEntity = _coveredEntity;
        businessAssociate = _businessAssociate;
        arbitrator = _arbitrator;
        agreementHash = _agreementHash;
        requiredCollateral = _requiredCollateral;
        itk = IERC20(_itk);
        status = Status.Proposed;
    }

    /// @notice The business associate posts collateral and activates the agreement.
    function sign() external onlyBA nonReentrant {
        if (status != Status.Proposed) revert WrongStatus(status);
        status = Status.Active;
        itk.safeTransferFrom(msg.sender, address(this), requiredCollateral);
        emit BAASigned(msg.sender, requiredCollateral);
    }

    /// @notice The covered entity flags a suspected breach, freezing the agreement
    /// (collateral can no longer be returned via \`revoke\`) pending arbitration.
    function raiseDispute() external onlyCE {
        if (status != Status.Active) revert WrongStatus(status);
        status = Status.Disputed;
        emit DisputeRaised(msg.sender);
    }

    /// @notice The arbitrator (set once at deployment — see SmartBAAFactory, expected to
    /// be a neutral/governance address, not either party) resolves an open dispute.
    /// @param slash If true, all posted collateral is transferred to the covered entity
    /// as compensation and the agreement terminates. If false, the dispute is dismissed
    /// and the agreement returns to Active — a dismissed accusation shouldn't
    /// automatically end an otherwise-compliant business relationship.
    function arbitrate(bool slash) external onlyArbitrator nonReentrant {
        if (status != Status.Disputed) revert WrongStatus(status);

        if (slash) {
            status = Status.Terminated;
            uint256 balance = itk.balanceOf(address(this));
            if (balance > 0) {
                itk.safeTransfer(coveredEntity, balance);
            }
        } else {
            status = Status.Active;
        }

        emit DisputeResolved(slash);
    }

    /// @notice Either party can end the agreement by mutual absence of dispute —
    /// collateral returns to the business associate. Cannot be called while Disputed,
    /// so a party under active accusation can't dodge arbitration by unilaterally
    /// revoking.
    function revoke() external nonReentrant {
        if (msg.sender != coveredEntity && msg.sender != businessAssociate) revert NotCoveredEntity();
        if (status != Status.Active) revert WrongStatus(status);
        status = Status.Terminated;

        uint256 balance = itk.balanceOf(address(this));
        if (balance > 0) {
            itk.safeTransfer(businessAssociate, balance);
        }
        emit BAARevoked(msg.sender);
    }
}
` },
  { name: 'IntegrityMarket.sol', content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {XibalbaAgentRegistry} from "../framework/XibalbaAgentRegistry.sol";
import {ReputationRegistry} from "../oracle/ReputationRegistry.sol";

/// @title IntegrityMarket
/// @notice Generic AIS-gated, ITK-staked outcome market. Backs both prediction markets
/// (N outcomes, e.g. "who wins the election") and binary options (the 2-outcome case,
/// e.g. "will BTC > \$100k by Friday") as the exact same on-chain primitive -- one real,
/// tested contract instead of two half-built ones for what is mechanically identical
/// pari-mutuel settlement.
/// @dev EIP-1167 clone template, deployed per-market by \`MarketFactory\` -- NOT a
/// directly-deployed singleton. This is deliberate: the protocol's core thesis is that
/// agents own and deploy their own smart contracts, not just for identity (the 7
/// primitives) but at the *application* layer too. Any registered agent can call
/// \`MarketFactory.deployMarket(...)\` to deploy and own its own customized market
/// instance -- its own question, outcome structure, AIS-entry bar, deadline, and choice
/// of resolver. One clone == one market, so "an agent creates a new market" is just
/// another cheap clone, exactly like ReputationRegistry/Slasher/etc are cloned per agent.
///
/// Every position is gated on the caller's LIVE effective AIS (read from its own
/// ReputationRegistry clone via XibalbaAgentRegistry, mirroring EHRGate's resolution
/// pattern) so only agents with an actual track record can enter high-stakes markets.
///
/// *** TRUST BOUNDARY, DOCUMENTED NOT HIDDEN ***
/// \`resolve()\` is gated to RESOLVER_ROLE, set at \`initialize()\` time by the market's
/// creator (who may name itself, the protocol's demo signer, or any other address as
/// resolver). For the investor/developer MVP this is a clearly-labeled demo resolver --
/// there is no live Chainlink/UMA price feed wired in. Staking, AIS-gating, BCC-
/// commitment binding, and payout are all real; only ground-truth outcome resolution is
/// a documented, swappable trust boundary. A production deployment would point
/// RESOLVER_ROLE at a real oracle network; the contract's interface does not change.
///
/// Fraud/misreporting (an agent's BCC-committed intent not matching its actual position)
/// is NOT handled inside this contract -- it is surfaced by integrity-oracle comparing
/// telemetry/BCC commitments against on-chain positions, which then raises a dispute on
/// the offending agent's own Slasher clone (the existing, already-tested mechanism).
/// Keeping that logic out of IntegrityMarket keeps this contract a small, auditable
/// escrow rather than a second slashing engine.
contract IntegrityMarket is Initializable, AccessControlUpgradeable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant RESOLVER_ROLE = keccak256("RESOLVER_ROLE");

    /// @dev Shared across every clone via the implementation contract's own immutable
    /// storage (same rationale as ComplianceGate's coveredEntityRegistry/baaFactory):
    /// every market clone delegatecalls into the same bytecode and so reads the same
    /// \$ITK and agent-registry addresses for free, without a per-clone storage write.
    IERC20 public immutable itk;
    XibalbaAgentRegistry public immutable agentRegistry;

    address public creator;
    string public question;
    uint8 public outcomeCount;
    uint256 public minAisToEnter;
    uint256 public resolveDeadline;
    bool public resolved;
    uint8 public winningOutcome;
    uint256 public totalStaked;

    struct Position {
        uint256 amount;
        uint8 outcomeIndex;
        bytes32 bccCommitmentHash;
        bool claimed;
    }

    mapping(uint8 => uint256) public outcomeStaked;
    mapping(address => Position) public positions;

    event MarketInitialized(
        address indexed creator, string question, uint8 outcomeCount, uint256 minAisToEnter, uint256 resolveDeadline, address indexed resolver
    );
    event PositionEntered(address indexed agent, uint8 outcomeIndex, uint256 amount, bytes32 bccCommitmentHash);
    event MarketResolved(uint8 winningOutcome, address indexed resolver);
    event PayoutClaimed(address indexed agent, uint256 amount);

    error InvalidOutcomeCount();
    error MarketAlreadyResolved();
    error MarketNotYetResolvable();
    error InvalidOutcomeIndex();
    error ZeroAmount();
    error AgentNotRegistered();
    error AisTooLow(uint256 required, uint256 actual);
    error AlreadyHasPosition();
    error MarketNotResolved();
    error NoPosition();
    error AlreadyClaimed();
    error LosingPosition();

    /// @dev Implementation contract is never itself initializable -- only clones
    /// (Clones.clone(marketImpl), via MarketFactory) are. Same OZ upgradeable-safety
    /// pattern used by ReputationRegistry/Slasher/VerifierRegistry/ComplianceGate.
    constructor(address _itk, address _agentRegistry) {
        itk = IERC20(_itk);
        agentRegistry = XibalbaAgentRegistry(_agentRegistry);
        _disableInitializers();
    }

    /// @param _creator The deploying agent's SovereignAgent address (MarketFactory
    /// passes msg.sender through) -- gets DEFAULT_ADMIN_ROLE, per the protocol's
    /// call-routing convention, so only that agent (acting through its own \`execute\`)
    /// can ever administer settings on a market it doesn't otherwise expose setters for.
    /// @param resolver Gets RESOLVER_ROLE. May be the creator itself (self-resolved
    /// demo market), the protocol's demo signer, or any other address the creator
    /// names -- see contract-level NatSpec on the resolver trust boundary.
    function initialize(
        address _creator,
        string calldata _question,
        uint8 _outcomeCount,
        uint256 _minAisToEnter,
        uint256 _resolveDeadline,
        address resolver
    ) external initializer {
        if (_outcomeCount < 2) revert InvalidOutcomeCount();
        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, _creator);
        if (resolver != address(0)) {
            _grantRole(RESOLVER_ROLE, resolver);
        }
        creator = _creator;
        question = _question;
        outcomeCount = _outcomeCount;
        minAisToEnter = _minAisToEnter;
        resolveDeadline = _resolveDeadline;
        emit MarketInitialized(_creator, _question, _outcomeCount, _minAisToEnter, _resolveDeadline, resolver);
    }

    /// @notice Enters a staked position on one outcome. \`msg.sender\` is expected to be
    /// the agent's own SovereignAgent contract (per the protocol's call-routing
    /// convention), which is what \`agentRegistry.resolveAgent\` resolves against -- same
    /// pattern as EHRGate.checkAccess. \`bccCommitmentHash\` binds this position to the
    /// off-chain BCC commitment (see docs/INTERFACE_CONTRACT.md §4.2) the agent signed
    /// BEFORE entering, so the position is provably the agent's own pre-committed call,
    /// not a reaction to information it obtained after the fact.
    function enterPosition(uint8 outcomeIndex, uint256 amount, bytes32 bccCommitmentHash) external nonReentrant {
        if (resolved) revert MarketAlreadyResolved();
        if (block.timestamp >= resolveDeadline) revert MarketNotYetResolvable();
        if (outcomeIndex >= outcomeCount) revert InvalidOutcomeIndex();
        if (amount == 0) revert ZeroAmount();
        if (positions[msg.sender].amount != 0) revert AlreadyHasPosition();

        if (!agentRegistry.isRegisteredAgent(msg.sender)) revert AgentNotRegistered();
        address reputationRegistry = agentRegistry.resolveAgent(msg.sender).primitives.reputationRegistry;
        uint256 liveAis = ReputationRegistry(reputationRegistry).effectiveScore(msg.sender);
        if (liveAis < minAisToEnter) revert AisTooLow(minAisToEnter, liveAis);

        itk.safeTransferFrom(msg.sender, address(this), amount);

        positions[msg.sender] =
            Position({amount: amount, outcomeIndex: outcomeIndex, bccCommitmentHash: bccCommitmentHash, claimed: false});
        outcomeStaked[outcomeIndex] += amount;
        totalStaked += amount;

        emit PositionEntered(msg.sender, outcomeIndex, amount, bccCommitmentHash);
    }

    /// @notice Resolves the market to a winning outcome. See contract-level NatSpec for
    /// the RESOLVER_ROLE trust boundary.
    function resolve(uint8 _winningOutcome) external onlyRole(RESOLVER_ROLE) {
        if (resolved) revert MarketAlreadyResolved();
        if (_winningOutcome >= outcomeCount) revert InvalidOutcomeIndex();

        resolved = true;
        winningOutcome = _winningOutcome;
        emit MarketResolved(_winningOutcome, msg.sender);
    }

    /// @notice Pari-mutuel payout: a winner receives its share of the ENTIRE staked
    /// pool (all outcomes combined) proportional to its share of the winning outcome's
    /// pool. Losers receive nothing (their stake funds the winners' payout).
    function claimPayout() external nonReentrant {
        if (!resolved) revert MarketNotResolved();
        Position storage p = positions[msg.sender];
        if (p.amount == 0) revert NoPosition();
        if (p.claimed) revert AlreadyClaimed();
        if (p.outcomeIndex != winningOutcome) revert LosingPosition();

        p.claimed = true;
        uint256 winningPool = outcomeStaked[winningOutcome];
        uint256 payout = (p.amount * totalStaked) / winningPool;
        itk.safeTransfer(msg.sender, payout);
        emit PayoutClaimed(msg.sender, payout);
    }

    /// @notice Convenience read for integrity-oracle: was this agent's position on the
    /// winning side. Does not move funds or affect reputation itself -- the oracle
    /// reads this (and telemetry/BCC commitments) to decide what to report to
    /// ReputationRegistry.updateScore, and whether to raise a Slasher dispute.
    function wasCorrect(address agent) external view returns (bool) {
        if (!resolved) return false;
        Position storage p = positions[agent];
        return p.amount > 0 && p.outcomeIndex == winningOutcome;
    }

    function getPosition(address agent) external view returns (Position memory) {
        return positions[agent];
    }
}
` },
  { name: 'A2ACapitalPool.sol', content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {XibalbaAgentRegistry} from "../framework/XibalbaAgentRegistry.sol";
import {ReputationRegistry} from "../oracle/ReputationRegistry.sol";

/// @title A2ACapitalPool
/// @notice Real, on-chain agent-to-agent capital allocation: an allocator (a human
/// investor, or another agent's SovereignAgent) escrows \$ITK earmarked for a specific
/// agent, gated on that agent's LIVE effective AIS staying at or above a threshold. This
/// is the honest, on-chain replacement for the old dashboard's ActuarialHub A2A escrow,
/// which only ever wrote to localStorage and simulated its "hire" flow with a
/// \`setTimeout\` (see integrity-dashboard's old ActuarialHub.tsx). The "delegate your
/// money to a trustworthy agent" proof: capital only reaches an agent while it is
/// verifiably trustworthy, and can be reclaimed the moment it stops being so.
/// @dev A single global singleton, deliberately NOT a per-agent/per-creator clone like
/// \`IntegrityMarket\` -- a capital pool is inherently a shared many-allocator-to-many-
/// agent venue (any allocator routes to any registered agent), not an application one
/// party authors and owns. \`agent\` here means the agent's own SovereignAgent contract
/// address, resolved through XibalbaAgentRegistry exactly like EHRGate/IntegrityMarket.
///
/// *** DOCUMENTED LIMITATION, NOT A SILENT MOCK ***
/// \`clawback()\` can only reclaim funds that are still escrowed IN THIS CONTRACT (i.e.
/// before \`release()\`). Once capital is released to an agent's own SovereignAgent
/// address, this pool has no further custody of it -- a post-release breach is not
/// something an ITK escrow contract can reverse. The punitive lever for a post-release
/// breach is the agent's OWN Slasher clone (already-built, real staking/dispute
/// mechanism): integrity-oracle is expected to raise a dispute there when it detects
/// misconduct. \`flagBreach\` below exists purely so the dashboard/leaderboard can display
/// an honest allocation-history record of that breach; it moves no funds.
contract A2ACapitalPool is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant BREACH_REPORTER_ROLE = keccak256("BREACH_REPORTER_ROLE");

    IERC20 public immutable itk;
    XibalbaAgentRegistry public immutable agentRegistry;

    enum Status {
        Escrowed,
        Released,
        ClawedBack,
        Breached
    }

    struct Allocation {
        address allocator;
        address agent;
        uint256 amount;
        uint256 minAisToMaintain;
        Status status;
        uint256 createdAt;
    }

    uint256 public nextAllocationId;
    mapping(uint256 => Allocation) public allocations;

    event Allocated(
        uint256 indexed allocationId, address indexed allocator, address indexed agent, uint256 amount, uint256 minAisToMaintain
    );
    event Released(uint256 indexed allocationId, address indexed agent, uint256 amount);
    event ClawedBack(uint256 indexed allocationId, address indexed allocator, uint256 amount);
    event BreachFlagged(uint256 indexed allocationId, string reason);

    error ZeroAmount();
    error AgentNotRegistered();
    error AisTooLow(uint256 required, uint256 actual);
    error AllocationNotFound();
    error NotAllocator();
    error NotEscrowed();

    constructor(address _itk, address _agentRegistry, address admin) {
        itk = IERC20(_itk);
        agentRegistry = XibalbaAgentRegistry(_agentRegistry);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(BREACH_REPORTER_ROLE, admin);
    }

    /// @notice Escrows \`amount\` ITK from \`msg.sender\` (the allocator), earmarked for
    /// \`agent\`, gated on \`agent\`'s live AIS being >= \`minAisToMaintain\` AT ALLOCATION
    /// TIME. The same threshold is re-checked at \`release()\` time so an agent that
    /// decayed between allocation and release cannot still receive the funds.
    function allocate(address agent, uint256 amount, uint256 minAisToMaintain)
        external
        nonReentrant
        returns (uint256 allocationId)
    {
        if (amount == 0) revert ZeroAmount();
        _requireLiveAis(agent, minAisToMaintain);

        itk.safeTransferFrom(msg.sender, address(this), amount);

        allocationId = nextAllocationId++;
        allocations[allocationId] = Allocation({
            allocator: msg.sender,
            agent: agent,
            amount: amount,
            minAisToMaintain: minAisToMaintain,
            status: Status.Escrowed,
            createdAt: block.timestamp
        });

        emit Allocated(allocationId, msg.sender, agent, amount, minAisToMaintain);
    }

    /// @notice Releases escrowed capital to the agent -- only while the agent's live AIS
    /// still clears the threshold set at allocation time. Callable by the allocator
    /// (self-service: "I'm satisfied, deploy my capital to this agent now").
    function release(uint256 allocationId) external nonReentrant {
        Allocation storage a = allocations[allocationId];
        if (a.allocator == address(0)) revert AllocationNotFound();
        if (msg.sender != a.allocator) revert NotAllocator();
        if (a.status != Status.Escrowed) revert NotEscrowed();

        _requireLiveAis(a.agent, a.minAisToMaintain);

        a.status = Status.Released;
        itk.safeTransfer(a.agent, a.amount);
        emit Released(allocationId, a.agent, a.amount);
    }

    /// @notice Reclaims still-escrowed capital back to the allocator. Callable any time
    /// before release -- e.g. the allocator changes their mind, or the agent's AIS has
    /// dropped below the threshold since allocation.
    function clawback(uint256 allocationId) external nonReentrant {
        Allocation storage a = allocations[allocationId];
        if (a.allocator == address(0)) revert AllocationNotFound();
        if (msg.sender != a.allocator) revert NotAllocator();
        if (a.status != Status.Escrowed) revert NotEscrowed();

        a.status = Status.ClawedBack;
        itk.safeTransfer(a.allocator, a.amount);
        emit ClawedBack(allocationId, a.allocator, a.amount);
    }

    /// @notice Records that a RELEASED allocation's agent breached trust after the fact
    /// (e.g. integrity-oracle detected misconduct and raised a Slasher dispute on the
    /// agent's own stake). Moves no funds -- see contract-level NatSpec. Restricted to
    /// BREACH_REPORTER_ROLE (the oracle signer) so this history can't be spammed/faked
    /// by an arbitrary caller.
    function flagBreach(uint256 allocationId, string calldata reason) external onlyRole(BREACH_REPORTER_ROLE) {
        Allocation storage a = allocations[allocationId];
        if (a.allocator == address(0)) revert AllocationNotFound();
        a.status = Status.Breached;
        emit BreachFlagged(allocationId, reason);
    }

    function _requireLiveAis(address agent, uint256 minAis) internal view {
        if (!agentRegistry.isRegisteredAgent(agent)) revert AgentNotRegistered();
        address reputationRegistry = agentRegistry.resolveAgent(agent).primitives.reputationRegistry;
        uint256 liveAis = ReputationRegistry(reputationRegistry).effectiveScore(agent);
        if (liveAis < minAis) revert AisTooLow(minAis, liveAis);
    }

    function getAllocation(uint256 allocationId) external view returns (Allocation memory) {
        return allocations[allocationId];
    }
}
` },
  { name: 'MarketFactory.sol', content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {XibalbaAgentRegistry} from "../framework/XibalbaAgentRegistry.sol";
import {IntegrityMarket} from "./IntegrityMarket.sol";

/// @title MarketFactory
/// @notice Lets any registered agent deploy and OWN its own customized \`IntegrityMarket\`
/// instance -- the application-layer expression of the protocol's core thesis. Agents
/// don't just self-deploy their identity primitives (SovereignAgent, StateAnchor) and
/// own clones of shared infrastructure (ReputationRegistry, Slasher, ...); they can also
/// author and own the smart-contract *applications* built on top of the protocol.
/// integrity-dashboard's Contracts/Factory IDE page is the human-facing surface for this
/// exact call -- pick a question, outcome structure, AIS bar, deadline, and resolver,
/// then deploy for real. No two agents' markets need to look alike: one might gate entry
/// at AIS 900 with itself as resolver, another might open entry to any registered agent
/// and delegate resolution to the protocol's demo signer.
/// @dev Mirrors AgentPrimitivesFactory's clone-and-initialize pattern exactly (Clones of
/// one shared, non-initializable implementation), but for an application contract
/// instead of an identity primitive. Deliberately NOT restricted to a curator role --
/// unlike SmartBAAFactory (where "who can create a BAA" is gated by the Shield vertical's
/// entity-registry check), any agent that completed real self-sovereign registration
/// (i.e. exists in XibalbaAgentRegistry) may deploy a market. Spam/quality is a
/// dashboard/discovery-layer concern (e.g. surfacing markets by creator AIS), not an
/// on-chain gate -- gating market *creation* itself would undercut the "agents own their
/// own applications" thesis this contract exists to demonstrate.
contract MarketFactory {
    XibalbaAgentRegistry public immutable agentRegistry;

    /// @dev The shared, non-initializable IntegrityMarket implementation every clone
    /// delegatecalls into (deployed once by script/Deploy.s.sol with
    /// \`_disableInitializers()\` already called in its constructor).
    address public immutable marketImpl;

    mapping(address => address[]) public marketsByCreator;
    address[] public allMarkets;

    event MarketDeployed(
        address indexed market, address indexed creator, string question, uint8 outcomeCount, address indexed resolver
    );

    error AgentNotRegistered();

    constructor(address _agentRegistry, address _marketImpl) {
        agentRegistry = XibalbaAgentRegistry(_agentRegistry);
        marketImpl = _marketImpl;
    }

    /// @notice Deploys and initializes a new \`IntegrityMarket\` clone owned by
    /// \`msg.sender\` (expected to be the calling agent's own SovereignAgent contract,
    /// per the protocol's call-routing convention -- \`agentRegistry.isRegisteredAgent\`
    /// is exactly the check that closes off a hand-rolled non-agent caller, same as
    /// EHRGate/IntegrityMarket's own resolution pattern).
    function deployMarket(
        string calldata question,
        uint8 outcomeCount,
        uint256 minAisToEnter,
        uint256 resolveDeadline,
        address resolver
    ) external returns (address market) {
        if (!agentRegistry.isRegisteredAgent(msg.sender)) revert AgentNotRegistered();

        market = Clones.clone(marketImpl);
        IntegrityMarket(market).initialize(msg.sender, question, outcomeCount, minAisToEnter, resolveDeadline, resolver);

        marketsByCreator[msg.sender].push(market);
        allMarkets.push(market);

        emit MarketDeployed(market, msg.sender, question, outcomeCount, resolver);
    }

    function getMarketsByCreator(address creator) external view returns (address[] memory) {
        return marketsByCreator[creator];
    }

    function allMarketsCount() external view returns (uint256) {
        return allMarkets.length;
    }
}
` },
];
