// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {DomainRegistry} from "../src/framework/DomainRegistry.sol";

contract DomainRegistryTest is Test {
    DomainRegistry registry;
    address admin = makeAddr("admin");
    address domainOwner = makeAddr("domainOwner");
    address joiner = makeAddr("joiner");
    address stranger = makeAddr("stranger");
    address member = makeAddr("member");

    function setUp() public {
        registry = new DomainRegistry(admin);
    }

    function test_registerDomainOpen() public {
        vm.prank(domainOwner);
        bytes32 id = registry.registerDomain("open.integrity", DomainRegistry.JoinMode.Open);

        (address owner, DomainRegistry.JoinMode mode, bool exists, uint256 memberCount) = registry.domains(id);
        assertEq(owner, domainOwner);
        assertEq(uint8(mode), uint8(DomainRegistry.JoinMode.Open));
        assertTrue(exists);
        assertEq(memberCount, 0);
    }

    function test_cannotRegisterDuplicateDomain() public {
        vm.prank(domainOwner);
        registry.registerDomain("dup.integrity", DomainRegistry.JoinMode.Open);

        vm.prank(stranger);
        vm.expectRevert(DomainRegistry.DomainAlreadyExists.selector);
        registry.registerDomain("dup.integrity", DomainRegistry.JoinMode.Open);
    }

    function test_canJoinOpenDomainForAnyone() public {
        vm.prank(domainOwner);
        bytes32 id = registry.registerDomain("open.integrity", DomainRegistry.JoinMode.Open);
        assertTrue(registry.canJoin(id, stranger));
    }

    function test_canJoinPermissionedDomainOnlyIfApproved() public {
        vm.prank(domainOwner);
        bytes32 id = registry.registerDomain("gated.integrity", DomainRegistry.JoinMode.Permissioned);

        assertFalse(registry.canJoin(id, joiner));

        vm.prank(domainOwner);
        registry.approveJoiner(id, joiner);
        assertTrue(registry.canJoin(id, joiner));
    }

    function test_revokeJoinerRemovesApproval() public {
        vm.prank(domainOwner);
        bytes32 id = registry.registerDomain("gated.integrity", DomainRegistry.JoinMode.Permissioned);

        vm.prank(domainOwner);
        registry.approveJoiner(id, joiner);
        assertTrue(registry.canJoin(id, joiner));

        vm.prank(domainOwner);
        registry.revokeJoiner(id, joiner);
        assertFalse(registry.canJoin(id, joiner));
    }

    function test_onlyDomainOwnerOrRegistrarCanApprove() public {
        vm.prank(domainOwner);
        bytes32 id = registry.registerDomain("gated.integrity", DomainRegistry.JoinMode.Permissioned);

        vm.prank(stranger);
        vm.expectRevert(DomainRegistry.NotDomainOwner.selector);
        registry.approveJoiner(id, joiner);
    }

    function test_registrarRoleCanApproveEvenIfNotOwner() public {
        vm.prank(domainOwner);
        bytes32 id = registry.registerDomain("gated.integrity", DomainRegistry.JoinMode.Permissioned);

        address registrar = makeAddr("registrar");
        bytes32 registrarRole = registry.REGISTRAR_ROLE();
        vm.prank(admin);
        registry.grantRole(registrarRole, registrar);

        vm.prank(registrar);
        registry.approveJoiner(id, joiner);
        assertTrue(registry.canJoin(id, joiner));
    }

    function test_recordJoinRequiresRegistrarRole() public {
        vm.prank(domainOwner);
        bytes32 id = registry.registerDomain("open.integrity", DomainRegistry.JoinMode.Open);

        vm.expectRevert();
        registry.recordJoin(id, joiner, member);
    }

    function test_recordJoinSucceedsForApprovedCallerViaRegistrar() public {
        vm.prank(domainOwner);
        bytes32 id = registry.registerDomain("open.integrity", DomainRegistry.JoinMode.Open);

        address registrar = makeAddr("registrar");
        bytes32 registrarRole = registry.REGISTRAR_ROLE();
        vm.prank(admin);
        registry.grantRole(registrarRole, registrar);

        vm.prank(registrar);
        registry.recordJoin(id, joiner, member);

        assertTrue(registry.isMember(id, member));
        (,,, uint256 memberCount) = registry.domains(id);
        assertEq(memberCount, 1);
    }

    function test_recordJoinRevertsIfCallerNotApproved() public {
        vm.prank(domainOwner);
        bytes32 id = registry.registerDomain("gated.integrity", DomainRegistry.JoinMode.Permissioned);

        address registrar = makeAddr("registrar");
        bytes32 registrarRole = registry.REGISTRAR_ROLE();
        vm.prank(admin);
        registry.grantRole(registrarRole, registrar);

        vm.prank(registrar);
        vm.expectRevert(DomainRegistry.JoinNotApproved.selector);
        registry.recordJoin(id, joiner, member); // joiner was never approved
    }

    function test_recordJoinIsIdempotentForSameMember() public {
        vm.prank(domainOwner);
        bytes32 id = registry.registerDomain("open.integrity", DomainRegistry.JoinMode.Open);

        address registrar = makeAddr("registrar");
        bytes32 registrarRole = registry.REGISTRAR_ROLE();
        vm.prank(admin);
        registry.grantRole(registrarRole, registrar);

        vm.startPrank(registrar);
        registry.recordJoin(id, joiner, member);
        registry.recordJoin(id, joiner, member); // second call should not double-count
        vm.stopPrank();

        (,,, uint256 memberCount) = registry.domains(id);
        assertEq(memberCount, 1);
    }

    function test_setJoinModeChangesMode() public {
        vm.prank(domainOwner);
        bytes32 id = registry.registerDomain("open.integrity", DomainRegistry.JoinMode.Open);

        vm.prank(domainOwner);
        registry.setJoinMode(id, DomainRegistry.JoinMode.Permissioned);

        assertFalse(registry.canJoin(id, stranger));
    }

    function test_operationsOnNonexistentDomainRevert() public {
        bytes32 fakeId = keccak256("never-registered");
        vm.expectRevert(DomainRegistry.DomainDoesNotExist.selector);
        registry.approveJoiner(fakeId, joiner);
    }
}
