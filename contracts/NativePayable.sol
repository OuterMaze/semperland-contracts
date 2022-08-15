// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * A mixin for classes which have natively payable methods.
 */
abstract contract NativePayable {
    /**
     * Requires an exact payment on the underlying method.
     */
    modifier hasNativeTokenPrice(string memory concept, uint256 price) {
        require(price != 0, string(abi.encodePacked(concept, " is currently disabled (no price is set)")));
        uint256 value = msg.value;
        require(value == price, string(abi.encodePacked(
            concept, " requires an exact payment of ", Strings.toString(price), " but ",
            Strings.toString(value), " was given"
        )));
        _;
    }
}
