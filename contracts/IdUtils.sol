// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

/**
 * This class defines methods to build the ID of a token,
 * be it fungible or not. Brands are NFTs on their own,
 * while other NFTs start with {01}b, and fungible tokens
 * start with {1}b. Also, fungible tokens emitted by the
 * system itself only use the latter 64 bits (the space
 * they would use for a "brand" is always 0).
 */
library IdUtils {
    // This mask is used to clear the first flag (to make an NFT id).
    uint256 constant NFT_FILTER = (1 << 255) - 1;

    // This mask is used to set the second flag (to make a non-brand NFT id).
    uint256 constant NFT_NONBRAND_SET = (1 << 254);

    // This mask is used to set the first flag (to make a brand FT).
    uint256 constant FT_SET = (1 << 255);

    /**
     * Constructs a NFT id. While all the ids for the fungible tokens
     * start with (binary) 0, the ids for NFTs start with (binary) 1.
     * While this halves the amount of available tokens for NFT, this
     * still leaves with a lot of available ids. This one is not meant
     * to make brands, but arbitrary ids.
     */
    function nftId(uint256 id) public pure returns (uint256) {
        return (NFT_FILTER & id) | NFT_NONBRAND_SET;
    }

    /**
     * Constructs a brand token id. It is the same as the generated address.
     */
    function brandId(address brand) public pure returns (uint256) {
        return uint256(uint160(brand));
    }

    /**
     * Constructs a brand token id. This consists of a brand address
     * which must be non-zero to effectively refer a brand, while 0
     * is reserved for the system) and an index (which might be 0
     * with no issue at all). All the tokens constructed with this
     * method are fungible tokens.
     */
    function brandTokenId(address brand, uint64 index) public pure returns (uint256) {
        return uint256(uint160(brand)) << 64 | uint256(index) | FT_SET;
    }

    /**
     * Constructs a system token id. This consist of the zero address
     * and an index. That means that values from FT_MASK | (0 to 2**64-1)
     * are only used as system tokens. This tokens ids are all meant to
     * be used for fungible tokens.
     */
    function systemTokenId(uint64 index) public pure returns (uint256) {
        return uint256(index) | FT_SET;
    }
}
