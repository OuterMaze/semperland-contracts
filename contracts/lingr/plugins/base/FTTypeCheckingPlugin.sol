// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "@openzeppelin/contracts/utils/Context.sol";
import "../../IMetaverse.sol";
import "../../brands/IBrandRegistry.sol";
import "./MetaversePlugin.sol";

/**
 * This trait defines utilities that test when a FT belongs to
 * a particular scope (brand, or the system scope), and that a
 * particular permission is satisfied on that scope. Also, tests
 * that the specified token id is in the FT range.
 */
abstract contract FTTypeCheckingPlugin is Context, MetaversePlugin {
    /**
     * The address 0 stands for the system scope.
     */
    address constant SYSTEM_SCOPE = address(0);

    /**
     * This mask captures all the enabled bits of for the id / type
     * of a FT asset.
     */
    uint256 constant FT_MASK = (1 << 255) | ((1 << 224) - 1);

    /**
     * This mask captures the scope of a FT asset id / type.
     */
    uint256 constant BRAND_MASK = ((1 << 160) - 1);

    /**
     * This function requires a token id to be in the FT range, and extracts
     * the brand id related to that FT (if the brand id is 0, that one is the
     * system scope).
     */
    function _requireFTRange(uint256 _tokenId) internal returns (address) {
        require(
            _tokenId == (_tokenId & FT_MASK),
            "FTTypeCheckingPlugin: the given token id is not in the FT range"
        );
        return address((_tokenId >> 64) & BRAND_MASK);
    }

    /**
     * This function requires the scope to be the system.
     */
    function _requireSystemScope(address _scope) internal {
        require(
            _scope == SYSTEM_SCOPE,
            "FTTypeCheckingPlugin: this function is only available for the system"
        );
    }

    /**
     * This function requires a brand scope.
     */
    function _requireBrandScope(address _scope) internal {
        require(
            _scope != SYSTEM_SCOPE,
            "FTTypeCheckingPlugin: this function is only available for brands"
        );
    }

    /**
     * This function requires a specific permission or being the owner of the
     * appropriate scope to perform an action. If the scope is 0, then it will
     * test a metaverse-scoped permission. Otherwise, the scope will be a brand
     * and it will test a brand-scoped permission (on that brand).
     */
    function _requireScopeAllowed(address _scopeId, bytes32 _metaversePermission, bytes32 _brandPermission) internal {
        if (_scopeId == SYSTEM_SCOPE) {
            require(
                IMetaverse(metaverse).isAllowed(_metaversePermission, _msgSender()),
                "MetaversePlugin: caller is not metaverse owner, and does not have the required permission"
            );
        } else {
            require(
                IBrandRegistry(IMetaverse(metaverse).brandRegistry()).isBrandAllowed(
                    _scopeId, _brandPermission, _msgSender()
                ),
                "MetaversePlugin: caller is not brand owner nor approved, and does not have the required permission"
            );
        }
    }
}
