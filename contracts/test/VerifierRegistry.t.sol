// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {VerifierRegistry} from "../src/oracle/VerifierRegistry.sol";
import {IZkVerifier} from "../src/oracle/IZkVerifier.sol";

contract VerifierRegistryTest is Test {
    VerifierRegistry registry;
    address admin = makeAddr("admin");
    address verifierV1 = address(0xAAA1);
    address verifierV2 = address(0xAAA2);

    function setUp() public {
        VerifierRegistry impl = new VerifierRegistry();
        registry = VerifierRegistry(Clones.clone(address(impl)));
        registry.initialize(admin, verifierV1);
    }

    function test_initializePinsVersionOne() public view {
        assertEq(registry.verifierImpl(1), verifierV1);
        assertEq(registry.currentVersion(), 1);
    }

    function test_verifyForwardsToCurrentVersion() public {
        vm.mockCall(verifierV1, abi.encodeWithSelector(IZkVerifier.verify.selector), abi.encode(true));
        assertTrue(registry.verify(hex"1234", new bytes32[](0)));
    }

    function test_pinNewVersionDoesNotSwitchCurrent() public {
        vm.prank(admin);
        registry.pinVersion(2, verifierV2);

        assertEq(registry.verifierImpl(2), verifierV2);
        assertEq(registry.currentVersion(), 1); // unchanged until setCurrentVersion
    }

    function test_setCurrentVersionSwitchesForwarding() public {
        vm.prank(admin);
        registry.pinVersion(2, verifierV2);
        vm.prank(admin);
        registry.setCurrentVersion(2);

        assertEq(registry.currentVersion(), 2);

        vm.mockCall(verifierV2, abi.encodeWithSelector(IZkVerifier.verify.selector), abi.encode(true));
        assertTrue(registry.verify(hex"1234", new bytes32[](0)));
    }

    function test_setCurrentVersionRevertsForUnknownVersion() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(VerifierRegistry.UnknownVersion.selector, 99));
        registry.setCurrentVersion(99);
    }

    function test_onlyAdminCanPinVersion() public {
        vm.expectRevert();
        registry.pinVersion(2, verifierV2);
    }

    function test_implementationCannotBeInitializedDirectly() public {
        VerifierRegistry impl = new VerifierRegistry();
        vm.expectRevert();
        impl.initialize(admin, verifierV1);
    }
}
