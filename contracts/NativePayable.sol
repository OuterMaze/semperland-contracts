// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * A mixin for classes which have natively payable methods.
 */
abstract contract NativePayable {
    /**
     * Requires a certain native token price.
     */
    function _requireNativeTokenPrice(string memory _concept, uint256 _price, uint256 _factor) internal {
        if (_price == 0) {
            revert(string(abi.encodePacked(_concept, " is currently disabled (no price is set)")));
        }
        if (_factor == 0) {
            revert(string(abi.encodePacked(_concept, " issued with no units to purchase")));
        }
        uint256 total = _price * _factor;
        uint256 value = msg.value;
        if (value != total) {
            revert(string(abi.encodePacked(
                _concept, " requires an exact payment of ", Strings.toString(total), " but ",
                Strings.toString(value), " was given"
            )));
        }
    }

    function _requireNoPrice(string memory _concept) internal {
        if (msg.value != 0) {
            revert(string(abi.encodePacked(
                _concept, " requires no payment in this context"
            )));
        }
    }
}
