// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {IntegrityMarket} from "../../src/markets/IntegrityMarket.sol";
import {MarketFactory} from "../../src/markets/MarketFactory.sol";
import {ReputationRegistry} from "../../src/oracle/ReputationRegistry.sol";
import {StateAnchor} from "../../src/oracle/StateAnchor.sol";
import {IntegrityToken} from "../../src/oracle/IntegrityToken.sol";
import {XibalbaAgentRegistry} from "../../src/framework/XibalbaAgentRegistry.sol";

/// @notice Proves the AIS-gated, agent-owned market flow end to end: a registered agent
/// deploys and owns its own market via MarketFactory (the application-layer expression
/// of the protocol's "agents own their own contracts" thesis), a low-AIS agent is
/// rejected at entry, positions are pari-mutuel-settled on resolution, and only the
/// designated RESOLVER_ROLE holder can resolve. Mirrors EHRGate.t.sol's pattern of
/// registering synthetic `makeAddr(...)` addresses as stand-in SovereignAgent addresses
/// directly into XibalbaAgentRegistry, rather than re-running the full
/// AgentPrimitivesFactory registration sequence (that gets its own coverage in
/// AgentPrimitivesFactory.t.sol) -- this file is focused on IntegrityMarket/MarketFactory
/// behavior, not registration.
contract IntegrityMarketTest is Test {
    IntegrityToken itk;
    XibalbaAgentRegistry registry;
    StateAnchor anchor;
    IntegrityMarket marketImpl;
    MarketFactory factory;

    address admin = makeAddr("admin");
    address highAisAgent = makeAddr("highAisAgent");
    address lowAisAgent = makeAddr("lowAisAgent");
    address midAisAgent = makeAddr("midAisAgent");
    address resolver = makeAddr("resolver");
    address unregistered = makeAddr("unregistered");

    ReputationRegistry highAisRep;
    ReputationRegistry lowAisRep;
    ReputationRegistry midAisRep;

    uint256 constant STAKE = 100 ether;

    function setUp() public {
        itk = new IntegrityToken(admin, 1_000_000 ether);
        registry = new XibalbaAgentRegistry(admin);
        anchor = new StateAnchor(admin);

        highAisRep = _registerAgentWithScore(highAisAgent, "did:integrity:high-ais", 900);
        lowAisRep = _registerAgentWithScore(lowAisAgent, "did:integrity:low-ais", 100);
        midAisRep = _registerAgentWithScore(midAisAgent, "did:integrity:mid-ais", 900);

        marketImpl = new IntegrityMarket(address(itk), address(registry));
        factory = new MarketFactory(address(registry), address(marketImpl));

        vm.startPrank(admin);
        itk.transfer(highAisAgent, 10_000 ether);
        itk.transfer(midAisAgent, 10_000 ether);
        itk.transfer(lowAisAgent, 10_000 ether);
        vm.stopPrank();
    }

    function _registerAgentWithScore(address agent, string memory did, uint256 score)
        internal
        returns (ReputationRegistry rep)
    {
        ReputationRegistry impl = new ReputationRegistry();
        rep = ReputationRegistry(Clones.clone(address(impl)));
        rep.initialize(admin, admin, address(0xBEEF), address(anchor));

        vm.startPrank(admin);
        registry.grantRole(registry.REGISTRAR_ROLE(), admin);
        registry.registerPrimitives(
            registry.didHash(did),
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
        rep.updateScore(agent, score);
        vm.stopPrank();
    }

    function _deployMarket(address creator, uint256 minAis) internal returns (IntegrityMarket market) {
        vm.prank(creator);
        market = IntegrityMarket(
            factory.deployMarket("Will BTC exceed $100k by Friday?", 2, minAis, block.timestamp + 1 days, resolver)
        );
    }

    // --- MarketFactory ---------------------------------------------------------------

    function test_deployMarket_revertsForUnregisteredCaller() public {
        vm.prank(unregistered);
        vm.expectRevert(MarketFactory.AgentNotRegistered.selector);
        factory.deployMarket("question", 2, 500, block.timestamp + 1 days, resolver);
    }

    function test_deployMarket_success_agentOwnsItsOwnMarket() public {
        IntegrityMarket market = _deployMarket(highAisAgent, 500);

        assertEq(market.creator(), highAisAgent);
        assertEq(market.question(), "Will BTC exceed $100k by Friday?");
        assertEq(market.outcomeCount(), 2);
        assertEq(market.minAisToEnter(), 500);
        assertTrue(market.hasRole(market.DEFAULT_ADMIN_ROLE(), highAisAgent));
        assertTrue(market.hasRole(market.RESOLVER_ROLE(), resolver));

        address[] memory owned = factory.getMarketsByCreator(highAisAgent);
        assertEq(owned.length, 1);
        assertEq(owned[0], address(market));
        assertEq(factory.allMarketsCount(), 1);
    }

    function test_deployMarket_rejectsSingleOutcome() public {
        vm.prank(highAisAgent);
        vm.expectRevert(IntegrityMarket.InvalidOutcomeCount.selector);
        factory.deployMarket("bad market", 1, 500, block.timestamp + 1 days, resolver);
    }

    // --- enterPosition -----------------------------------------------------------------

    function test_enterPosition_revertsForLowAis() public {
        IntegrityMarket market = _deployMarket(highAisAgent, 500);

        vm.startPrank(lowAisAgent);
        itk.approve(address(market), STAKE);
        vm.expectRevert(abi.encodeWithSelector(IntegrityMarket.AisTooLow.selector, 500, 100));
        market.enterPosition(0, STAKE, keccak256("commitment"));
        vm.stopPrank();
    }

    function test_enterPosition_revertsForUnregisteredAgent() public {
        IntegrityMarket market = _deployMarket(highAisAgent, 0);

        vm.startPrank(unregistered);
        itk.approve(address(market), STAKE);
        vm.expectRevert(IntegrityMarket.AgentNotRegistered.selector);
        market.enterPosition(0, STAKE, keccak256("commitment"));
        vm.stopPrank();
    }

    function test_enterPosition_revertsAfterDeadline() public {
        IntegrityMarket market = _deployMarket(highAisAgent, 0);
        vm.warp(block.timestamp + 2 days);

        vm.startPrank(highAisAgent);
        itk.approve(address(market), STAKE);
        vm.expectRevert(IntegrityMarket.MarketNotYetResolvable.selector);
        market.enterPosition(0, STAKE, keccak256("commitment"));
        vm.stopPrank();
    }

    function test_enterPosition_revertsOnDuplicatePosition() public {
        IntegrityMarket market = _deployMarket(highAisAgent, 0);

        vm.startPrank(highAisAgent);
        itk.approve(address(market), STAKE * 2);
        market.enterPosition(0, STAKE, keccak256("commitment"));
        vm.expectRevert(IntegrityMarket.AlreadyHasPosition.selector);
        market.enterPosition(1, STAKE, keccak256("commitment2"));
        vm.stopPrank();
    }

    // --- resolve + claimPayout ---------------------------------------------------------

    function test_resolve_onlyResolverRole() public {
        IntegrityMarket market = _deployMarket(highAisAgent, 0);
        vm.prank(highAisAgent);
        vm.expectRevert();
        market.resolve(0);
    }

    function test_fullFlow_resolveAndPariMutuelPayout() public {
        IntegrityMarket market = _deployMarket(highAisAgent, 0);

        // highAisAgent stakes 100 on outcome 0 (YES), midAisAgent stakes 300 on outcome
        // 0 (YES), lowAisAgent stakes 200 on outcome 1 (NO). Total pool = 600, winning
        // (outcome 0) pool = 400. highAisAgent should receive 100/400 * 600 = 150;
        // midAisAgent should receive 300/400 * 600 = 450; lowAisAgent gets nothing.
        vm.startPrank(highAisAgent);
        itk.approve(address(market), 100 ether);
        market.enterPosition(0, 100 ether, keccak256("commit-high"));
        vm.stopPrank();

        vm.startPrank(midAisAgent);
        itk.approve(address(market), 300 ether);
        market.enterPosition(0, 300 ether, keccak256("commit-mid"));
        vm.stopPrank();

        vm.startPrank(lowAisAgent);
        itk.approve(address(market), 200 ether);
        market.enterPosition(1, 200 ether, keccak256("commit-low"));
        vm.stopPrank();

        vm.prank(resolver);
        market.resolve(0);

        assertTrue(market.wasCorrect(highAisAgent));
        assertTrue(market.wasCorrect(midAisAgent));
        assertFalse(market.wasCorrect(lowAisAgent));

        uint256 highBalanceBefore = itk.balanceOf(highAisAgent);
        vm.prank(highAisAgent);
        market.claimPayout();
        assertEq(itk.balanceOf(highAisAgent) - highBalanceBefore, 150 ether);

        uint256 midBalanceBefore = itk.balanceOf(midAisAgent);
        vm.prank(midAisAgent);
        market.claimPayout();
        assertEq(itk.balanceOf(midAisAgent) - midBalanceBefore, 450 ether);

        vm.prank(lowAisAgent);
        vm.expectRevert(IntegrityMarket.LosingPosition.selector);
        market.claimPayout();
    }

    function test_claimPayout_revertsIfAlreadyClaimed() public {
        IntegrityMarket market = _deployMarket(highAisAgent, 0);

        vm.startPrank(highAisAgent);
        itk.approve(address(market), STAKE);
        market.enterPosition(0, STAKE, keccak256("commit"));
        vm.stopPrank();

        vm.prank(resolver);
        market.resolve(0);

        vm.startPrank(highAisAgent);
        market.claimPayout();
        vm.expectRevert(IntegrityMarket.AlreadyClaimed.selector);
        market.claimPayout();
        vm.stopPrank();
    }

    function test_claimPayout_revertsBeforeResolution() public {
        IntegrityMarket market = _deployMarket(highAisAgent, 0);

        vm.startPrank(highAisAgent);
        itk.approve(address(market), STAKE);
        market.enterPosition(0, STAKE, keccak256("commit"));
        vm.expectRevert(IntegrityMarket.MarketNotResolved.selector);
        market.claimPayout();
        vm.stopPrank();
    }

    /// @notice Regression test: `resolve()` reporting the true outcome when NOBODY
    /// staked on it used to permanently lock the entire pool -- every position holder
    /// hit `LosingPosition` on `claimPayout` (none of them hold the winning outcome by
    /// definition) with no refund path. An honest resolver reporting a genuinely
    /// zero-stake outcome is a real, expected scenario (not resolver misuse), so this
    /// must resolve as a "push": every position holder gets exactly their own stake
    /// back, and the pool drains completely.
    function test_resolveToZeroStakeOutcome_refundsEveryoneTheirOwnStake() public {
        IntegrityMarket market = _deployMarket(highAisAgent, 0);

        vm.startPrank(highAisAgent);
        itk.approve(address(market), 100 ether);
        market.enterPosition(0, 100 ether, keccak256("commit-high"));
        vm.stopPrank();

        vm.startPrank(midAisAgent);
        itk.approve(address(market), 300 ether);
        market.enterPosition(0, 300 ether, keccak256("commit-mid"));
        vm.stopPrank();

        vm.startPrank(lowAisAgent);
        itk.approve(address(market), 200 ether);
        market.enterPosition(0, 200 ether, keccak256("commit-low"));
        vm.stopPrank();

        // Everyone staked on outcome 0 -- the resolver reports the true outcome (1),
        // which has zero stake.
        vm.prank(resolver);
        market.resolve(1);

        assertFalse(market.wasCorrect(highAisAgent));
        assertFalse(market.wasCorrect(midAisAgent));
        assertFalse(market.wasCorrect(lowAisAgent));

        uint256 highBalanceBefore = itk.balanceOf(highAisAgent);
        vm.prank(highAisAgent);
        market.claimPayout();
        assertEq(itk.balanceOf(highAisAgent) - highBalanceBefore, 100 ether, "must receive exactly its own stake back, not a pari-mutuel share");

        uint256 midBalanceBefore = itk.balanceOf(midAisAgent);
        vm.prank(midAisAgent);
        market.claimPayout();
        assertEq(itk.balanceOf(midAisAgent) - midBalanceBefore, 300 ether);

        uint256 lowBalanceBefore = itk.balanceOf(lowAisAgent);
        vm.prank(lowAisAgent);
        market.claimPayout();
        assertEq(itk.balanceOf(lowAisAgent) - lowBalanceBefore, 200 ether);

        assertEq(itk.balanceOf(address(market)), 0, "the pool must drain completely, no funds left stranded");
    }
}
