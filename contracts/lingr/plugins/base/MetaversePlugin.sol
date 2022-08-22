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
}
