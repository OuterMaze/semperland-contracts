// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "../../IMetaverse.sol";
import "./MetaversePlugin.sol";

/**
 * This trait defines utilities that burn NFT tokens. These ones
 * are internal (typically used after testing the types to be valid
 * NFT types).
 */
abstract contract NFTBurningPlugin is MetaversePlugin {
    /**
     * Burns a NFT (only types defined by this contract should be available,
     * unless there are good reasons to do otherwise).
     */
    function _burnNFT(uint256 _tokenId) internal {
        IMetaverse(metaverse).burnNFT(_tokenId);
    }

    /**
     * Burns many NFT (only types defined by this contract are available,
     * unless there are good reasons to do otherwise).
     */
    function _burnNFTs(uint256[] memory _tokenIds) internal {
        IMetaverse(metaverse).burnNFTs(_tokenIds);
    }
}