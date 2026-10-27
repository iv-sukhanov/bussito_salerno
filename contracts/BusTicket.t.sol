// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {BusTicket} from "./BusTicket.sol";
import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract BusTicketTest is Test {
  BusTicket ticket;

  uint256 constant PRICE = 0.001 ether;
  address admin = makeAddr("admin");
  address rider = makeAddr("rider");
  address other = makeAddr("other");

  function setUp() public {
    vm.prank(admin);
    ticket = new BusTicket(PRICE);
    vm.deal(rider, 1 ether);
  }

  function _buy() internal returns (uint256) {
    vm.prank(rider);
    return ticket.buy{value: PRICE}();
  }

  function test_BuyMintsTicket() public {
    uint256 id = _buy();
    assertEq(ticket.ownerOf(id), rider);
    assertEq(ticket.balanceOf(rider), 1);
    assertEq(address(ticket).balance, PRICE);
  }

  function test_BuyWithWrongPaymentReverts() public {
    vm.prank(rider);
    vm.expectRevert(BusTicket.WrongPayment.selector);
    ticket.buy{value: PRICE - 1}();
  }

  function test_NewTicketIsUnusedAndNotValid() public {
    uint256 id = _buy();
    assertEq(uint256(ticket.status(id)), uint256(BusTicket.Status.Unused));
    assertFalse(ticket.isValid(id));
  }

  function test_ValidateMakesTicketValid() public {
    uint256 id = _buy();
    vm.expectEmit(address(ticket));
    emit BusTicket.TicketValidated(rider, id, block.timestamp + ticket.DURATION());
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

  function test_OwnerCanWithdraw() public {
    _buy();
    vm.prank(admin);
    ticket.withdraw();
    assertEq(admin.balance, PRICE);
    assertEq(address(ticket).balance, 0);
  }

  function test_NonOwnerCannotWithdraw() public {
    _buy();
    vm.prank(rider);
    vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, rider));
    ticket.withdraw();
  }
}
