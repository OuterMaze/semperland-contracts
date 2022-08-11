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
     * The linked brand registry for this metaverse.
     */
    function brandRegistry() external view returns (address);

    /**
     * The linked economy for this metaverse.
     */
    function economy() external view returns (address);

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
     * Mints a specific non-fungible token type, using a specific type (and always using
     * an amount of 1). It is an error if the chosen type is unknown or < 2, since those
     * types are reserved for being invalid or brands.
     */
    function mintNFTFor(address _to, uint256 _tokenType, bytes memory _data) external returns (uint256);

    /**
     * Mints a specific brand token for a given user. The brand is stated as its address.
     */
    function mintBrandFor(address _to, address _brandId) external;

    /**
     * Retrieves the metadata uri of a given token. WARNING: This method
     * will consume a lot of gas if invoked inside a transaction, so
     * it is recommended to invoke this method in the context of a
     * CALL, and never in the context of a SEND (even as part of other
     * contract's code).
     */
    function tokenURI(uint256 _tokenId) external view returns (string memory);

    /**
     * Hook to be invoked as part of a burn process when an address burns
     * a particular token in some quantity (for NFTs, the quantity is 1
     * in every case). By this point, we should be guaranteed that the
     * _tokenId will actually have a resolver (being it a fungible token
     * type, or being it a non-fungible token id). Also, the operator will
     * be specified (perhaps matching the owner).
     */
    function onTokenBurned(address _operator, address _from, uint256 _tokenId, uint256 _amount) external;

    /**
     * Hook to be invoked as part of a batch burn process when an address
     * burns a particulars et of tokens in respective quantities (for NFTs,
     * the quantity is 1 in every case; it is guaranteed that both arrays
     * are always of the same length. Also, the operator will be specified
     * (perhaps matching the owner).
     */
    function onTokensBurned(address _operator, address _from, uint256[] memory _tokenIds, uint256[] memory _amounts)
        external;

    /**
     * Hook to be invoked as part of a transfer from ERC1155.
     */
    function onBrandOwnerChanged(address _brandId, address _newOwner) external;
}
