// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

/**
 * A contract satisfying this interface is considered a plug-in
 * for a metaverse.
 */
interface IMetaversePlugin {
    /**
     * The title of this metaverse.
     */
    function title() external view returns (string memory);

    /**
     * The metaverse this plug-in was created for.
     */
    function metaverse() external view returns (address);

    /**
     * This function holds an implementation (which could be
     * empty) for when the plugin is added to the metaverse.
     */
    function initialize() external;

    /**
     * This function returns the uri for a given token id, with
     * the same semantics of ERC1155.
     */
    function uri(uint256 _tokenId) external view returns (string memory);

    /**
     * This function is a hook for when an asset, which exists
     * as registered & managed by this contract, is burned by
     * its owner.
     */
    function burned(address _from, uint256 _tokenId, uint256 _amount) external;
}
