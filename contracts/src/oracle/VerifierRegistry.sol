// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {IZkVerifier} from "./IZkVerifier.sol";

/// @title VerifierRegistry
/// @notice Per-agent EIP-1167 clone holding a versioned, agent-controlled pointer to
/// whichever global `IZkVerifier` implementation (UltraPlonkVerifier, or a future
/// circuit version) this agent currently trusts.
/// @dev Exists so a single global circuit upgrade doesn't force every agent onto the new
/// version simultaneously — an agent can pin an older, still-verifying version while it
/// validates the new one, implementing the "Versioned Circuit Registry" ingestion
/// hardening item (docs/INTERFACE_CONTRACT.md). `verify` forwards to whichever impl is
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

    /// @notice Switches which pinned version `verify` forwards to.
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
