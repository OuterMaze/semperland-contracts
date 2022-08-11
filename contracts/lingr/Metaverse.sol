// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "@openzeppelin/contracts/utils/Context.sol";
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
abstract contract Metaverse is Context, IMetaverse {
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
        external onlyPlugin onlyExistingTokenType(_tokenId) onlyFTRange(_tokenId)
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
     * Burns a token (except brands) and invokes a hook.
     */
    function _tokenBurned(address _operator, address _owner, uint256 _tokenId, uint256 _amount) internal {
        require(_tokenId >= (1 << 160), "Metaverse: brands cannot be burned");
        address resolver = address(0);
        if (_tokenId < (1 << 255)) {
            resolver = tokenTypeResolvers[nftTypes[_tokenId]];
        } else {
            resolver = tokenTypeResolvers[_tokenId];
        }
        if (resolver != address(0)) {
            IMetaversePlugin(resolver).onBurned(_operator, _owner, _tokenId, _amount);
        }
    }

    /**
     * Hook to be invoked as part of a burn process when an address burns
     * a particular token in some quantity (for NFTs, the quantity is 1
     * in every case). By this point, we should be guaranteed that the
     * _tokenId will actually have a resolver (being it a fungible token
     * type, or being it a non-fungible token id). Also, the operator will
     * be specified (perhaps matching the owner).
     */
    function onTokenBurned(address _operator, address _owner, uint256 _tokenId, uint256 _amount) external onlyEconomy {
        _tokenBurned(_operator, _owner, _tokenId, _amount);
    }

    /**
     * Hook to be invoked as part of a batch burn process when an address
     * burns a particulars et of tokens in respective quantities (for NFTs,
     * the quantity is 1 in every case; it is guaranteed that both arrays
     * are always of the same length. Also, the operator will be specified
     * (perhaps matching the owner).
     */
    function onTokensBurned(address _operator, address _owner, uint256[] memory _tokenIds, uint256[] memory _amounts)
        external onlyEconomy {
        uint256 length = _tokenIds.length;
        for(uint256 index = 0; index < length; index++) {
            _tokenBurned(_operator, _owner, _tokenIds[index], _amounts[index]);
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
     * This method must be implemented to define how is a sender allowed to
     * add a plug-in to this metaverse.
     */
    function _canAddPlugin(address _sender) internal view virtual returns (bool);

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
    function addPlugin(address _contract) public {
        require(_canAddPlugin(_msgSender()), "Metaverse: the sender is not allowed to add a plug-in");
        require(
            _isPluginForThisMetaverse(_contract),
            "Metaverse: the address does not belong to a valid plug-in contract for this metaverse"
        );
        require(
            !plugins[_contract], "Metaverse: the plug-in is already added to this metaverse"
        );
        plugins[_contract] = true;
        IMetaversePlugin(_contract).initialize();
    }

    /**
     * This method must be implemented to define how is a sender allowed to
     * add the brand registry to this metaverse.
     */
    function _canSetBrandRegistry(address _sender) internal view virtual returns (bool);

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
    function setBrandRegistry(address _contract) public {
        require(_canSetBrandRegistry(_msgSender()), "Metaverse: the sender is not allowed to set the plug-in");
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
     * This method must be implemented to define how is a sender allowed to
     * add the economy system to this metaverse.
     */
    function _canSetEconomy(address _sender) internal view virtual returns (bool);

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
    function setEconomy(address _contract) public {
        require(_canSetEconomy(_msgSender()), "Metaverse: the sender is not allowed to set the economy");
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
}
