pragma solidity >=0.8 <0.9.0;

import "../EscrowPoweredERC1155.sol";

contract SampleEscrowPoweredERC1155 is EscrowPoweredERC1155
{
    constructor() ERC1155("about:blank") {
        _mintBatch(_msgSender(), [1, 2, 3], [1 ether, 1 ether, 1 ether], "test");
    }
}
