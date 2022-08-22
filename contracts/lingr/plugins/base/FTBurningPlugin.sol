// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "../../IMetaverse.sol";
import "./IMetaversePlugin.sol";

/**
 * This trait defines utilities that burn FT tokens, both in the system scope
 * or a brand. These ones are internal (typically used after testing the types
 * to be valid FT types).
 */
abstract contract FTBurningPlugin is IMetaversePlugin {
    /**
     * The metaverse this plug-in belongs to. This abstract definition
     * extends it to be public (to use this one locally).
     */
    function metaverse() public virtual override returns (address);

    /**
     * Burns a FT in certain amount (only types defined by this contract should be available,
     * save for good reasons to do otherwise).
     */
    function _burnFT(uint256 _tokenId, uint256 _amount) internal {
        IMetaverse(metaverse()).burnFT(_tokenId, _amount);
    }

    /**
     * Burns many FTs in certain amounts (only types defined by this contract should be available,
     * save for good reasons to do otherwise).
     */
    function _burnFTs(uint256[] memory _tokenIds, uint256[] memory _amounts) internal {
        IMetaverse(metaverse()).burnFTs(_tokenIds, _amounts);
    }
}