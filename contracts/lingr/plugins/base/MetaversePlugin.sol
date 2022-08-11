// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "./IMetaversePlugin.sol";
import "../../IMetaverse.sol";

/**
 * This is the base class of a metaverse plug-in.
 */
abstract contract MetaversePlugin is Context, ERC165, IMetaversePlugin {
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
            _metaverse.supportsInterface(type(IMetaverse).interfaceId),
            "MetaversePlugin: the owner contract must implement IMetaverseRegistrar"
        );
        metaverse = _metaverse;
    }

    /**
     * The title of this metaverse.
     */
    function title() public view virtual returns (string memory);

    /**
     * This modifier restricts function to be only invoked by the metaverse.
     */
    modifier onlyMetaverse() {
        require(msg.sender == metaverse, "MetaversePlugin: only the owning metaverse can invoke this method");
        _;
    }
    /**
     * This function holds an implementation (which could be
     * empty) for when the plugin is added to the metaverse.
     * The implementation requires the sender to be the same
     * metaverse that owns this plugin, and the underlying
     * implementation is defined by _initialize() instead.
     */
    function initialize() public onlyMetaverse {
        _initialize();
    }

    /**
     * This function holds an implementation (which could be
     * empty) for when the plugin is added to the metaverse.
     */
    function _initialize() public virtual;

    /**
     * This function returns the uri for a given token id, with
     * the same semantics of ERC1155.
     */
    function uri(uint256 _tokenId) public view virtual returns (string memory);

    /**
     * This function is a hook for when an asset, which exists
     * as registered & managed by this contract, is burned by
     * its owner or an operator previously authorized by them.
     * The implementation requires the sender to be the same
     * metaverse that owns this plugin, and the true
     * implementation is defined by _burned() instead.
     */
    function onBurned(address _operator, address _from, uint256 _tokenId, uint256 _amount) external onlyMetaverse {
        _burned(_operator, _from, _tokenId, _amount);
    }

    /**
     * This function is a hook for when an asset, which exists
     * as registered & managed by this contract, is burned by
     * its owner or an approved operator.
     */
    function _burned(address _operator, address _from, uint256 _tokenId, uint256 _amount) public virtual;

    /**
     * A metaverse plugin satisfies the IMetaversePlugin and IERC165.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165, IERC165) returns (bool) {
        return interfaceId == type(IERC165).interfaceId || interfaceId == type(IMetaversePlugin).interfaceId;
    }
}
