// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {A2ACapitalPool} from "../../src/markets/A2ACapitalPool.sol";
import {ReputationRegistry} from "../../src/oracle/ReputationRegistry.sol";
import {StateAnchor} from "../../src/oracle/StateAnchor.sol";
import {IntegrityToken} from "../../src/oracle/IntegrityToken.sol";
import {XibalbaAgentRegistry} from "../../src/framework/XibalbaAgentRegistry.sol";

/// @notice Proves the real, on-chain A2A capital allocation flow -- the honest
/// replacement for the old dashboard's localStorage-only ActuarialHub escrow: allocation
/// is gated on the target agent's live AIS, release re-checks that gate, and
/// still-escrowed funds can be clawed back. See A2ACapitalPool.sol's NatSpec for the
/// documented (not silently mocked) limitation that clawback cannot reach funds already
/// released to an agent.
contract A2ACapitalPoolTest is Test {
    IntegrityToken itk;
    XibalbaAgentRegistry registry;
    StateAnchor anchor;
    ReputationRegistry rep;
    A2ACapitalPool pool;

    address admin = makeAddr("admin");
    address allocator = makeAddr("allocator");
    address agent = makeAddr("agent");
    address unregisteredAgent = makeAddr("unregisteredAgent");

    uint256 constant AMOUNT = 500 ether;
    uint256 constant MIN_AIS = 700;

    function setUp() public {
        itk = new IntegrityToken(admin, 1_000_000 ether);
        registry = new XibalbaAgentRegistry(admin);
        anchor = new StateAnchor(admin);

        ReputationRegistry impl = new ReputationRegistry();
        rep = ReputationRegistry(Clones.clone(address(impl)));
        rep.initialize(admin, admin, address(0xBEEF), address(anchor));

        vm.startPrank(admin);
        registry.grantRole(registry.REGISTRAR_ROLE(), admin);
        registry.registerPrimitives(
            registry.didHash("did:integrity:pool-agent"),
            XibalbaAgentRegistry.PrimitiveSet({
                sovereignAgent: agent,
                stateAnchor: address(anchor),
                reputationRegistry: address(rep),
                slasher: address(0),
                verifierRegistry: address(0),
                complianceGate: address(0),
                agentProfile: address(0)
            }),
            admin,
            bytes32(0)
        );
        rep.updateScore(agent, 900);
        itk.transfer(allocator, 10_000 ether);
        vm.stopPrank();

        pool = new A2ACapitalPool(address(itk), address(registry), admin);
    }

    function _allocate() internal returns (uint256 allocationId) {
        vm.startPrank(allocator);
        itk.approve(address(pool), AMOUNT);
        allocationId = pool.allocate(agent, AMOUNT, MIN_AIS);
        vm.stopPrank();
    }

    function test_allocate_revertsForLowAis() public {
        vm.prank(admin);
        rep.updateScore(agent, 100);

        vm.startPrank(allocator);
        itk.approve(address(pool), AMOUNT);
        vm.expectRevert(abi.encodeWithSelector(A2ACapitalPool.AisTooLow.selector, MIN_AIS, 100));
        pool.allocate(agent, AMOUNT, MIN_AIS);
        vm.stopPrank();
    }

    function test_allocate_revertsForUnregisteredAgent() public {
        vm.startPrank(allocator);
        itk.approve(address(pool), AMOUNT);
        vm.expectRevert(A2ACapitalPool.AgentNotRegistered.selector);
        pool.allocate(unregisteredAgent, AMOUNT, MIN_AIS);
        vm.stopPrank();
    }

    function test_allocate_success_escrowsFunds() public {
        uint256 allocatorBalanceBefore = itk.balanceOf(allocator);
        uint256 allocationId = _allocate();

        assertEq(itk.balanceOf(allocator), allocatorBalanceBefore - AMOUNT);
        assertEq(itk.balanceOf(address(pool)), AMOUNT);

        A2ACapitalPool.Allocation memory a = pool.getAllocation(allocationId);
        assertEq(a.allocator, allocator);
        assertEq(a.agent, agent);
        assertEq(a.amount, AMOUNT);
        assertEq(uint8(a.status), uint8(A2ACapitalPool.Status.Escrowed));
    }

    function test_release_success_transfersToAgent() public {
        uint256 allocationId = _allocate();
        uint256 agentBalanceBefore = itk.balanceOf(agent);

        vm.prank(allocator);
        pool.release(allocationId);

        assertEq(itk.balanceOf(agent), agentBalanceBefore + AMOUNT);
        assertEq(uint8(pool.getAllocation(allocationId).status), uint8(A2ACapitalPool.Status.Released));
    }

    function test_release_revertsIfAisDroppedBelowThreshold() public {
        uint256 allocationId = _allocate();

        vm.prank(admin);
        rep.updateScore(agent, 100);

        vm.prank(allocator);
        vm.expectRevert(abi.encodeWithSelector(A2ACapitalPool.AisTooLow.selector, MIN_AIS, 100));
        pool.release(allocationId);
    }

    function test_release_onlyAllocator() public {
        uint256 allocationId = _allocate();

        vm.prank(agent);
        vm.expectRevert(A2ACapitalPool.NotAllocator.selector);
        pool.release(allocationId);
    }

    function test_clawback_success_returnsToAllocator() public {
        uint256 allocationId = _allocate();
        uint256 allocatorBalanceBefore = itk.balanceOf(allocator);

        vm.prank(allocator);
        pool.clawback(allocationId);

        assertEq(itk.balanceOf(allocator), allocatorBalanceBefore + AMOUNT);
        assertEq(uint8(pool.getAllocation(allocationId).status), uint8(A2ACapitalPool.Status.ClawedBack));
    }

    function test_clawback_revertsIfAlreadyReleased() public {
        uint256 allocationId = _allocate();
        vm.prank(allocator);
        pool.release(allocationId);

        vm.prank(allocator);
        vm.expectRevert(A2ACapitalPool.NotEscrowed.selector);
        pool.clawback(allocationId);
    }

    function test_flagBreach_onlyBreachReporterRole() public {
        uint256 allocationId = _allocate();
        vm.prank(allocator);
        pool.release(allocationId);

        vm.prank(allocator);
        vm.expectRevert();
        pool.flagBreach(allocationId, "misconduct");

        vm.prank(admin);
        pool.flagBreach(allocationId, "misconduct detected by oracle telemetry");
        assertEq(uint8(pool.getAllocation(allocationId).status), uint8(A2ACapitalPool.Status.Breached));
    }

    function test_flagBreach_movesNoFunds() public {
        uint256 allocationId = _allocate();
        vm.prank(allocator);
        pool.release(allocationId);

        uint256 agentBalanceBefore = itk.balanceOf(agent);
        uint256 poolBalanceBefore = itk.balanceOf(address(pool));

        vm.prank(admin);
        pool.flagBreach(allocationId, "misconduct");

        assertEq(itk.balanceOf(agent), agentBalanceBefore);
        assertEq(itk.balanceOf(address(pool)), poolBalanceBefore);
    }
}
