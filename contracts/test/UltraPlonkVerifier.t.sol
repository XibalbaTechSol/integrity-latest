// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {UltraPlonkVerifier} from "../src/oracle/UltraPlonkVerifier.sol";
import {IZkVerifier} from "../src/oracle/IZkVerifier.sol";

/// @notice The one and only job of the placeholder is to fail closed, unconditionally —
/// this test is the guardrail against ever accidentally reintroducing the old
/// prototype's "always returns true" mock.
contract UltraPlonkVerifierTest is Test {
    UltraPlonkVerifier verifier;

    function setUp() public {
        verifier = new UltraPlonkVerifier();
    }

    function test_implementsIZkVerifier() public view {
        // Compile-time proof it satisfies the shared interface swapped in by
        // `make generate-verifier`.
        IZkVerifier asInterface = IZkVerifier(address(verifier));
        assertEq(address(asInterface), address(verifier));
    }

    function test_verifyAlwaysRevertsOnEmptyProof() public {
        vm.expectRevert(UltraPlonkVerifier.PlaceholderVerifierNotYetGenerated.selector);
        verifier.verify("", new bytes32[](0));
    }

    function test_verifyAlwaysRevertsOnNonEmptyProof() public {
        bytes32[] memory inputs = new bytes32[](2);
        inputs[0] = bytes32(uint256(1));
        inputs[1] = bytes32(uint256(2));

        vm.expectRevert(UltraPlonkVerifier.PlaceholderVerifierNotYetGenerated.selector);
        verifier.verify(hex"deadbeef", inputs);
    }

    /// @notice Fuzz: no proof bytes whatsoever can make this return `true` — unlike the
    /// old mock, which returned true for any non-empty input.
    function testFuzz_neverReturnsTrue(bytes calldata proof, bytes32[] calldata publicInputs) public {
        vm.expectRevert(UltraPlonkVerifier.PlaceholderVerifierNotYetGenerated.selector);
        verifier.verify(proof, publicInputs);
    }
}
