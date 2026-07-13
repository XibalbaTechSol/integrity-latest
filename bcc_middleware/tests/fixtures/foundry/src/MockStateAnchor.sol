// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal stand-in for the real `contracts/` StateAnchor.sol. TEST
/// FIXTURE ONLY -- proves bcc_middleware's `app/anchor.py` real
/// eth_sendTransaction code path end-to-end against a local anvil chain.
///
/// The function signature below, `anchorRoot(bytes32)`, is the exact
/// interface bcc_middleware calls and that `contracts/` needs to match.
contract MockStateAnchor {
    bytes32 public lastRoot;
    uint256 public rootCount;

    event RootAnchored(bytes32 indexed root, uint256 indexed index);

    function anchorRoot(bytes32 root) external {
        lastRoot = root;
        rootCount += 1;
        emit RootAnchored(root, rootCount);
    }
}
