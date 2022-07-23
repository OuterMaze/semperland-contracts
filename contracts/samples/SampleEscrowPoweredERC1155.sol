// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "../EscrowPoweredERC1155.sol";

contract SampleEscrowPoweredERC1155 is EscrowPoweredERC1155
{
    constructor() EscrowPoweredERC1155("about:blank") {
        _mint(_msgSender(), 1, 1 ether, "test");
        _mint(_msgSender(), 2, 2 ether, "test");
        _mint(_msgSender(), 3, 3 ether, "test");
    }
}
