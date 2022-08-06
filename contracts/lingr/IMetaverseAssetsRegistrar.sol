// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

/**
 * An interface for the metaverse core contract. This is meant
 * to be used from inside the metaverse plug-ins (typically on
 * plug-in initialization).
 */
interface IMetaverseAssetsRegistrar {
    /**
     * Defines the resolution of a fungible token type. The token id must be
     * in the range of the fungible token ids.
     */
    function defineFTType(uint256 _tokenId) external;

    /**
     * Defines the resolution of a non-fungible token type. The token id must
     * be in the range of the fungible token (type) ids (strictly > 0, strictly
     * < (1 << 255)).
     */
    function defineNFTType(uint256 _tokenId) external;

    /**
     * Mints a specific fungible token type, in a certain amount.
     */
    function mintFTFor(address _to, uint256 _tokenId, uint256 _amount, bytes memory _data) external;

    /**
     * Mints a specific non-fungible token type, using a specific id (and always using
     * an amount of 1). It is an error if the token id is already minted, or the chosen
     * id is < (1 << 160) since those ids are reserved for brands.
     */
    function mintNFTFor(address _to, uint256 _tokenId, uint256 _tokenType, bytes memory _data) external;
}
