// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "@openzeppelin/contracts/utils/Context.sol";
import "../../IMetaverse.sol";
import "../../brands/IBrandRegistry.sol";
import "./MetaversePlugin.sol";

/**
 * This trait defines utilities that define new FT types,
 * both for brands and th system scope. These ones are
 * internal.
 */
abstract contract FTDefiningPlugin is Context, MetaversePlugin {
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
        return IMetaverse(metaverse).defineNextFTType(_brandId);
    }
}
