// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import "./plugins/base/IMetaverseAssetsPlugin.sol";
import "./IMetaverseAssetsRegistrar.sol";
import "./brands/BrandRegistry.sol";

/**
 * A metaverse hub can receive "plugs" (extensions) in the form of
 * different contracts (implementing IMetaverseAssetsPlugin). This
 * plug mechanism allows extending the metaverse with new asset
 * types and new asset instances (each plug-in is managed by the
 * team, not publicly added by external users).
 *
 * Each of those contracts will make use of their own logic while
 * interacting with the metaverse, which involves having full access
 * to the whole metaverse assets (e.g. taking assets from the users
 * or granting assets to the users).
 */
abstract contract MetaverseAssetsRegistrar is Context, IMetaverseAssetsRegistrar, BrandRegistry {
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
     * This modifier requires the sender to be one of the authorized contracts.
     */
    modifier onlyPlugin() {
        require(plugins[_msgSender()], "MetaverseAssetsRegistrar: the sender must be a plug-in");
        _;
    }

    /**
     * This modifier requires the token type to not be already registered.
     */
    modifier onlyNewTokenType(uint256 _tokenType) {
        require(tokenTypeResolvers[_tokenType] == address(0), "MetaverseAssetsRegistrar: the specified token type is not available");
        _;
    }

    /**
     * This modifier requires the token type to be already registered.
     */
    modifier onlyExistingTokenType(uint256 _tokenType) {
        require(tokenTypeResolvers[_tokenType] != address(0), "MetaverseAssetsRegistrar: unknown / non-mintable token type id");
        _;
    }

    /**
     * This modifier requires the token type to be in the FT range.
     */
    modifier onlyFTRange(uint256 _tokenType) {
        require(_tokenType >= (1 << 255), "MetaverseAssetsRegistrar: the specified value is not in the fungible tokens range");
        _;
    }

    /**
     * This modifier requires the token type to be in the NFT range.
     */
    modifier onlyNFTRange(uint256 _tokenType) {
        require(_tokenType < (1 << 255), "MetaverseAssetsRegistrar: the specified value is not in the nft range");
        _;
    }

    /**
     * Defines the resolution of a fungible token type. The token id must be
     * in the range of the fungible token ids.
     */
    function defineFTType(uint256 _tokenId) public onlyPlugin onlyNewTokenType(_tokenId) onlyFTRange(_tokenId) {
        tokenTypeResolvers[_tokenId] = _msgSender();
    }

    /**
     * Defines the resolution of a non-fungible token type. The token id must
     * be in the range of the fungible token (type) ids (strictly > 0, strictly
     * < (1 << 255)).
     */
    function defineNFTType(uint256 _tokenId) public onlyPlugin onlyNewTokenType(_tokenId) onlyNFTRange(_tokenId) {
        require(_tokenId > 1, "MetaverseAssetsRegistrar: nft type 0 is reserved for invalid / missing nfts, and 1 for brands");
        tokenTypeResolvers[_tokenId] = _msgSender();
    }

    /**
     * This method must be implemented to define the actual mint process (typically,
     * this occurs in terms of an ERC1155's _mint process) of either a fungible or
     * a non-fungible asset.
     */
    function _mintFor(address _to, uint256 _tokenId, uint256 _amount, bytes memory _data) internal virtual;

    /**
     * Mints a specific fungible token type, in a certain amount.
     */
    function mintFTFor(address _to, uint256 _tokenId, uint256 _amount, bytes memory _data)
        public onlyPlugin onlyExistingTokenType(_tokenId) onlyFTRange(_tokenId)
    {
        _mintFor(_to, _tokenId, _amount, _data);
    }

    /**
     * Mints a specific non-fungible token type, using a specific id (and always using
     * an amount of 1). It is an error if the token id is already minted, or the chosen
     * id is < (1 << 160) since those ids are reserved for brands.
     */
    function mintNFTFor(address _to, uint256 _tokenId, uint256 _tokenType, bytes memory _data)
        public onlyPlugin onlyExistingTokenType(_tokenType) onlyNFTRange(_tokenType) onlyNFTRange(_tokenId)
    {
        require(_tokenType >= (1 << 160), "MetaverseAssetsRegistrar: the specified token id is reserved for brands");
        require(nftTypes[_tokenId] == 0, "MetaverseAssetsRegistrar: the specified nft id is not available");
        _mintFor(_to, _tokenId, 1, _data);
        nftTypes[_tokenId] = _tokenType;
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
        return IMetaverseAssetsPlugin(plugin).uri(_typeId);
    }

    /**
     * Retrieves the metadata uri of a given token. WARNING: This method
     * will consume a lot of gas if invoked inside a transaction, so
     * it is recommended to invoke this method in the context of a
     * CALL, and never in the context of a SEND (even as part of other
     * contract's code).
     */
    function tokenURI(uint256 _tokenId) public view returns (string memory) {
        if (_tokenId < (1 << 160)) {
            return brandMetadataURI(address(uint160(_tokenId)));
        } else if (_tokenId < (1 << 255)) {
            return _metadataFromPlugin(nftTypes[_tokenId]);
        } else {
            return _metadataFromPlugin(_tokenId);
        }
    }

    /**
     * Hook to be invoked as part of a burn process when an address burns
     * a particular token in some quantity (for NFTs, the quantity is 1
     * in every case). By this point, we should be guaranteed that the
     * _tokenId will actually have a resolver (being it a fungible token
     * type, or being it a non-fungible token id).
     */
    function _tokenBurned(address _from, uint256 _tokenId, uint256 _amount) internal {
        require(_tokenId >= (1 << 160), "MetaverseAssetsRegistrar: brands cannot be burned");
        address resolver = address(0);
        if (_tokenId < (1 << 255)) {
            resolver = tokenTypeResolvers[nftTypes[_tokenId]];
        } else {
            resolver = tokenTypeResolvers[_tokenId];
        }
        if (resolver != address(0)) {
            IMetaverseAssetsPlugin(resolver).burned(_from, _tokenId, _amount);
        }
    }

    /**
     * Hook to be invoked as part of a batch burn process when an address
     * burns a particulars et of tokens in respective quantities (for NFTs,
     * the quantity is 1 in every case; it is guaranteed that both arrays
     * are always of the same length.
     */
    function _tokensBurned(address _from, uint256[] memory _tokenIds, uint256[] memory _amounts) internal {
        uint256 length = _tokenIds.length;
        for(uint256 index = 0; index < length; index++) {
            _tokenBurned(_from, _tokenIds[index], _amounts[index]);
        }
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
        return _plugin.supportsInterface(type(IMetaverseAssetsPlugin).interfaceId) &&
            IMetaverseAssetsPlugin(_plugin).metaverse() == address(this);
    }

    /**
     * Adds a plug-in contract to this metaverse.
     */
    function addPlugin(address _contract) public {
        require(_canAddPlugin(_msgSender()), "MetaverseAssetsRegistrar: the sender is not allowed to add a plug-in");
        require(
            _isPluginForThisMetaverse(_contract),
            "MetaverseAssetsRegistrar: the address does not belong to a valid plug-in contract for this metaverse"
        );
        require(
            !plugins[_contract], "MetaverseAssetsRegistrar: the plug-in is already added to this metaverse"
        );
        plugins[_contract] = true;
        IMetaverseAssetsPlugin(_contract).initialize();
    }

    // TODO: Implement many features:
    // 1. A sample contract defining a COIN type and a dumb DEED type.
}
