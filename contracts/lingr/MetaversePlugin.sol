// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import "./IMetaversePlugin.sol";
import "./IMetaverseRegistrar.sol";

/**
 * This is the base class of a metaverse plug-in.
 */
abstract contract MetaversePlugin is Context, IMetaversePlugin {
    /**
     * Addresses can check for ERC165 compliance by using this
     * embeddable library.
     */
    using ERC165Checker for address;

    /**
     * The metaverse that will own this plug-in.
     */
    address public metaverse;

    /**
     * Creating a metaverse plug-in requires a valid metaverse
     * registrar as its owner.
     */
    constructor(address _metaverse) {
        require(_metaverse != address(0), "MetaversePlugin: the owner contract must not be 0");
        require(
            _metaverse.supportsInterface(type(IMetaverseRegistrar).interfaceId),
            "MetaversePlugin: the owner contract must implement IMetaverseRegistrar"
        );
        metaverse = _metaverse;
    }

    /**
     * The title of this metaverse.
     */
    function title() public view virtual returns (string memory);

    /**
     * This function holds an implementation (which could be
     * empty) for when the plugin is added to the metaverse.
     */
    function initialize() public virtual;

    /**
     * This function returns the uri for a given token id, with
     * the same semantics of ERC1155.
     */
    function uri(uint256 _tokenId) public view virtual returns (string memory);

    /**
     * This function is a hook for when an asset, which exists
     * as registered & managed by this contract, is burned by
     * its owner.
     */
    function burned(address _from, uint256 _tokenId, uint256 _amount) public virtual;
}
