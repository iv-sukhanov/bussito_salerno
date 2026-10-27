// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

// Each bus ticket is an ERC-721 token. A ticket is validated once when
// boarding, stays valid for DURATION, and can never be validated again.
contract BusTicket is ERC721, Ownable {
  enum Status {
    Unused,
    Active,
    Expired
  }

  uint256 public constant DURATION = 90 minutes;

  uint256 public immutable price;
  uint256 public nextId;

  // 0 = not validated yet, otherwise the timestamp of validation
  mapping(uint256 => uint256) public validatedAt;

  event TicketBought(address indexed buyer, uint256 indexed tokenId);
  event TicketValidated(address indexed rider, uint256 indexed tokenId, uint256 validUntil);

  error WrongPayment();
  error NotTicketOwner();
  error AlreadyValidated();
  error TransferAfterValidation();
  error WithdrawFailed();

  constructor(uint256 _price) ERC721("Bussito Salerno Ticket", "BUS") Ownable(msg.sender) {
    price = _price;
  }

  function buy() external payable returns (uint256 tokenId) {
    if (msg.value != price) revert WrongPayment();
    tokenId = nextId++;
    _mint(msg.sender, tokenId);
    emit TicketBought(msg.sender, tokenId);
  }

  function validate(uint256 tokenId) external {
    if (ownerOf(tokenId) != msg.sender) revert NotTicketOwner();
    if (validatedAt[tokenId] != 0) revert AlreadyValidated();
    validatedAt[tokenId] = block.timestamp;
    emit TicketValidated(msg.sender, tokenId, block.timestamp + DURATION);
  }

  // Conductor check. The conductor should also compare ownerOf(tokenId)
  // with the rider's address.
  function isValid(uint256 tokenId) public view returns (bool) {
    return status(tokenId) == Status.Active;
  }

  function status(uint256 tokenId) public view returns (Status) {
    _requireOwned(tokenId);
    uint256 t = validatedAt[tokenId];
    if (t == 0) return Status.Unused;
    if (block.timestamp < t + DURATION) return Status.Active;
    return Status.Expired;
  }

  function withdraw() external onlyOwner {
    (bool ok, ) = owner().call{value: address(this).balance}("");
    if (!ok) revert WithdrawFailed();
  }

  // Unused tickets can be transferred, validated ones cannot
  // (prevents handing an active ticket to someone else).
  function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
    address from = _ownerOf(tokenId);
    if (from != address(0) && validatedAt[tokenId] != 0) revert TransferAfterValidation();
    return super._update(to, tokenId, auth);
  }
}
