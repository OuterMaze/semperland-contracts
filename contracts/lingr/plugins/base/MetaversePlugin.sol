// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
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
     * The brand 0 stands for the system.
     */
    address constant SYSTEM_SCOPE = address(0);

    /**
     * This mask captures all the enabled bits of for the id / type
     * of a FT asset.
     */
    uint256 constant FT_MASK = (1 << 255) | ((1 << 224) - 1);

    /**
     * This mask captures all the enabled bits of for the id / type
     * of a system FT asset.
     */
    uint256 constant SYSTEM_FT_MASK = (1 << 255) | ((1 << 64) - 1);

    /**
     * This mask captures all the NFT ids and types.
     */
    uint256 constant NFT_MASK = (1 << 255) - 1;

    /**
     * The metaverse that will own this plug-in.
     */
    address public metaverse;

    /**
     * Tells whether this plug-in is initialized into the metaverse or not.
     */
    bool public initialized;

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
     * The title of this metaverse plug-in.
     */
    function title() external view virtual returns (string memory);

    /**
     * This modifier restricts the function to be only invoked by the metaverse.
     */
    modifier onlyMetaverse() {
        require(_msgSender() == metaverse, "MetaversePlugin: only the owning metaverse can invoke this method");
        _;
    }

    /**
     * This modifier restricts the function to be only invoked by the metaverse's economy.
     */
    modifier onlyEconomy() {
        require(
            _msgSender() == IMetaverse(metaverse).economy(),
            "MetaversePlugin: only the owning metaverse's economy can invoke this method"
        );
        _;
    }

    /**
     * This modifier restricts the function to be only invoked by a metaverse's plug-in.
     */
    modifier onlyPlugin() {
        require(
            IMetaverse(metaverse).plugins(_msgSender()),
            "MetaversePlugin: only one of the owning metaverse's plug-ins can invoke this method"
        );
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
        _;
    }

    /**
     * This modifier requires a specific permission or being the owner of the
     * appropriate scope to perform an action. If the scope is 0, then it will
     * test a metaverse-scoped permission. Otherwise, the scope will be a brand
     * and it will test a brand-scoped permission (on that brand).
     */
    modifier onlyScopeAllowed(address _scopeId, bytes32 _metaversePermission, bytes32 _brandPermission) {
        if (_scopeId == SYSTEM_SCOPE) {
            require(
                IMetaverse(metaverse).isAllowed(_metaversePermission, _msgSender()),
                "MetaversePlugin: caller is not metaverse owner, and does not have the required permission"
            );
        } else {
            require(
                IBrandRegistry(IMetaverse(metaverse).brandRegistry()).isBrandAllowed(
                    _scopeId, _brandPermission, _msgSender()
                ),
                "MetaversePlugin: caller is not brand owner nor approved, and does not have the required permission"
            );
        }
        _;
    }

    /**
     * Requires an id to be in the system's FT id/type range.
     */
    modifier inSystemFTRange(uint256 _id) {
        require(
            _id == (_id & SYSTEM_FT_MASK),
            "MetaversePlugin: a valid system FT-ranged value is required"
        );
        _;
    }

    /**
     * Requires an id to be in the brands' FT id/type range(s).
     * If brand 0 is specified, then the only thing required in
     * the match is that it belongs to any brand. Otherwise, it
     * is also required that the brand matches the one in the
     * FT id being used.
     */
    modifier inBrandFTRange(address _brandId, uint256 _id) {
        bool rangeMatch = _id == (_id & FT_MASK);
        if (_brandId != address(0)) {
            address brandPart = address(uint160((_id >> 64) & ((1 << 160) - 1)));
            rangeMatch = rangeMatch && brandPart == _brandId;
        }
        require(rangeMatch, "MetaversePlugin: a valid brand FT-ranged value is required");
        _;
    }

    /**
     * Requires an (asset or type) id to be in the NFT range.
     */
    modifier inNFTRange(uint256 _id) {
        require(
            _id == (_id & NFT_MASK),
            "MetaversePlugin: a valid NFT-ranged value is required"
        );
        _;
    }

    /**
     * This function holds an implementation (which could be
     * empty) for when the plugin is added to the metaverse.
     * The implementation requires the sender to be the same
     * metaverse that owns this plugin, and the underlying
     * implementation is defined by _initialize() instead.
     */
    function initialize() external onlyMetaverse {
        _initialize();
        initialized = true;
    }

    /**
     * This function holds an implementation (which could be
     * empty) for when the plugin is added to the metaverse.
     */
    function _initialize() internal virtual;

    /**
     * This function returns the uri for a given token id, with
     * the same semantics of ERC1155. WARNING: this method will
     * spend a lot of gas if invoked inside a transaction, so
     * doing that is strongly discouraged.
     */
    function uri(uint256 _tokenId) external view returns (string memory) {
        bytes memory metadata = _tokenMetadata(_tokenId);
        if (metadata.length == 0) return "";
        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(metadata)));
    }

    /**
     * This function builds an appropriate JSON representation of
     * a token's metadata (by its id, instead of its type). it must
     * actually be a valid JSON (otherwise markets will not render
     * it appropriately) returned as a bytes sequence.
     */
    function _tokenMetadata(uint256 _tokenId) internal view virtual returns (bytes memory);

    /**
     * A metaverse plugin satisfies the IMetaversePlugin and IERC165.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165, IERC165) returns (bool) {
        return interfaceId == type(IERC165).interfaceId || interfaceId == type(IMetaversePlugin).interfaceId;
    }

    /**
     * Defines a new FT type in the system scope (i.e. not a brand at all).
     * Returns its id.
     */
    function _defineNextSystemFTType() internal returns (uint256) {
        return _defineNextFTType(address(0));
    }

    /**
     * Defines a new FT type, tied to a brand (use address 0 for metaverse-wide
     * FT types). Returns its id.
     */
    function _defineNextFTType(address _brandId) internal returns (uint256) {
        return IMetaverse(metaverse).defineNextFTType(_brandId);
    }

    /**
     * Defines a new NFT type. Returns its id.
     */
    function _defineNextNFTType() internal returns (uint256) {
        return IMetaverse(metaverse).defineNextNFTType();
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
