// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "@openzeppelin/contracts/utils/Context.sol";
import "../../IMetaverse.sol";
import "../../brands/IBrandRegistry.sol";
import "./IMetaversePlugin.sol";

/**
 * This trait defines utilities that burn NFT tokens, both in the system scope
 * or a brand. These ones are internal (typically used after testing the types
 * to be valid NFT types).
 */
abstract contract NFTBurningPlugin is Context, IMetaversePlugin {
    /**
     * The metaverse this plug-in belongs to. This abstract definition
     * extends it to be public (to use this one locally).
     */
    function metaverse() public virtual override returns (address);

    /**
     * Burns a NFT (only types defined by this contract are available).
     */
    function _burnNFT(uint256 _tokenId) internal {
        IMetaverse(metaverse).burnNFT(_tokenId);
    }

    /**
     * Burns many NFT (only types defined by this contract are available).
     */
    function _burnNFTs(uint256[] memory _tokenIds) internal {
        IMetaverse(metaverse).burnNFTs(_tokenIds);
    }
}