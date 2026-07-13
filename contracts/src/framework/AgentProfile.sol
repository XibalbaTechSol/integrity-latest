// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {DomainRegistry} from "./DomainRegistry.sol";

/// @title AgentProfile
/// @notice Per-agent EIP-1167 clone holding a fast, agent-controlled read surface for
/// off-chain profile metadata (capabilities, service description) and a pointer to the
/// agent's primary domain.
/// @dev Domain membership itself is NOT tracked here — `DomainRegistry.isMember` remains
/// the single source of truth (you cannot answer "who is in healthcare.integrity" by
/// scanning N independent AgentProfile clones). `primaryDomain` below is only a
/// self-reported pointer for indexers/UI; `isDomainMember` cross-checks it live against
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
    /// this, not raw `primaryDomain`, whenever membership actually needs to be trusted.
    function isDomainMember() external view returns (bool) {
        return domainRegistry.isMember(primaryDomain, agent);
    }
}
