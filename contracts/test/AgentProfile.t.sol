// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {AgentProfile} from "../src/framework/AgentProfile.sol";
import {DomainRegistry} from "../src/framework/DomainRegistry.sol";

contract AgentProfileTest is Test {
    AgentProfile profile;
    DomainRegistry domainRegistry;
    address admin = makeAddr("admin");
    address agent = makeAddr("agent");
    bytes32 domainId;

    function setUp() public {
        domainRegistry = new DomainRegistry(admin);
        domainId = domainRegistry.domainId("healthcare.integrity");
        vm.prank(admin);
        domainRegistry.registerDomain("healthcare.integrity", DomainRegistry.JoinMode.Open);

        AgentProfile impl = new AgentProfile(address(domainRegistry));
        profile = AgentProfile(Clones.clone(address(impl)));
        profile.initialize(agent, agent, domainId, "ipfs://profile-1");
    }

    function test_initializeSetsFields() public view {
        assertEq(profile.agent(), agent);
        assertEq(profile.primaryDomain(), domainId);
        assertEq(profile.profileURI(), "ipfs://profile-1");
    }

    /// @notice Domain membership is NOT tracked locally — it must be corroborated live
    /// against the shared DomainRegistry, per the contract's own NatSpec.
    function test_isDomainMemberFalseUntilActuallyRecordedInSharedRegistry() public view {
        assertFalse(profile.isDomainMember());
    }

    function test_isDomainMemberTrueAfterRegistryRecordsJoin() public {
        bytes32 registrarRole = domainRegistry.REGISTRAR_ROLE();
        vm.prank(admin);
        domainRegistry.grantRole(registrarRole, admin);
        vm.prank(admin);
        domainRegistry.recordJoin(domainId, agent, agent);

        assertTrue(profile.isDomainMember());
    }

    function test_setProfileUpdatesFields() public {
        bytes32 newDomain = domainRegistry.domainId("finance.integrity");
        vm.prank(agent);
        profile.setProfile(newDomain, "ipfs://profile-2");

        assertEq(profile.primaryDomain(), newDomain);
        assertEq(profile.profileURI(), "ipfs://profile-2");
    }

    function test_onlyAdminCanSetProfile() public {
        vm.expectRevert();
        profile.setProfile(domainId, "ipfs://hijack");
    }
}
