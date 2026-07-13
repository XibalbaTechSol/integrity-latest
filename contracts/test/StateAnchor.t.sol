// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {StateAnchor} from "../src/oracle/StateAnchor.sol";

/// @notice Builds a real 4-leaf Merkle tree by hand, using the exact convention pinned
/// down in docs/INTERFACE_CONTRACT.md §4.4 (keccak256 leaves, ascending-sorted-pair
/// parents), and checks StateAnchor.verifyLeaf against it via OZ's MerkleProof — i.e.
/// this test is itself an executable spec of §4.4 that integrity-oracle's tree-builder
/// must interoperate with.
contract StateAnchorTest is Test {
    StateAnchor anchor;
    address admin = makeAddr("admin");

    bytes32 leaf0;
    bytes32 leaf1;
    bytes32 leaf2;
    bytes32 leaf3;
    bytes32 parent01;
    bytes32 parent23;
    bytes32 root;

    function _hashPair(bytes32 a, bytes32 b) internal pure returns (bytes32) {
        return a < b ? keccak256(abi.encodePacked(a, b)) : keccak256(abi.encodePacked(b, a));
    }

    function setUp() public {
        anchor = new StateAnchor(admin);

        leaf0 = keccak256(abi.encodePacked("agent-alice:score-report:epoch-1"));
        leaf1 = keccak256(abi.encodePacked("agent-bob:score-report:epoch-1"));
        leaf2 = keccak256(abi.encodePacked("agent-carol:score-report:epoch-1"));
        leaf3 = keccak256(abi.encodePacked("agent-dave:score-report:epoch-1"));

        parent01 = _hashPair(leaf0, leaf1);
        parent23 = _hashPair(leaf2, leaf3);
        root = _hashPair(parent01, parent23);
    }

    function test_anchorRootStoresLatestAndHistory() public {
        vm.prank(admin);
        uint256 epoch = anchor.anchorRoot(root);

        assertEq(epoch, 1);
        assertEq(anchor.latestRoot(), root);
        assertEq(anchor.rootAtEpoch(1), root);
        assertTrue(anchor.isAnchoredRoot(root));
    }

    function test_verifyLeafSucceedsForEachLeafWithCorrectProof() public {
        vm.prank(admin);
        anchor.anchorRoot(root);

        bytes32[] memory proof0 = new bytes32[](2);
        proof0[0] = leaf1;
        proof0[1] = parent23;
        assertTrue(anchor.verifyLeaf(root, leaf0, proof0));

        bytes32[] memory proof2 = new bytes32[](2);
        proof2[0] = leaf3;
        proof2[1] = parent01;
        assertTrue(anchor.verifyLeaf(root, leaf2, proof2));
    }

    function test_verifyLeafFailsWithWrongProof() public {
        vm.prank(admin);
        anchor.anchorRoot(root);

        bytes32[] memory badProof = new bytes32[](2);
        badProof[0] = leaf0; // wrong sibling for leaf0 itself
        badProof[1] = parent23;
        assertFalse(anchor.verifyLeaf(root, leaf0, badProof));
    }

    /// @notice A structurally valid Merkle proof against a root that was never anchored
    /// must fail — anchoring is what gives a root authority, not mere mathematical
    /// consistency of the proof.
    function test_verifyLeafFailsForUnanchoredRoot() public {
        bytes32[] memory proof0 = new bytes32[](2);
        proof0[0] = leaf1;
        proof0[1] = parent23;
        assertFalse(anchor.verifyLeaf(root, leaf0, proof0));
    }

    function test_oldRootsRemainVerifiableAfterNewAnchor() public {
        vm.startPrank(admin);
        anchor.anchorRoot(root);

        bytes32 newLeaf = keccak256(abi.encodePacked("agent-eve:score-report:epoch-2"));
        bytes32 newRoot = _hashPair(newLeaf, newLeaf); // trivial 1-leaf-doubled tree
        anchor.anchorRoot(newRoot);
        vm.stopPrank();

        assertEq(anchor.latestRoot(), newRoot);
        // epoch-1 root must still verify even though it's no longer "latest".
        bytes32[] memory proof0 = new bytes32[](2);
        proof0[0] = leaf1;
        proof0[1] = parent23;
        assertTrue(anchor.verifyLeaf(root, leaf0, proof0));
    }

    function test_onlyAnchorRoleCanAnchor() public {
        vm.expectRevert();
        anchor.anchorRoot(root);
    }

    function test_emptyRootReverts() public {
        vm.prank(admin);
        vm.expectRevert(StateAnchor.EmptyRoot.selector);
        anchor.anchorRoot(bytes32(0));
    }
}
