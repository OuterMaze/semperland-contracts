// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "./IMetaversePlugin.sol";
import "../../IMetaverse.sol";
import "../../brands/IBrandRegistry.sol";

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
        require(_msgSender() == metaverse, "MetaversePlugin: only the owning metaverse can invoke this method");
        _;
    }

    /**
     * This modifier requires a specific permission or being the owner of the
     * metaverse to perform an action.
     */
    modifier onlyMetaverseAllowed(bytes32 _permission) {
        require(
            IMetaverse(metaverse).isAllowed(_permission, _msgSender()),
            "MetaversePlugin: caller is not metaverse owner, and does not have the required permission"
        );
        _;
    }

    /**
     * This modifier requires a specific permission or being the owner of the
     * the brand to perform an action.
     */
    modifier onlyBrandAllowed(address _brandId, bytes32 _permission) {
        require(
            IBrandRegistry(IMetaverse(metaverse).brandRegistry()).isBrandAllowed(_brandId, _permission, _msgSender()),
            "MetaversePlugin: caller is not brand owner nor approved, and does not have the required permission"
        );
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
     * A metaverse plugin satisfies the IMetaversePlugin and IERC165.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165, IERC165) returns (bool) {
        return interfaceId == type(IERC165).interfaceId || interfaceId == type(IMetaversePlugin).interfaceId;
    }

    /**
     * Mints a FT for a user (only types defined by this contract are available).
     */
    function _mintFTFor(address _to, uint256 _tokenId, uint256 _amount, bytes memory _data) internal {
        IMetaverse(metaverse).mintFTFor(_to, _tokenId, _amount, _data);
    }

    /**
     * Mints a NFT for a user (only types defined by this contract are available).
     * Returns the newly minted id.
     */
    function _mintNFTFor(address _to, uint256 _tokenType, bytes memory _data) internal returns (uint256) {
        return IMetaverse(metaverse).mintNFTFor(_to, _tokenType, _data);
    }

    /**
     * Burns a FT in certain amount (only types defined by this contract are available).
     */
    function _burnFT(uint256 _tokenId, uint256 _amount) internal {
        IMetaverse(metaverse).burnFT(_tokenId, _amount);
    }

    /**
     * Burns many FTs in certain amounts (only types defined by this contract are available).
     */
    function _burnFTs(uint256[] memory _tokenIds, uint256[] memory _amounts) internal {
        IMetaverse(metaverse).burnFTs(_tokenIds, _amounts);
    }

    /**
     * Burns a NFT (only types defined by this contract are available).
     */
    function _burnNFT(uint256 _tokenId) internal {
        IMetaverse(metaverse).burnNFT(_tokenId);
    }

    /**
     * Burns many NFT (only types defined by this contract are available).
     */
    function _burnNFTs(uint256[] memory _tokenIds) internal {
        IMetaverse(metaverse).burnNFTs(_tokenIds);
    }
}
