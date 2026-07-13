// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {XibalbaNameService} from "../src/framework/XibalbaNameService.sol";
import {XibalbaAgentRegistry} from "../src/framework/XibalbaAgentRegistry.sol";

contract XibalbaNameServiceTest is Test {
    XibalbaNameService xns;
    XibalbaAgentRegistry registry;

    address admin = makeAddr("admin");
    address registrar = makeAddr("registrar");
    address controller = makeAddr("controller");
    address sovereignAgent = makeAddr("sovereignAgent");
    address otherSovereignAgent = makeAddr("otherSovereignAgent");
    address stranger = makeAddr("stranger");

    string constant DID = "did:integrity:abc123";
    bytes32 domainId = keccak256("healthcare.integrity");

    function setUp() public {
        registry = new XibalbaAgentRegistry(admin);
        bytes32 registrarRole = registry.REGISTRAR_ROLE();
        vm.prank(admin);
        registry.grantRole(registrarRole, registrar);

        xns = new XibalbaNameService(admin, address(registry));

        // Make `sovereignAgent` a real registered agent per XibalbaAgentRegistry, the
        // same way AgentPrimitivesFactory would in the real flow — XNS's register()
        // checks isRegisteredAgent(msg.sender), so tests need a genuinely registered
        // address, not just any address.
        XibalbaAgentRegistry.PrimitiveSet memory primitives = XibalbaAgentRegistry.PrimitiveSet({
            sovereignAgent: sovereignAgent,
            stateAnchor: makeAddr("stateAnchor"),
            reputationRegistry: makeAddr("reputationRegistry"),
            slasher: makeAddr("slasher"),
            verifierRegistry: makeAddr("verifierRegistry"),
            complianceGate: makeAddr("complianceGate"),
            agentProfile: makeAddr("agentProfile")
        });
        // registry.didHash(DID) must be evaluated BEFORE vm.prank(registrar) below --
        // otherwise it consumes the single-shot prank as a staticcall argument
        // expression, leaving registerPrimitives itself called by the test contract,
        // not registrar (see XibalbaAgentRegistryTest's own setUp comment for the
        // identical gotcha).
        bytes32 did = registry.didHash(DID);
        vm.prank(registrar);
        registry.registerPrimitives(did, primitives, controller, domainId);
    }

    // --- registration -----------------------------------------------------------

    function test_registeredAgentCanClaimAHandle() public {
        vm.prank(sovereignAgent);
        bytes32 id = xns.register("hermes.integrity");

        assertEq(id, xns.handleId("hermes.integrity"));
        assertEq(xns.resolve("hermes.integrity"), sovereignAgent);
        assertTrue(xns.handleExists("hermes.integrity"));
    }

    function test_firstHandleBecomesPrimaryAutomatically() public {
        vm.prank(sovereignAgent);
        xns.register("hermes.integrity");

        assertEq(xns.primaryHandle(sovereignAgent), "hermes.integrity");
    }

    function test_unregisteredCallerCannotClaimAHandle() public {
        vm.prank(stranger);
        vm.expectRevert(XibalbaNameService.NotRegisteredAgent.selector);
        xns.register("squatter.integrity");
    }

    function test_cannotRegisterDuplicateHandle() public {
        vm.prank(sovereignAgent);
        xns.register("hermes.integrity");

        vm.prank(sovereignAgent);
        vm.expectRevert(XibalbaNameService.HandleAlreadyRegistered.selector);
        xns.register("hermes.integrity");
    }

    function test_cannotRegisterEmptyHandle() public {
        vm.prank(sovereignAgent);
        vm.expectRevert(XibalbaNameService.EmptyHandle.selector);
        xns.register("");
    }

    function test_resolvingUnregisteredHandleReverts() public {
        vm.expectRevert(XibalbaNameService.HandleNotFound.selector);
        xns.resolve("nobody.integrity");
    }

    function test_handleExistsIsFalseForUnclaimedHandle() public view {
        assertFalse(xns.handleExists("nobody.integrity"));
    }

    // --- primary handle -----------------------------------------------------------

    function test_agentCanChoosePrimaryAmongMultipleHandles() public {
        vm.startPrank(sovereignAgent);
        xns.register("hermes.integrity");
        xns.register("hermes-alt.integrity");
        assertEq(xns.primaryHandle(sovereignAgent), "hermes.integrity");

        xns.setPrimaryHandle("hermes-alt.integrity");
        vm.stopPrank();

        assertEq(xns.primaryHandle(sovereignAgent), "hermes-alt.integrity");
    }

    function test_cannotSetPrimaryToAHandleYouDontOwn() public {
        vm.prank(sovereignAgent);
        xns.register("hermes.integrity");

        vm.prank(stranger);
        vm.expectRevert(XibalbaNameService.NotHandleOwner.selector);
        xns.setPrimaryHandle("hermes.integrity");
    }

    // --- self-release -----------------------------------------------------------

    function test_ownerCanReleaseTheirOwnHandle() public {
        vm.startPrank(sovereignAgent);
        xns.register("hermes.integrity");
        xns.release("hermes.integrity");
        vm.stopPrank();

        assertFalse(xns.handleExists("hermes.integrity"));
        assertEq(xns.primaryHandle(sovereignAgent), "");
    }

    function test_releasedHandleCanBeReclaimedByAnotherAgent() public {
        vm.startPrank(sovereignAgent);
        xns.register("hermes.integrity");
        xns.release("hermes.integrity");
        vm.stopPrank();

        // Make otherSovereignAgent a real registered agent too, distinct DID.
        XibalbaAgentRegistry.PrimitiveSet memory primitives2 = XibalbaAgentRegistry.PrimitiveSet({
            sovereignAgent: otherSovereignAgent,
            stateAnchor: makeAddr("stateAnchor2"),
            reputationRegistry: makeAddr("reputationRegistry2"),
            slasher: makeAddr("slasher2"),
            verifierRegistry: makeAddr("verifierRegistry2"),
            complianceGate: makeAddr("complianceGate2"),
            agentProfile: makeAddr("agentProfile2")
        });
        bytes32 did2 = registry.didHash("did:integrity:xyz789");
        vm.prank(registrar);
        registry.registerPrimitives(did2, primitives2, controller, domainId);

        vm.prank(otherSovereignAgent);
        xns.register("hermes.integrity");
        assertEq(xns.resolve("hermes.integrity"), otherSovereignAgent);
    }

    function test_strangerCannotReleaseSomeoneElsesHandle() public {
        vm.prank(sovereignAgent);
        xns.register("hermes.integrity");

        vm.prank(stranger);
        vm.expectRevert(XibalbaNameService.NotHandleOwner.selector);
        xns.release("hermes.integrity");
    }

    // --- dispute-intervention path -----------------------------------------------------------

    function test_registrarCanRevokeAHandleForDisputeResolution() public {
        vm.prank(sovereignAgent);
        xns.register("hermes.integrity");

        bytes32 xnsRegistrarRole = xns.REGISTRAR_ROLE();
        vm.prank(admin);
        xns.grantRole(xnsRegistrarRole, registrar);

        vm.prank(registrar);
        xns.revokeByRegistrar("hermes.integrity");

        assertFalse(xns.handleExists("hermes.integrity"));
    }

    function test_nonRegistrarCannotForceRevoke() public {
        vm.prank(sovereignAgent);
        xns.register("hermes.integrity");

        vm.prank(stranger);
        vm.expectRevert();
        xns.revokeByRegistrar("hermes.integrity");
    }
}
