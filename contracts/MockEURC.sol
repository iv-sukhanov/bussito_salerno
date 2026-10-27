// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockEURC - fake euro stablecoin for tests and demos
/// @notice Stands in for a real euro stablecoin such as Circle's EURC.
/// @dev Anyone can mint unlimited tokens. Never use in production.
contract MockEURC is ERC20 {
  constructor() ERC20("Mock Euro Coin", "mEURC") {}

  /// @notice 6 decimals like real EURC: 1 EUR = 1_000_000 units.
  function decimals() public pure override returns (uint8) {
    return 6;
  }

  /// @notice Faucet: mints `amount` tokens to `to`. No access control on purpose.
  function mint(address to, uint256 amount) external {
    _mint(to, amount);
  }
}
