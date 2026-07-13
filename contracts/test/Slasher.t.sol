// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {Slasher} from "../src/oracle/Slasher.sol";
import {IntegrityToken} from "../src/oracle/IntegrityToken.sol";

contract SlasherTest is Test {
    Slasher slasher;
    IntegrityToken itk;

    address admin = makeAddr("admin");
    address disputer = makeAddr("disputer");
    address agent = makeAddr("agent");

    function setUp() public {
        itk = new IntegrityToken(admin, 1_000_000 ether);
        // Slasher is clone-only (see its NatSpec) — deploy the implementation (which
        // bakes in the shared, immutable `itk` address) then a real clone of it.
        Slasher impl = new Slasher(address(itk));
        slasher = Slasher(Clones.clone(address(impl)));
        slasher.initialize(admin, disputer);

        vm.prank(admin);
        itk.transfer(agent, 10_000 ether);

        vm.startPrank(agent);
        itk.approve(address(slasher), type(uint256).max);
        slasher.stake(1_000 ether);
        vm.stopPrank();
    }

    function test_stakeRecordsBalance() public view {
        assertEq(slasher.stakeOf(agent), 1_000 ether);
        assertEq(itk.balanceOf(address(slasher)), 1_000 ether);
    }

    function test_unstakeReturnsFunds() public {
        vm.prank(agent);
        slasher.unstake(400 ether);
        assertEq(slasher.stakeOf(agent), 600 ether);
        assertEq(itk.balanceOf(agent), 10_000 ether - 600 ether);
    }

    function test_raiseDisputeLocksStake() public {
        vm.prank(disputer);
        uint256 id = slasher.raiseDispute(agent, 500 ether, "suspected BCC mismatch");

        assertEq(slasher.lockedStakeOf(agent), 500 ether);

        // Locked portion cannot be withdrawn while disputed.
        vm.prank(agent);
        vm.expectRevert(Slasher.InsufficientAvailableStake.selector);
        slasher.unstake(600 ether); // only 500 ether unlocked out of 1000

        // But the unlocked remainder still can be.
        vm.prank(agent);
        slasher.unstake(500 ether);
        assertEq(slasher.stakeOf(agent), 500 ether);

        (id);
    }

    function test_onlyDisputerRoleCanRaiseDispute() public {
        vm.expectRevert();
        slasher.raiseDispute(agent, 100 ether, "not authorized");
    }

    function test_resolveDisputeBeforeWindowReverts() public {
        vm.prank(disputer);
        uint256 id = slasher.raiseDispute(agent, 500 ether, "reason");

        vm.prank(admin);
        vm.expectRevert(Slasher.ChallengeWindowNotElapsed.selector);
        slasher.resolveDispute(id, true);
    }

    function test_resolveDispute_slashBurnsTokens() public {
        vm.prank(disputer);
        uint256 id = slasher.raiseDispute(agent, 500 ether, "violation");

        vm.warp(block.timestamp + slasher.disputeWindow() + 1);

        uint256 supplyBefore = itk.totalSupply();
        vm.prank(admin);
        slasher.resolveDispute(id, true);

        assertEq(slasher.stakeOf(agent), 500 ether); // 1000 staked - 500 slashed
        assertEq(slasher.lockedStakeOf(agent), 0);
        assertEq(itk.totalSupply(), supplyBefore - 500 ether); // burned, not transferred
    }

    function test_resolveDispute_dismissReleasesLock() public {
        vm.prank(disputer);
        uint256 id = slasher.raiseDispute(agent, 500 ether, "false alarm");

        vm.warp(block.timestamp + slasher.disputeWindow() + 1);

        vm.prank(admin);
        slasher.resolveDispute(id, false);

        assertEq(slasher.stakeOf(agent), 1_000 ether); // untouched
        assertEq(slasher.lockedStakeOf(agent), 0); // unlocked again

        vm.prank(agent);
        slasher.unstake(1_000 ether); // now fully withdrawable
    }

    function test_cannotResolveTwice() public {
        vm.prank(disputer);
        uint256 id = slasher.raiseDispute(agent, 500 ether, "x");
        vm.warp(block.timestamp + slasher.disputeWindow() + 1);

        vm.prank(admin);
        slasher.resolveDispute(id, false);

        vm.prank(admin);
        vm.expectRevert(Slasher.DisputeAlreadyResolved.selector);
        slasher.resolveDispute(id, false);
    }

    function test_cannotDisputeMoreThanAvailableStake() public {
        vm.prank(disputer);
        vm.expectRevert(Slasher.InsufficientAvailableStake.selector);
        slasher.raiseDispute(agent, 2_000 ether, "too much");
    }
}
