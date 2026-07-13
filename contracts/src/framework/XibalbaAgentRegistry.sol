// SPDX-License-Identifier: MIT
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
/// which is why `registerPrimitives` is restricted to REGISTRAR_ROLE (granted only to
/// AgentPrimitivesFactory).
contract XibalbaAgentRegistry is AccessControl {
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    /// @notice The 7 primitive contract addresses that make up one agent's identity.
    /// `sovereignAgent` and `stateAnchor` are deployed directly by the agent's own
    /// wallet; the other 5 are EIP-1167 clones deployed by AgentPrimitivesFactory in the
    /// same registration transaction. `sovereignAgent` is the canonical "this agent's
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
    /// `msg.sender` when it needs to look up "which agent is this and what are its
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

    /// @notice Given an agent's SovereignAgent contract address (typically `msg.sender`
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
