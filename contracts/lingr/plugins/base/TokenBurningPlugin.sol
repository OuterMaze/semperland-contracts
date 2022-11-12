// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "../../IMetaverse.sol";
import "./MetaversePlugin.sol";

/**
 * This trait defines utilities that burn tokens, both in the system scope
 * or a brand. These ones are internal (typically used after testing the
 * types
 * to be valid FT types).
 */
abstract contract TokenBurningPlugin is MetaversePlugin {
    /**
     * Burns any token, save for a brand, in a given amount.
     */
    function _burnToken(uint256 _tokenId, uint256 _amount) internal {
        IMetaverse(metaverse).burnToken(_tokenId, _amount);
    }

    /**
     * Burns any set of tokens, save for brands, in given amounts.
     */
    function _burnTokens(uint256[] memory _tokenIds, uint256[] memory _amounts) internal {
        IMetaverse(metaverse).burnTokens(_tokenIds, _amounts);
    }
}