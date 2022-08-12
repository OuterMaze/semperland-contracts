// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import "./plugins/base/IMetaversePlugin.sol";
import "./IMetaverse.sol";
import "./economy/IEconomy.sol";
import "./brands/IBrandRegistry.sol";

/**
 * A metaverse hub can receive "plugs" (extensions) in the form of
 * different contracts (implementing IMetaversePlugin). This
 * plug mechanism allows extending the metaverse with new asset
 * types and new asset instances (each plug-in is managed by the
 * team, not publicly added by external users).
 *
 * Each of those contracts will make use of their own logic while
 * interacting with the metaverse, which involves having full access
 * to the whole metaverse assets (e.g. taking assets from the users
 * or granting assets to the users).
 */
contract Metaverse is Ownable, IMetaverse {
    /**
     * Addresses can check for ERC165 compliance by using this
     * embeddable library.
     */
    using ERC165Checker for address;

    /**
     * This is the list of plug-ins that are being added to the hub.
     * Each contract has its separate logic but they have access to
     * the same set of features. Once a contract is added, it will
     * never be removed from this list. This mapping tells whether
     * a contract in particular has permission(s) to define a type
     * and mint tokens for an address.
     */
    mapping(address => bool) public plugins;

    /**
     * This is the enumerable list of plug-ins added to this hub.
     */
    address[] public pluginsList;

    /**
     * The linked brand registry for this metaverse.
     */
    address public brandRegistry;

    /**
     * The linked economy for this metaverse.
     */
    address public economy;

    /**
     * Types are identified as integer values, and each registered type
     * will have a non-zero responsible address (serving to metadata
     * resolution and also to account for the existence of a given type).
     * The type 1 (0x1) will be the first type, and actually it will be
     * the brand type. Other NFT types will be registered using indices
     * lower to (1<<255), while FT types will be registered using indices
     * greater than or equal to that value (i.e. starting with binary {1}).
     * In the case of the FTs, the index in this mapping is also their
     * token id. This is not the same for NFTs (they have one extra level
     * of indirection since multiple ids might share the same type). A
     * special type id will be regarded as invalid type (i.e. it will
     * not count as NFT nor FT type, but as a non-existent type): 0 (0x0).
     *
     * The responsible serves two purposes: The first one, is to resolve
     * the metadata of a given token id (be it FT or NFT). The second one
     * is to account for one of such tokens being burned. The responsible
     * will actually be one of the registered plug-ins, on each case (save
     * for the brands case, which is resolved by this contract, and the
     * invalid case, which has no resolver).
     */
    mapping(uint256 => address) public tokenTypeResolvers;

    /**
     * Now, each NFT id will be registered here along its token type. The
     * difference with the fungible tokens (they're already registered in
     * the `tokenTypes` mapping) is that they need to be registered with
     * a particular token type. Also, both the NFT id and its associated
     * token type will be lower than (1<<255) since, otherwise, they would
     * be using values corresponding to the FT side (both for IDs and type
     * indices). Brand NFTs are not included in this mapping (they are only
     * characterized by being < (1 << 160)).
     */
    mapping(uint256 => uint256) public nftTypes;

    /**
     * Holds the next FT index to try, in the next iteration, for respective
     * brand(s) requesting one. These ids are, at most, 1<<64 - 1.
     */
    mapping(address => uint64) private nextFTIndex;

    /**
     * Holds the next NFT type to try, in the next iteration. The initial
     * value to try is 2 (0 means "invalid" and 1 means "brand").
     */
    uint256 private nextNFTTypeIndex = 2;

    /**
     * Holds the next NFT index to try, in the next iteration. The initial
     * value to try is 1 above the maximum value brand addresses can take.
     */
    uint256 private nextNFTIndex = 1 << 160;

    /**
     * Permission: Superuser (all the permissions are considered given to
     * a superuser which is registered in the metaverse). The only thing
     * that superuser per-se cannot do is to add more superusers.
     */
    bytes32 constant SUPERUSER = bytes32(uint256((1 << 256) - 1));

    /**
     * Permission: To add a plug-in.
     */
    bytes32 constant ADD_PLUGIN = keccak256("Metaverse::AddPlugin");

    /**
     * Permission: To set a brand registry.
     */
    bytes32 constant SET_BRAND_REGISTRY = keccak256("Metaverse::SetBrandRegistry");

    /**
     * Permission: To set the related economy.
     */
    bytes32 constant SET_ECONOMY = keccak256("Metaverse::SetEconomy");

    /**
     * Maintains the permissions assigned to this metaverse.
     */
    mapping(bytes32 => mapping(address => bool)) permissions;

    /**
     * This modifier requires the sender to be one of the authorized contracts.
     */
    modifier onlyPlugin() {
        require(plugins[_msgSender()], "Metaverse: the sender must be a plug-in");
        _;
    }

    /**
     * This modifier requires the token type to be already registered.
     */
    modifier onlyExistingTokenType(uint256 _tokenType) {
        require(tokenTypeResolvers[_tokenType] != address(0), "Metaverse: unknown / non-mintable token type id");
        _;
    }

    /**
     * This modifier requires the token type to be already registered
     * by the plug-in that requests it.
     */
    modifier onlyPluginTokenType(uint256 _tokenType) {
        require(tokenTypeResolvers[_tokenType] == _msgSender(), "Metaverse: not a type registered by this plug-in");
        _;
    }

    /**
     * This modifier requires the token types to be already registered
     * by the plug-in that requests it (they're FTs).
     */
    modifier onlyFTPluginTokenTypes(uint256[] memory _tokenTypes) {
        for(uint256 index = 0; index < _tokenTypes.length; index++) {
            require(
                tokenTypeResolvers[_tokenTypes[index]] == _msgSender(),
                "Metaverse: not a type registered by this plug-in"
            );
        }
        _;
    }

    /**
     * This modifier requires the token types to be already registered
     * by the plug-in that requests it (they're NFTs).
     */
    modifier onlyNFTPluginTokenTypes(uint256[] memory _tokenTypes) {
        for(uint256 index = 0; index < _tokenTypes.length; index++) {
            require(
                tokenTypeResolvers[nftTypes[_tokenTypes[index]]] == _msgSender(),
                "Metaverse: not a type registered by this plug-in"
            );
        }
        _;
    }

    /**
     * This modifier requires the token type to be in the FT range.
     */
    modifier onlyFTRange(uint256 _tokenType) {
        require(_tokenType >= (1 << 255), "Metaverse: the specified value is not in the fungible tokens range");
        _;
    }

    /**
     * This modifier requires the token type to be in the NFT range.
     */
    modifier onlyNFTRange(uint256 _tokenType) {
        require(_tokenType < (1 << 255), "Metaverse: the specified value is not in the nft range");
        _;
    }

    /**
     * Defines the resolution of a fungible token type. The token id must be
     * in the range of the fungible token ids.
     */
    function defineNextFTType(address _brandId) external onlyPlugin returns (uint256) {
        uint64 tokenTypeIndex = nextFTIndex[_brandId];
        uint256 tokenType = (1 << 255) | (uint256(uint160(_brandId)) << 64) | tokenTypeIndex;
        while(true) {
            require(tokenTypeIndex < 0xffffffffffffffff, "Metaverse: cannot define more FT types for this address");
            if (tokenTypeResolvers[tokenType] != address(0)) {
                tokenTypeIndex += 1;
                tokenType += 1;
            } else {
                break;
            }
        }
        nextFTIndex[_brandId] = tokenTypeIndex + 1;
        tokenTypeResolvers[tokenType] = _msgSender();
        return tokenType;
    }

    /**
     * Defines the resolution of a non-fungible token type. The token id must
     * be in the range of the fungible token (type) ids (strictly > 0, strictly
     * < (1 << 255)).
     */
    function defineNextNFTType() external onlyPlugin returns (uint256) {
        uint256 tokenTypeId = nextNFTTypeIndex;
        uint256 lastNFTType = (1 << 255) - 1;
        while(true) {
            require(tokenTypeId < lastNFTType, "Metaverse: cannot define more NFT types");
            if (tokenTypeResolvers[tokenTypeId] != address(0)) {
                tokenTypeId += 1;
            } else {
                break;
            }
        }
        nextNFTTypeIndex = tokenTypeId + 1;
        tokenTypeResolvers[tokenTypeId] = _msgSender();
        return tokenTypeId;
    }

    /**
     * Mints a specific fungible token type, in a certain amount.
     */
    function mintFTFor(address _to, uint256 _tokenId, uint256 _amount, bytes memory _data)
        external onlyPlugin onlyPluginTokenType(_tokenId) onlyFTRange(_tokenId)
    {
        IEconomy(economy).mintFor(_to, _tokenId, _amount, _data);
    }

    /**
     * Mints a specific non-fungible token type, using a specific type (and always using
     * an amount of 1). It is an error if the chosen type is unknown or < 2, since those
     * types are reserved for being invalid or brands. Also, it is an error if the chosen
     * type is not for that plug-in.
     */
    function mintNFTFor(address _to, uint256 _tokenType, bytes memory _data)
        external onlyPlugin onlyPluginTokenType(_tokenType) onlyNFTRange(_tokenType) returns (uint256)
    {
        require(_tokenType >= 2, "Metaverse: NFT types 0 (invalid) and 1 (brand) cannot be minted");
        uint256 tokenId = nextNFTIndex;
        uint256 lastNFTId = (1 << 255) - 1;
        while(true) {
            require(tokenId < lastNFTId, "Metaverse: cannot mint more NFTs");
            if (nftTypes[tokenId] != 0) {
                tokenId += 1;
            } else {
                break;
            }
        }
        nextNFTIndex = tokenId + 1;
        IEconomy(economy).mintFor(_to, tokenId, 1, _data);
        nftTypes[tokenId] = _tokenType;
        return tokenId;
    }

    /**
     * Burns any FT the sender has, provided the sender is a plugin and also defines
     * the type of the token being burned.
     */
    function burnFT(uint256 _tokenId, uint256 _amount) external onlyPlugin onlyPluginTokenType(_tokenId) {
        IEconomy(economy).burn(_msgSender(), _tokenId, _amount);
    }

    /**
     * Burns many FT the sender has, provided the sender is a plugin and also defines
     * the type of the token being burned.
     */
    function burnFTs(uint256[] memory _tokenIds, uint256[] memory _amounts) external
        onlyPlugin onlyFTPluginTokenTypes(_tokenIds) {
        IEconomy(economy).burnBatch(_msgSender(), _tokenIds, _amounts);
    }

    /**
     * Burns any NFT the sender has, provided the sender is a plugin and also defines
     * the type of the tokens being burned.
     */
    function burnNFT(uint256 _tokenId) external onlyPlugin onlyPluginTokenType(nftTypes[_tokenId]) {
        IEconomy(economy).burn(_msgSender(), _tokenId, 1);
    }

    /**
     * Burns many NFT the sender has, provided the sender is a plugin and also defines
     * the type of the tokens being burned.
     */
    function burnNFTs(uint256[] memory _tokenIds) external onlyPlugin onlyNFTPluginTokenTypes(_tokenIds) {
        uint256 length = _tokenIds.length;
        uint256[] memory amounts = new uint[](length);
        for (uint i = 0; i < length; i++) amounts[i] = 1;
        IEconomy(economy).burnBatch(_msgSender(), _tokenIds, amounts);
    }

    /**
     * Mints a specific brand token for a given user. The brand is stated as its address.
     */
    function mintBrandFor(address _to, address _brandId) external {
        require(_msgSender() == brandRegistry, "Metaverse: the only allowed sender is the brand registry");
        IEconomy(economy).mintFor(_to, uint256(uint160(_brandId)), 1, "Metaverse: Minting a brand");
    }

    /**
     * Retrieves the metadata uri from the appropriate plug-in, if any. If the type id is
     * not registered then return an empty string.
     */
    function _metadataFromPlugin(uint256 _typeId) private view returns (string memory) {
        address plugin = tokenTypeResolvers[_typeId];
        if (plugin == address(0)) {
            return "";
        }
        return IMetaversePlugin(plugin).uri(_typeId);
    }

    /**
     * Retrieves the metadata uri of a given token. WARNING: This method
     * will consume a lot of gas if invoked inside a transaction, so
     * it is recommended to invoke this method in the context of a
     * CALL, and never in the context of a SEND (even as part of other
     * contract's code).
     */
    function tokenURI(uint256 _tokenId) external view returns (string memory) {
        if (_tokenId < (1 << 160)) {
            return IBrandRegistry(brandRegistry).brandMetadataURI(address(uint160(_tokenId)));
        } else if (_tokenId < (1 << 255)) {
            return _metadataFromPlugin(nftTypes[_tokenId]);
        } else {
            return _metadataFromPlugin(_tokenId);
        }
    }

    /**
     * Hook to be invoked as part of a transfer from ERC1155.
     */
    function onBrandOwnerChanged(address _brandId, address _newOwner) external onlyEconomy {
        IBrandRegistry(brandRegistry).onBrandOwnerChanged(_brandId, _newOwner);
    }

    // ********** Plugin management goes here **********

    /**
     * Tells whether an address is a valid metaverse plug-in contract for
     * this metaverse in particular.
     */
    function _isPluginForThisMetaverse(address _plugin) private view returns (bool) {
        return _plugin.supportsInterface(type(IMetaversePlugin).interfaceId) &&
            IMetaversePlugin(_plugin).metaverse() == address(this);
    }

    /**
     * Adds a plug-in contract to this metaverse.
     */
    function addPlugin(address _contract) public onlyAllowed(ADD_PLUGIN) {
        require(
            _isPluginForThisMetaverse(_contract),
            "Metaverse: the address does not belong to a valid plug-in contract for this metaverse"
        );
        require(
            !plugins[_contract], "Metaverse: the plug-in is already added to this metaverse"
        );
        plugins[_contract] = true;
        pluginsList.push(_contract);
        IMetaversePlugin(_contract).initialize();
    }

    /**
     * This is the count of registered plug-ins.
     */
    function pluginsCount() public view returns (uint256) {
        return pluginsList.length;
    }

    /**
     * Tells whether an address is a valid brand registry contract for
     * this metaverse in particular.
     */
    function _isBrandRegistryForThisMetaverse(address _registry) private view returns (bool) {
        return _registry.supportsInterface(type(IBrandRegistry).interfaceId) &&
            IBrandRegistry(_registry).metaverse() == address(this);
    }

    /**
     * Adds a plug-in contract to this metaverse.
     */
    function setBrandRegistry(address _contract) public onlyAllowed(SET_BRAND_REGISTRY) {
        require(
            _isBrandRegistryForThisMetaverse(_contract),
            "Metaverse: the address does not belong to a valid brand registry contract for this metaverse"
        );
        require(
            brandRegistry == address(0), "Metaverse: a brand registry is already set into this metaverse"
        );
        brandRegistry = _contract;
    }

    /**
     * Tells whether an address is a valid economy system contract for
     * this metaverse in particular.
     */
    function _isEconomyForThisMetaverse(address _economy) private view returns (bool) {
        return _economy.supportsInterface(type(IEconomy).interfaceId) &&
            IEconomy(_economy).metaverse() == address(this);
    }

    /**
     * Set the economy contract to this metaverse.
     */
    function setEconomy(address _contract) public onlyAllowed(SET_ECONOMY) {
        require(
            _isEconomyForThisMetaverse(_contract),
            "Metaverse: the address does not belong to a valid economy contract for this metaverse"
        );
        require(
            economy == address(0), "Metaverse: an economy is already set into this metaverse"
        );
        economy = _contract;
    }

    /**
     * This modifier restricts a call to the linked economy system.
     */
    modifier onlyEconomy() {
        require(_msgSender() == economy, "Metaverse: the only allowed sender is the economy system");
        _;
    }

    /**
     * A metaverse satisfies the IMetaverse and IERC165 interfaces.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IERC165).interfaceId || interfaceId == type(IMetaverse).interfaceId;
    }

    // TODO: Implement many features:
    // 1. A sample contract defining a COIN type and a dumb DEED type.
    // 2. TEST everything.

    // Permissions management start here.

    /**
     * Restricts an action to senders that are considered to have
     * certain permission in the metaverse.
     */
    modifier onlyAllowed(bytes32 _permission) {
        require(
            isAllowed(_permission, _msgSender()),
            "Metaverse: caller is not metaverse owner, and does not have the required permission"
        );
        _;
    }

    /**
     * Tells whether a user has a specific permission on the metaverse, or
     * is its owner.
     */
    function isAllowed(bytes32 _permission, address _sender) public view returns (bool) {
        return _sender == owner() || permissions[_permission][_sender];
    }

    /**
     * Grants a permission to a user. This action is reserved to owners,
     * approved operators, or allowed superusers. However, superuser cannot
     * set, in particular, the SUPERUSER permission itself.
     */
    function setPermission(bytes32 _permission, address _user, bool _allowed) public onlyAllowed(SUPERUSER) {
        address sender = _msgSender();
        require(_user != address(0), "Metaverse: cannot grant a permission to address 0");
        require(
            sender == owner() || _permission != SUPERUSER,
            "Metaverse: SUPERUSER permission cannot be added by this user"
        );
        permissions[_permission][_user] = _allowed;
    }
}
