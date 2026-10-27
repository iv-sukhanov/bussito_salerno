// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title BusTicket - single-use bus tickets for Salerno as NFTs
/// @notice Lifecycle: buy() -> UNUSED -> validate() -> ACTIVE (90 min) -> EXPIRED.
///         Riders pay in a euro stablecoin, validate when boarding, and a
///         conductor checks the ticket with the free isValid() call.
/// @dev Data minimisation: per ticket we only store the validation timestamp,
///      and our own events contain no addresses. Owners and payments are still
///      public through the ERC-721 / ERC-20 standards and the transactions
///      themselves; riders should use a fresh address per ticket.
contract BusTicket is ERC721, Ownable {
  // SafeERC20 reverts on failed token transfers, even for tokens that
  // return `false` instead of reverting.
  using SafeERC20 for IERC20;

  enum Status {
    Unused,
    Active,
    Expired
  }

  /// @notice How long a ticket is valid after validation.
  uint256 public constant DURATION = 90 minutes;

  /// @notice Euro stablecoin accepted as payment.
  IERC20 public immutable paymentToken;

  /// @notice Ticket price in the token's smallest unit (1_300_000 = 1.30 EUR).
  uint256 public immutable price;

  /// @notice ID of the next ticket to be minted.
  uint256 public nextId;

  /// @notice tokenId => validation timestamp. 0 means not validated yet.
  mapping(uint256 => uint256) public validatedAt;

  event TicketBought(uint256 indexed tokenId);
  event TicketValidated(uint256 indexed tokenId, uint256 validUntil);

  error NotTicketOwner();
  error AlreadyValidated();
  error TransferAfterValidation();

  constructor(IERC20 _paymentToken, uint256 _price)
    ERC721("Bussito Salerno Ticket", "BUS")
    Ownable(msg.sender)
  {
    paymentToken = _paymentToken;
    price = _price;
  }

  /// @notice Buy one ticket for `price`.
  /// @dev The rider must first call `paymentToken.approve(thisContract, price)`.
  ///      State (nextId) is updated before the external token call
  ///      (checks-effects-interactions).
  function buy() external returns (uint256 tokenId) {
    tokenId = nextId++;
    paymentToken.safeTransferFrom(msg.sender, address(this), price);
    _mint(msg.sender, tokenId);
    emit TicketBought(tokenId);
  }

  /// @notice Validate a ticket when boarding. Each ticket can be validated only once.
  function validate(uint256 tokenId) external {
    if (ownerOf(tokenId) != msg.sender) revert NotTicketOwner();
    // Any non-zero timestamp means it was used before, active or expired.
    if (validatedAt[tokenId] != 0) revert AlreadyValidated();
    validatedAt[tokenId] = block.timestamp;
    emit TicketValidated(tokenId, block.timestamp + DURATION);
  }

  /// @notice Conductor check: true while the ticket is Active.
  /// @dev The conductor should also verify ownerOf(tokenId) is the rider.
  function isValid(uint256 tokenId) public view returns (bool) {
    return status(tokenId) == Status.Active;
  }

  /// @notice Current state of a ticket. Reverts if the ticket doesn't exist.
  function status(uint256 tokenId) public view returns (Status) {
    _requireOwned(tokenId);
    uint256 t = validatedAt[tokenId];
    if (t == 0) return Status.Unused;
    if (block.timestamp < t + DURATION) return Status.Active;
    return Status.Expired;
  }

  /// @notice Send all collected revenue to the owner.
  function withdraw() external onlyOwner {
    paymentToken.safeTransfer(owner(), paymentToken.balanceOf(address(this)));
  }

  /// @dev Hook called by ERC721 on every mint/transfer/burn. Blocks transfers
  ///      of validated tickets so an active ticket can't be handed to someone
  ///      else. Minting (from == address(0)) is always allowed.
  function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
    address from = _ownerOf(tokenId);
    if (from != address(0) && validatedAt[tokenId] != 0) revert TransferAfterValidation();
    return super._update(to, tokenId, auth);
  }
}
