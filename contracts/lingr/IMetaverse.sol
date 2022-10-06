// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/**
 * An interface for the metaverse core contract. This is meant
 * to be used from inside the metaverse plug-ins (typically on
 * plug-in initialization).
 */
interface IMetaverse is IERC165 {
    /**
     * This is the list of plug-ins that are being added to the hub.
     * Each contract has its separate logic but they have access to
     * the same set of features. Once a contract is added, it will
     * never be removed from this list. This mapping tells whether
     * a contract in particular has permission(s) to define a type
     * and mint tokens for an address.
     */
    function plugins(address _key) external view returns (bool);

    /**
     * This is the enumerable list of plug-ins added to this hub.
     */
    function pluginsList(uint256 index) external view returns (address);

    /**
     * This is the count of registered plug-ins.
     */
    function pluginsCount() external view returns (uint256);

    /**
     * The linked brand registry for this metaverse.
     */
    function brandRegistry() external view returns (address);

    /**
     * The linked economy for this metaverse.
     */
    function economy() external view returns (address);

    /**
     * Returns the type of an NFT id.
     */
    function nftTypes(uint256 _id) external view returns (uint256);

    /**
     * Defines the resolution of a fungible token type. The token id must be
     * in the range of the fungible token ids.
     */
    function defineNextFTType(address _brandId) external returns (uint256);

    /**
     * Defines the resolution of a non-fungible token type. The token id must
     * be in the range of the fungible token (type) ids (strictly > 0, strictly
     * < (1 << 255)).
     */
    function defineNextNFTType() external returns (uint256);

    /**
     * Mints a specific fungible token type, in a certain amount.
     */
    function mintFTFor(address _to, uint256 _tokenId, uint256 _amount, bytes memory _data) external;

    /**
     * Mints many specific fungible token types, in certain amounts.
     * The array of types and amounts are both nonempty and same length.
     */
    function mintFTsFor(address _to, uint256[] memory _tokenIds, uint256[] memory _amounts, bytes memory _data)
        external;

    /**
     * Mints a specific non-fungible token type, using a specific type (and always using
     * an amount of 1). It is an error if the chosen type is unknown or < 2, since those
     * types are reserved for being invalid or brands.
     */
    function mintNFTFor(address _to, uint256 _tokenType, bytes memory _data) external returns (uint256);

    /**
     * Mints many specific non-fungible token types, using specific types (and always using
     * an amount of 1). It is an error if the chosen types are unknown or < 2, since those
     * types are reserved for being invalid or brands. The token types array must not be
     * empty.
     */
    function mintNFTsFor(address _to, uint256[] memory _tokenType, bytes memory _data)
        external returns (uint256[] memory);

    /**
     * Mints a specific brand token for a given user. The brand is stated as its address.
     */
    function mintBrandFor(address _to, address _brandId) external;

    /**
     * Burns any FT the sender has, provided the sender is a plugin and also defines
     * the type of the token being burned.
     */
    function burnFT(uint256 _tokenId, uint256 _amount) external;

    /**
     * Burns many FT the sender has, provided the sender is a plugin and also defines
     * the type of the token being burned.
     */
    function burnFTs(uint256[] memory _tokenIds, uint256[] memory _amounts) external;

    /**
     * Burns any NFT the sender has, provided the sender is a plugin and also defines
     * the type of the tokens being burned.
     */
    function burnNFT(uint256 _tokenId) external;

    /**
     * Burns many NFT the sender has, provided the sender is a plugin and also defines
     * the type of the tokens being burned.
     */
    function burnNFTs(uint256[] memory _tokenIds) external;

    /**
     * Retrieves the metadata uri of a given token. WARNING: This method
     * will consume a lot of gas if invoked inside a transaction, so
     * it is recommended to invoke this method in the context of a
     * CALL, and never in the context of a SEND (even as part of other
     * contract's code).
     */
    function tokenURI(uint256 _tokenId) external view returns (string memory);

    /**
     * Hook to be invoked as part of a transfer from ERC1155 when a brand NFT
     * is transferred.
     */
    function onBrandOwnerChanged(address _brandId, address _newOwner) external;

    /**
     * Hook to be invoked as part of a transfer from ERC1155 when another type
     * of NFT is transferred.
     */
    function onNFTOwnerChanged(uint256 _nftId, address _newOwner) external;

    /**
     * Tells whether a user has a specific permission on the metaverse, or
     * is its owner.
     */
    function isAllowed(bytes32 _permission, address _sender) external view returns (bool);
}
