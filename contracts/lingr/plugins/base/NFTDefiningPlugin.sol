// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "../../IMetaverse.sol";
import "./IMetaversePlugin.sol";

/**
 * This trait defines utilities that define NFT types. These ones
 * are internal.
 */
abstract contract NFTDefiningPlugin is IMetaversePlugin {
    /**
     * The metaverse this plug-in belongs to. This abstract definition
     * extends it to be public (to use this one locally).
     */
    function metaverse() public virtual override returns (address);

    /**
     * Defines a new NFT type. Returns its id.
     */
    function _defineNextNFTType() internal returns (uint256) {
        return IMetaverse(metaverse()).defineNextNFTType();
    }
}