// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

/**
 * This is the linked economy of a metaverse. It can send certain
 * messages to the core metaverse (essentially, messages for when
 * an asset is burned / transferred), and receive messages from
 * the metaverse (e.g. messages to mint certain objects).
 */
interface IEconomy is IERC1155 {
    /**
     * The metaverse this economy system is created for.
     */
    function metaverse() external view returns (address);

    /**
     * Mints a token for a particular account.
     */
    function mintFor(address _to, uint256 _tokenId, uint256 _amount, bytes _data) external;
}