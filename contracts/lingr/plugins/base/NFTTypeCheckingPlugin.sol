// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "@openzeppelin/contracts/utils/Context.sol";
import "../../IMetaverse.sol";
import "../../brands/IBrandRegistry.sol";
import "./MetaversePlugin.sol";

/**
 * This trait defines utilities that test that the specified token
 * id is in the FT range.
 */
abstract contract FTTypeCheckingPlugin is MetaversePlugin {
    /**
     * This mask is matched by all the NFT types and ids.
     */
    uint256 constant NFT_MASK = (1 << 255) - 1;

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
     * Requires a token id to be in certain NFT type.
     */
    modifier inNFTType(uint256 _id, uint256 _type) {
        require(
            IMetaverse(metaverse).nftTypes(_id) == _type,
            "MetaversePlugin: the given NFT is not of the appropriate type"
        );
        _;
    }
}
