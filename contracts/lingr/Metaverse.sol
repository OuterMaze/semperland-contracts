// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import "./plugins/base/IMetaversePlugin.sol";
import "./plugins/base/INFTTransferWatcherPlugin.sol";
import "./IMetaverse.sol";
import "./IMetaverseOwned.sol";
import "./economy/IEconomy.sol";
import "./brands/IBrandRegistry.sol";
import "./sponsoring/ISponsorRegistry.sol";
import "./signing/IMetaverseSignatureVerifier.sol";

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
     * The linked sponsoring registry for this metaverse.
     */
    address public sponsorRegistry;

    /**
     * The linked signature verifier for this metaverse.
     */
    address public signatureVerifier;

    /**
     * The already used hashes on signature check. Used to
     * avoid replay attacks.
     */
    mapping(bytes32 => bool) usedHashes;

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
    mapping(address => uint64) public nextFTIndex;

    /**
     * Holds the next NFT type to try, in the next iteration. The initial
     * value to try is 2 (0 means "invalid" and 1 means "brand").
     */
    uint256 public nextNFTTypeIndex = 2;

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
    bytes32 constant DEPLOY = keccak256("Metaverse::Deploy");

    /**
     * Maintains the permissions assigned to this metaverse.
     */
    mapping(bytes32 => mapping(address => bool)) permissions;

    /**
     * This modifier requires the token type to be already registered.
     */
    modifier onlyExistingTokenType(uint256 _tokenType) {
        require(tokenTypeResolvers[_tokenType] != address(0), "Metaverse: unknown / non-mintable token type id");
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
     * Requests the type id to be in the FT range.
     */
    function _mintFTFor(address _to, uint256 _tokenId, uint256 _amount, bytes memory _data)
        internal onlyFTRange(_tokenId)
    {
        require(
            tokenTypeResolvers[_tokenId] == _msgSender(),
            "Metaverse: this FT type cannot be minted by this plug-in"
        );
        IEconomy(economy).mintFor(_to, _tokenId, _amount, _data);
    }

    /**
     * Mints a specific fungible token type, in a certain amount.
     * This is only allowed for plug-ins.
     */
    function mintFTFor(address _to, uint256 _tokenId, uint256 _amount, bytes memory _data)
        external onlyPlugin
    {
        _mintFTFor(_to, _tokenId, _amount, _data);
    }

    /**
     * Mints many specific fungible token types, in certain amounts.
     * The array of types and amounts are both nonempty and same length.
     * This is only allowed for plug-ins.
     */
    function mintFTsFor(address _to, uint256[] memory _tokenIds, uint256[] memory _amounts, bytes memory _data)
        external onlyPlugin
    {
        require(
            _tokenIds.length == _amounts.length && _amounts.length != 0,
            "Metaverse: token ids and amounts array must be both non-empty and of same length"
        );
        for(uint256 index = 0; index < _tokenIds.length; index++)
        {
            _mintFTFor(_to, _tokenIds[index], _amounts[index], _data);
        }
    }

    /**
     * Mints a specific non-fungible token type, using a specific type (and always using
     * an amount of 1). It is an error if the chosen type is unknown or < 2, since those
     * types are reserved for being invalid or brands. Also, it is an error if the chosen
     * type is not for that plug-in.
     */
    function _mintNFTFor(address _to, uint256 _tokenType, bytes memory _data)
        internal onlyNFTRange(_tokenType) returns (uint256)
    {
        require(
            tokenTypeResolvers[_tokenType] == _msgSender(),
            "Metaverse: this NFT type cannot be minted by this plug-in"
        );
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
     * Mints a specific non-fungible token, using a specific type (and always using
     * an amount of 1) id. This is only allowed for plug-ins.
     */
    function mintNFTFor(address _to, uint256 _tokenType, bytes memory _data)
        external onlyPlugin returns (uint256)
    {
        return _mintNFTFor(_to, _tokenType, _data);
    }

    /**
     * Mints many specific non-fungible tokens, using specific types (and always using
     * an amount of 1) ids. This is only allowed for plug-ins.
     */
    function mintNFTsFor(address _to, uint256[] memory _tokenTypes, bytes memory _data)
        external onlyPlugin returns (uint256[] memory)
    {
        require(
            _tokenTypes.length != 0,
            "Metaverse: token type ids must be a non-empty array"
        );
        uint256[] memory result = new uint256[](_tokenTypes.length);
        for(uint256 index = 0; index < _tokenTypes.length; index++)
        {
            result[index] = _mintNFTFor(_to, _tokenTypes[index], _data);
        }
        return result;
    }

    /**
     * Mints a specific brand token for a given user. The brand is stated as its address.
     */
    function mintBrandFor(address _to, address _brandId) external onlyBrandRegistry {
        require(_msgSender() == brandRegistry, "Metaverse: the only allowed sender is the brand registry");
        IEconomy(economy).mintFor(_to, uint256(uint160(_brandId)), 1, "Metaverse: Minting a brand");
    }

    /**
     * Any token ID may be burned, except brands.
     */
    function _requireNonBrandTokenToBurn(uint256 _id) private {
        require(
            _id >= (1 << 160),
            "Metaverse: only non-brand tokens can be burned this way"
        );
    }

    /**
     * Burns a token (FT or NFT, except for brands) on a given amounts.
     * NFT will always use an amount of 1.
     */
    function burnToken(uint256 _id, uint256 _amount) external onlyPlugin {
        _requireNonBrandTokenToBurn(_id);
        IEconomy(economy).burn(_msgSender(), _id, _amount);
    }

    /**
     * Burns many tokens (FTs or NFTs, expect for brands) on given amounts.
     * NFTs will always be burned in an amount of 1.
     */
    function burnTokens(uint256[] memory _ids, uint256[] memory _amounts) external onlyPlugin {
        for (uint i = 0; i < _ids.length; i++) {
            _requireNonBrandTokenToBurn(_ids[i]);
        }
        IEconomy(economy).burnBatch(_msgSender(), _ids, _amounts);
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
     * Hook to be invoked as part of a transfer from ERC1155 when a brand NFT
     * is transferred.
     */
    function onBrandOwnerChanged(address _brandId, address _newOwner) external onlyEconomy {
        IBrandRegistry(brandRegistry).onBrandOwnerChanged(_brandId, _newOwner);
    }

    /**
     * Hook to be invoked as part of a transfer from ERC1155 when another type
     * of NFT is transferred.
     */
    function onNFTOwnerChanged(uint256 _nftId, address _newOwner) external onlyEconomy {
        address resolver = tokenTypeResolvers[nftTypes[_nftId]];
        if (resolver.supportsInterface(type(INFTTransferWatcherPlugin).interfaceId)) {
            INFTTransferWatcherPlugin(resolver).onNFTOwnerChanged(_nftId, _newOwner);
        }
    }


    // ********** Plugin management goes here **********

    /**
     * Tells whether an address is a valid component, for this metaverse
     * in particular, of a defined type.
     */
    function _isComponentForThisMetaverse(address _component, bytes4 _interfaceId) private view returns (bool) {
        return _component.supportsInterface(type(IMetaverseOwned).interfaceId) &&
               _component.supportsInterface(_interfaceId) &&
               IMetaverseOwned(_component).metaverse() == address(this);
    }

    /**
     * Adds a plug-in contract to this metaverse.
     */
    function addPlugin(address _contract) external onlyAllowed(DEPLOY) {
        require(
            _isComponentForThisMetaverse(_contract, type(IMetaversePlugin).interfaceId),
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
    function pluginsCount() external view returns (uint256) {
        return pluginsList.length;
    }

    /**
     * This modifier requires the sender to be one of the authorized contracts.
     */
    modifier onlyPlugin() {
        require(plugins[_msgSender()], "Metaverse: the sender must be a plug-in");
        _;
    }

    /**
     * Sets the brand registry contract to this metaverse.
     */
    function setBrandRegistry(address _contract) external onlyAllowed(DEPLOY) {
        require(
            _isComponentForThisMetaverse(_contract, type(IBrandRegistry).interfaceId),
            "Metaverse: the address does not belong to a valid brand registry contract for this metaverse"
        );
        require(
            brandRegistry == address(0), "Metaverse: a brand registry is already set into this metaverse"
        );
        brandRegistry = _contract;
    }

    /**
     * This modifier requires the sender to be the linked brand registry.
     */
    modifier onlyBrandRegistry() {
        require(_msgSender() == brandRegistry, "Metaverse: the only allowed sender is the brand registry");
        _;
    }

    /**
     * Sets the economy contract to this metaverse.
     */
    function setEconomy(address _contract) external onlyAllowed(DEPLOY) {
        require(
            _isComponentForThisMetaverse(_contract, type(IEconomy).interfaceId),
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
     * Sets the sponsor registry contract to this metaverse.
     */
    function setSponsorRegistry(address _contract) external onlyAllowed(DEPLOY) {
        require(
            _isComponentForThisMetaverse(_contract, type(ISponsorRegistry).interfaceId),
            "Metaverse: the address does not belong to a valid sponsor registry for this metaverse"
        );
        require(
            sponsorRegistry == address(0), "Metaverse: a sponsor registry is already set into this metaverse"
        );
        sponsorRegistry = _contract;
    }

    /**
     * Sets the signature verifier contract to this metaverse.
     */
    function setSignatureVerifier(address _contract) external onlyAllowed(DEPLOY) {
        require(
            _isComponentForThisMetaverse(_contract, type(IMetaverseSignatureVerifier).interfaceId),
            "Metaverse: the address does not belong to a valid signature verifier for this metaverse"
        );
        require(
            signatureVerifier == address(0), "Metaverse: a signature verifier is already set into this metaverse"
        );
        signatureVerifier = _contract;
    }

    /**
     * A metaverse satisfies the IMetaverse and IERC165 interfaces.
     */
    function supportsInterface(bytes4 interfaceId) external view virtual override returns (bool) {
        return interfaceId == type(IERC165).interfaceId || interfaceId == type(IMetaverse).interfaceId;
    }

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
        return _sender == owner() || permissions[SUPERUSER][_sender] || permissions[_permission][_sender];
    }

    /**
     * This event is triggered when a permission is set or revoked
     * for a given user in the whole metaverse.
     */
    event PermissionChanged(bytes32 indexed permission, address indexed user, bool set, address sender);

    /**
     * Grants a permission to a user. This action is reserved to owners,
     * approved operators, or allowed superusers. However, superuser cannot
     * set, in particular, the SUPERUSER permission itself.
     */
    function setPermission(bytes32 _permission, address _user, bool _allowed) external onlyAllowed(SUPERUSER) {
        address sender = _msgSender();
        require(_user != address(0), "Metaverse: cannot grant a permission to address 0");
        require(
            sender == owner() || _permission != SUPERUSER,
            "Metaverse: SUPERUSER permission cannot be added by this user"
        );
        permissions[_permission][_user] = _allowed;
        emit PermissionChanged(_permission, _user, _allowed, sender);
    }

    /**
     * Checks a signature. Returns the validated hash and sender address.
     * The delegation must be a pack of (sender, stamp, hash, signature),
     * and the stamp is checked against the timeout.
     */
    function checkSignature(bytes memory _delegation, uint256 _timeout) external returns (bytes32, address) {
        (address expectedSigner, uint256 stamp, bytes32 hash, bytes memory signature) = abi.decode(
            _delegation, (address, uint256, bytes32, bytes)
        );

        address signer = ISignatureVerifier(signatureVerifier).verifySignature(hash, signature);
        require(signer == expectedSigner, "Metaverse: signature verification failed");
        require(
            block.timestamp >= stamp - _timeout && block.timestamp <= stamp + _timeout,
            "Metaverse: signature out of time"
        );
        require(
            !usedHashes[hash], "Metaverse: delegation already used"
        );
        usedHashes[hash] = true;
        return (hash, signer);
    }
}
