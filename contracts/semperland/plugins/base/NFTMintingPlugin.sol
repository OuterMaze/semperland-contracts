// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "../../IMetaverse.sol";
import "./MetaversePlugin.sol";

/**
 * This trait defines utilities that mint NFT tokens. These ones are
 * internal (typically used after testing the types to be valid NFT\
 * types).
 */
abstract contract NFTMintingPlugin is MetaversePlugin {
    /**
     * Mints a NFT for a user (only types defined by this contract should
     * be available, unless there are good reasons to do otherwise). Returns
     * the newly minted id.
     */
    function _mintNFTFor(address _to, uint256 _tokenType, bytes memory _data) internal returns (uint256) {
        return IMetaverse(metaverse).mintNFTFor(_to, _tokenType, _data);
    }
}