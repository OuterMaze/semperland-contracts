// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "@openzeppelin/contracts/utils/Context.sol";

/**
 * A Brand registry will keep track of the brands being registered.
 * Those brands will hold the metadata, and this trait will hold
 * the mean to register such brand with its metadata.
 */
abstract contract BrandRegistry is Context {
    /**
     * The cost to register a new brand. This can be changed in
     * the future and must be able to be known in the ABI for the
     * users to be aware of the statistic.
     */
    uint256 public brandRegistrationCost;

    /**
     * This is the whole brand metadata. It only has aesthetics,
     * name and descriptions.
     */
    struct BrandMetadata {
        /**
         * The name of the brand. It matches the "name" field
         * of the metadata. This field is immutable.
         */
        string name;

        /**
         * The description of the brand. It matches the
         * "description" field of the metadata. This field
         * is immutable.
         */
        string description;

        /**
         * The challenge URL of the brand. It matches the
         * "properties.challengeUrl" field. This field is
         * optional and mutable.
         */
        string challengeUrl;

        /**
         * The URL of the brand. It matches the "image" field
         * of the metadata. This field is mutable.
         */
        string image;

        /**
         * The icon of the brand (16x16). It matches the
         * "properties.icon16x16" field of the metadata.
         * This field is optional and mutable.
         */
        string icon16;

        /**
         * The icon of the brand (32x32). It matches the
         * "properties.icon32x32" field of the metadata.
         * This field is optional and mutable.
         */
        string icon32;

        /**
         * The icon of the brand (64x64). It matches the
         * "properties.icon64x64" field of the metadata.
         * This field is optional and mutable.
         */
        string icon64;
    }

    /**
     * Tells whether the specified user can set the registration
     * cost, or not.
     */
    function _canSetBrandRegistrationCost(address _sender) internal virtual view returns (bool);

    /**
     * An event for when the brand registration cost is updated.
     */
    event BrandRegistrationCostUpdated(uint256 newCost);

    /**
     * Sets the new brand registration cost.
     */
    function setBrandRegistrationCost(uint256 newCost) public {
        require(
            _canSetBrandRegistrationCost(_msgSender()),
            "BrandRegistry: not allowed to set the brand registration cost"
        );
        require(
            newCost >= (1 ether) / 100,
            "BrandRegistry: the brand registry cost must not be less than 0.01 native tokens"
        );
        brandRegistrationCost = newCost;
    }
}
