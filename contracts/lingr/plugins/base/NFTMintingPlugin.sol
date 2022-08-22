// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "../../IMetaverse.sol";
import "./IMetaversePlugin.sol";

/**
 * This trait defines utilities that mint NFT tokens. These ones are
 * internal (typically used after testing the types to be valid NFT\
 * types).
 */
abstract contract NFTMintingPlugin is IMetaversePlugin {
    /**
     * The metaverse this plug-in belongs to. This abstract definition
     * extends it to be public (to use this one locally).
     */
    function metaverse() public virtual override returns (address);

    /**
     * Mints a NFT for a user (only types defined by this contract should
     * be available, unless there are good reasons to do otherwise). Returns
     * the newly minted id.
     */
    function _mintNFTFor(address _to, uint256 _tokenType, bytes memory _data) internal returns (uint256) {
        return IMetaverse(metaverse()).mintNFTFor(_to, _tokenType, _data);
    }
}