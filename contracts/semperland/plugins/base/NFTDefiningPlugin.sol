// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "../../IMetaverse.sol";
import "./MetaversePlugin.sol";

/**
 * This trait defines utilities that define NFT types. These ones
 * are internal.
 */
abstract contract NFTDefiningPlugin is MetaversePlugin {
    /**
     * Defines a new NFT type. Returns its id.
     */
    function _defineNextNFTType() internal returns (uint256) {
        return IMetaverse(metaverse).defineNextNFTType();
    }
}