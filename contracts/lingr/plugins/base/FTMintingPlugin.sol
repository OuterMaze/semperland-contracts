// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "../../IMetaverse.sol";
import "./IMetaversePlugin.sol";

/**
 * This trait defines utilities that mint FT tokens, both in the system scope
 * or a brand. These ones are internal (typically used after testing the types
 * to be valid FT types).
 */
abstract contract FTMintingPlugin is IMetaversePlugin {
    /**
     * The metaverse this plug-in belongs to. This abstract definition
     * extends it to be public (to use this one locally).
     */
    function metaverse() public virtual override returns (address);

    /**
     * Mints a FT for a particular user. This is typically done after
     * checking the specified type id is a valid FT type.
     */
    function _mintFTFor(address _to, uint256 _tokenId, uint256 _amount, bytes memory _data)
        internal
    {
        IMetaverse(metaverse).mintFTFor(_to, _tokenId, _amount, _data);
    }

    /**
     * Mints many FTs for a particular user. This is typically done after
     * checking the specified type ids are valid FT types.
     */
    function _mintFTsFor(address _to, uint256[] memory _tokenIds, uint256[] memory _amounts, bytes memory _data)
        internal
    {
        IMetaverse(metaverse).mintFTsFor(_to, _tokenIds, _amounts, _data);
    }
}