// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {CoveredEntityRegistry} from "../../src/shield/CoveredEntityRegistry.sol";
import {SmartBAAFactory} from "../../src/shield/SmartBAAFactory.sol";
import {SmartBAA} from "../../src/shield/SmartBAA.sol";
import {IntegrityToken} from "../../src/oracle/IntegrityToken.sol";

/// @notice Full lifecycle test across SmartBAAFactory + SmartBAA + CoveredEntityRegistry
/// + IntegrityToken collateral — the escrow/dispute machinery that's the whole point of
/// the shield HIPAA vertical.
contract SmartBAATest is Test {
    CoveredEntityRegistry entityRegistry;
    SmartBAAFactory factory;
    IntegrityToken itk;

    address admin = makeAddr("admin");
    address arbitrator = makeAddr("arbitrator");
    address hospital = makeAddr("hospital");
    address aiAgent = makeAddr("aiAgent");
    uint256 constant COLLATERAL = 5_000 ether;

    function setUp() public {
        itk = new IntegrityToken(admin, 1_000_000 ether);
        entityRegistry = new CoveredEntityRegistry(admin);
        factory = new SmartBAAFactory(address(entityRegistry), address(itk), arbitrator, admin);

        vm.prank(admin);
        entityRegistry.registerEntity(hospital, CoveredEntityRegistry.EntityType.CoveredEntity, "uri");

        vm.prank(admin);
        itk.transfer(aiAgent, COLLATERAL * 2);
    }

    function _createAndSignBAA() internal returns (SmartBAA baa) {
        vm.prank(hospital);
        address baaAddr = factory.createBAA(aiAgent, keccak256("legal-doc-v1"), COLLATERAL);
        baa = SmartBAA(baaAddr);

        vm.startPrank(aiAgent);
        itk.approve(baaAddr, COLLATERAL);
        baa.sign();
        vm.stopPrank();
    }

    function test_nonCoveredEntityCannotCreateBAA() public {
        vm.prank(aiAgent);
        vm.expectRevert(SmartBAAFactory.NotActiveCoveredEntity.selector);
        factory.createBAA(aiAgent, keccak256("doc"), COLLATERAL);
    }

    function test_signActivatesAndLocksCollateral() public {
        SmartBAA baa = _createAndSignBAA();

        assertEq(uint8(baa.status()), uint8(SmartBAA.Status.Active));
        assertEq(itk.balanceOf(address(baa)), COLLATERAL);
        assertTrue(factory.isBAAActive(hospital, aiAgent));
    }

    function test_disputeAndSlash_paysCoveredEntity() public {
        SmartBAA baa = _createAndSignBAA();

        vm.prank(hospital);
        baa.raiseDispute();
        assertEq(uint8(baa.status()), uint8(SmartBAA.Status.Disputed));
        assertFalse(factory.isBAAActive(hospital, aiAgent)); // disputed != active

        uint256 hospitalBalBefore = itk.balanceOf(hospital);
        vm.prank(arbitrator);
        baa.arbitrate(true);

        assertEq(uint8(baa.status()), uint8(SmartBAA.Status.Terminated));
        assertEq(itk.balanceOf(hospital), hospitalBalBefore + COLLATERAL);
        assertEq(itk.balanceOf(address(baa)), 0);
    }

    function test_disputeDismissed_returnsToActive() public {
        SmartBAA baa = _createAndSignBAA();

        vm.prank(hospital);
        baa.raiseDispute();

        vm.prank(arbitrator);
        baa.arbitrate(false);

        assertEq(uint8(baa.status()), uint8(SmartBAA.Status.Active));
        assertEq(itk.balanceOf(address(baa)), COLLATERAL); // untouched
        assertTrue(factory.isBAAActive(hospital, aiAgent));
    }

    function test_revokeReturnsCollateralToAgent() public {
        SmartBAA baa = _createAndSignBAA();

        uint256 agentBalBefore = itk.balanceOf(aiAgent);
        vm.prank(hospital);
        baa.revoke();

        assertEq(uint8(baa.status()), uint8(SmartBAA.Status.Terminated));
        assertEq(itk.balanceOf(aiAgent), agentBalBefore + COLLATERAL);
    }

    function test_cannotRevokeWhileDisputed() public {
        SmartBAA baa = _createAndSignBAA();
        vm.prank(hospital);
        baa.raiseDispute();

        vm.prank(hospital);
        vm.expectRevert(abi.encodeWithSelector(SmartBAA.WrongStatus.selector, SmartBAA.Status.Disputed));
        baa.revoke();
    }

    function test_onlyArbitratorCanArbitrate() public {
        SmartBAA baa = _createAndSignBAA();
        vm.prank(hospital);
        baa.raiseDispute();

        vm.prank(hospital);
        vm.expectRevert(SmartBAA.NotArbitrator.selector);
        baa.arbitrate(true);
    }

    function test_duplicateBAABetweenSamePairReverts() public {
        _createAndSignBAA();
        vm.prank(hospital);
        vm.expectRevert(SmartBAAFactory.BAAAlreadyExists.selector);
        factory.createBAA(aiAgent, keccak256("another-doc"), COLLATERAL);
    }

    function test_unsignedBAAIsNotActive() public {
        vm.prank(hospital);
        factory.createBAA(aiAgent, keccak256("doc"), COLLATERAL);
        assertFalse(factory.isBAAActive(hospital, aiAgent));
    }
}
