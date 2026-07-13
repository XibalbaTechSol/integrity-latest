// SPDX-License-Identifier: MIT
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
///   - leaves: `keccak256(abi.encodePacked(leafData))`
///   - parents: `keccak256(a < b ? (a,b) : (b,a))` — children sorted ascending before
///     hashing.
/// The pair is sorted (rather than hashed in insertion/positional order) so that a
/// verifier does not need to know whether a given sibling is the "left" or "right" child
/// while walking the proof — OZ's `MerkleProof.verify` assumes exactly this convention.
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
    /// generated against last week's root must still verify today. Only `latestRoot`
    /// advances "what's current"; `isAnchoredRoot` never un-anchors an old root.
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

    /// @notice Verifies that `leaf` is included under `root`, and that `root` is one
    /// this contract actually anchored (not just any Merkle-valid root a caller made up
    /// on the spot — anchoring is what gives a root its authority).
    function verifyLeaf(bytes32 root, bytes32 leaf, bytes32[] calldata proof) external view returns (bool) {
        if (!isAnchoredRoot[root]) return false;
        return MerkleProof.verify(proof, root, leaf);
    }

    /// @notice Convenience wrapper that verifies against the current `latestRoot`.
    function verifyLeafAtLatest(bytes32 leaf, bytes32[] calldata proof) external view returns (bool) {
        return MerkleProof.verify(proof, latestRoot, leaf);
    }
}
