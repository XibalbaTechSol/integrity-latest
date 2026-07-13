// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {IntegrityToken} from "../src/oracle/IntegrityToken.sol";

contract IntegrityTokenTest is Test {
    IntegrityToken itk;
    address admin = makeAddr("admin");
    address minter = makeAddr("minter");
    address alice = makeAddr("alice");

    function setUp() public {
        itk = new IntegrityToken(admin, 1_000_000 ether);
    }

    function test_initialMint() public view {
        assertEq(itk.balanceOf(admin), 1_000_000 ether);
        assertEq(itk.totalMinted(), 1_000_000 ether);
    }

    function test_onlyMinterRoleCanMint() public {
        vm.prank(alice);
        vm.expectRevert();
        itk.mint(alice, 100 ether);

        bytes32 minterRole = itk.MINTER_ROLE();
        vm.prank(admin);
        itk.grantRole(minterRole, minter);

        vm.prank(minter);
        itk.mint(alice, 100 ether);
        assertEq(itk.balanceOf(alice), 100 ether);
    }

    function test_cannotExceedMaxSupply() public {
        uint256 maxSupply = itk.MAX_SUPPLY();
        uint256 remaining = maxSupply - itk.totalMinted();
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(IntegrityToken.ExceedsMaxSupply.selector, maxSupply, remaining));
        itk.mint(alice, maxSupply);
    }

    /// @notice Burning must not reopen mint headroom — the cap is on lifetime issuance,
    /// not circulating supply. Regression test for the exact accounting bug we avoided
    /// carrying over from the old prototype's fee-on-transfer design.
    function test_burningDoesNotReopenMintCap() public {
        vm.startPrank(admin);
        itk.transfer(alice, 500_000 ether);
        vm.stopPrank();

        vm.prank(alice);
        itk.burn(500_000 ether);

        assertEq(itk.totalSupply(), 500_000 ether);
        assertEq(itk.totalMinted(), 1_000_000 ether);

        // Remaining headroom is MAX_SUPPLY - totalMinted, NOT MAX_SUPPLY - totalSupply().
        uint256 remaining = itk.MAX_SUPPLY() - itk.totalMinted();
        vm.prank(admin);
        itk.mint(alice, remaining);

        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(IntegrityToken.ExceedsMaxSupply.selector, 1, uint256(0)));
        itk.mint(alice, 1);
    }

    function test_transferHasNoHiddenFee() public {
        vm.prank(admin);
        itk.transfer(alice, 1000 ether);
        // Exact amount arrives — no fee-on-transfer skimming, unlike the old prototype's
        // ITK, which would have silently delivered less than `amount`.
        assertEq(itk.balanceOf(alice), 1000 ether);
    }

    function test_zeroAmountMintReverts() public {
        vm.prank(admin);
        vm.expectRevert(IntegrityToken.ZeroAmount.selector);
        itk.mint(alice, 0);
    }
}
