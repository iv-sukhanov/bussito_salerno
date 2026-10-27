// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {BusTicket} from "./BusTicket.sol";
import {MockEURC} from "./MockEURC.sol";
import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

contract BusTicketTest is Test {
  BusTicket ticket;
  MockEURC eurc;

  uint256 constant PRICE = 1_300_000; // 1.30 EUR

  address admin = makeAddr("admin");
  address rider = makeAddr("rider");
  address other = makeAddr("other");

  function setUp() public {
    eurc = new MockEURC();
    vm.prank(admin);
    ticket = new BusTicket(eurc, PRICE);

    // Fund the rider with 10 EUR and approve the ticket contract to spend it.
    eurc.mint(rider, 10_000_000);
    vm.prank(rider);
    eurc.approve(address(ticket), type(uint256).max);
  }

  function _buy() internal returns (uint256) {
    vm.prank(rider);
    return ticket.buy();
  }

  // --- Buying ---

  function test_BuyMintsTicketAndTakesPayment() public {
    uint256 id = _buy();
    assertEq(ticket.ownerOf(id), rider);
    assertEq(ticket.balanceOf(rider), 1);
    assertEq(eurc.balanceOf(rider), 10_000_000 - PRICE);
    assertEq(eurc.balanceOf(address(ticket)), PRICE);
  }

  function test_BuyEmitsEventWithoutAddress() public {
    vm.expectEmit(address(ticket));
    emit BusTicket.TicketBought(0);
    _buy();
  }

  function test_BuyWithoutApprovalReverts() public {
    eurc.mint(other, PRICE);
    vm.prank(other);
    vm.expectRevert(
      abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, address(ticket), 0, PRICE)
    );
    ticket.buy();
  }

  function test_BuyWithoutEnoughBalanceReverts() public {
    vm.startPrank(other);
    eurc.approve(address(ticket), PRICE);
    vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, other, 0, PRICE));
    ticket.buy();
    vm.stopPrank();
  }

  // --- Validation ---

  function test_NewTicketIsUnusedAndNotValid() public {
    uint256 id = _buy();
    assertEq(uint256(ticket.status(id)), uint256(BusTicket.Status.Unused));
    assertFalse(ticket.isValid(id));
  }

  function test_ValidateMakesTicketValid() public {
    uint256 id = _buy();
    vm.expectEmit(address(ticket));
    emit BusTicket.TicketValidated(id, block.timestamp + ticket.DURATION());
    vm.prank(rider);
    ticket.validate(id);
    assertTrue(ticket.isValid(id));
  }

  function test_ValidateByNonOwnerReverts() public {
    uint256 id = _buy();
    vm.prank(other);
    vm.expectRevert(BusTicket.NotTicketOwner.selector);
    ticket.validate(id);
  }

  // --- Single use ---

  function test_CannotValidateTwice() public {
    uint256 id = _buy();
    vm.startPrank(rider);
    ticket.validate(id);
    vm.expectRevert(BusTicket.AlreadyValidated.selector);
    ticket.validate(id);
    vm.stopPrank();
  }

  function test_CannotValidateAgainAfterExpiry() public {
    uint256 id = _buy();
    vm.startPrank(rider);
    ticket.validate(id);
    vm.warp(block.timestamp + 1 days);
    vm.expectRevert(BusTicket.AlreadyValidated.selector);
    ticket.validate(id);
    vm.stopPrank();
  }

  // --- Expiry ---

  function test_TicketExpiresAfterDuration() public {
    uint256 id = _buy();
    vm.prank(rider);
    ticket.validate(id);

    vm.warp(block.timestamp + 89 minutes);
    assertTrue(ticket.isValid(id));

    vm.warp(block.timestamp + 2 minutes);
    assertFalse(ticket.isValid(id));
    assertEq(uint256(ticket.status(id)), uint256(BusTicket.Status.Expired));
  }

  // --- Transfers ---

  function test_UnusedTicketCanBeTransferred() public {
    uint256 id = _buy();
    vm.prank(rider);
    ticket.transferFrom(rider, other, id);
    assertEq(ticket.ownerOf(id), other);
  }

  function test_ValidatedTicketCannotBeTransferred() public {
    uint256 id = _buy();
    vm.startPrank(rider);
    ticket.validate(id);
    vm.expectRevert(BusTicket.TransferAfterValidation.selector);
    ticket.transferFrom(rider, other, id);
    vm.stopPrank();
  }

  // --- Admin ---

  function test_OwnerCanWithdraw() public {
    _buy();
    _buy();
    vm.prank(admin);
    ticket.withdraw();
    assertEq(eurc.balanceOf(admin), 2 * PRICE);
    assertEq(eurc.balanceOf(address(ticket)), 0);
  }

  function test_NonOwnerCannotWithdraw() public {
    _buy();
    vm.prank(rider);
    vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, rider));
    ticket.withdraw();
  }
}
