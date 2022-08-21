// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "@openzeppelin/contracts/utils/Context.sol";
import "../../IMetaverse.sol";
import "../../brands/IBrandRegistry.sol";
import "./IMetaversePlugin.sol";

/**
 * This trait defines utilities that define new FT types,
 * both for brands and th system scope.
 */
abstract contract FTDefiningPlugin is Context, IMetaversePlugin {
    /**
     * The metaverse this plug-in belongs to. This abstract definition
     * extends it to be public (to use this one locally).
     */
    function metaverse() public virtual override returns (address);

    /**
     * Defines a new FT type in the system scope (i.e. not a brand at all).
     * Returns its id.
     */
    function _defineNextSystemFTType() internal returns (uint256) {
        return _defineNextFTType(address(0));
    }

    /**
     * Defines a new FT type, tied to a brand (use address 0 for metaverse-wide
     * FT types). Returns its id.
     */
    function _defineNextFTType(address _brandId) internal returns (uint256) {
        return IMetaverse(metaverse()).defineNextFTType(_brandId);
    }
}
