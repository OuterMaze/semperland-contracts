// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "./base/MetaversePlugin.sol";

/**
 * The currency plug-in defines two currencies (WMATIC, which
 * is a wrapper around MATIC so it becomes an ERC-1155 token;
 * and also BEAT, which is a token meant for social purpose
 * and only arises from donations) and allows brands to define
 * their own currencies and mint them.
 *
 * Currencies will hold their metadata in their own structure.
 */
contract CurrencyPlugin is MetaversePlugin {
    /**
     * The metadata of a currency involves a name and
     * description, some images, and 18 decimals.
     */
    struct CurrencyMetadata {
        /**
         * Flag to distinguish a registered currency.
         */
        bool registered;

        /**
         * The name of the currency. It matches the "name"
         * field of the metadata. This field is immutable.
         */
        string name;

        /**
         * The description of the currency. It matches the
         * "description" field of the metadata. This field
         * is mutable (while the description is immutable
         * in the brands themselves, is mutable here).
         */
        string description;

        /**
         * The URL of the currency image. It matches
         * the "image" field of the metadata. This
         * field is mutable.
         */
        string image;

        /**
         * The icon of the currency (16x16). It matches
         * the "properties.icon16x16" field of the metadata.
         * This field is optional and mutable.
         */
        string icon16x16;

        /**
         * The icon of the currency (32x32). It matches
         * the "properties.icon32x32" field of the metadata.
         * This field is optional and mutable.
         */
        string icon32x32;

        /**
         * The icon of the currency (64x64). It matches
         * the "properties.icon64x64" field of the metadata.
         * This field is optional and mutable.
         */
        string icon64x64;

        /**
         * The default color to use for the coin when the
         * images are not appropriately loaded.
         */
        string color;
    }

    /**
     * The registered currencies' metadata.
     */
    mapping(uint256 => CurrencyMetadata) currencies;

    /**
     * The id of the WMATIC type. Set on initialization.
     */
    uint256 public WMATICType;

    /**
     * The id of the BEAT type. Set on initialization.
     */
    uint256 public BEATType;

    /**
     * This plug-in does not require extra details on construction.
     */
    constructor(address _metaverse) MetaversePlugin(_metaverse) {}

    /**
     * The title of the current plug-in is "Currency".
     */
    function title() public view override returns (string memory) {
        return "Currency";
    }

    /**
     * This function holds an implementation (which could be
     * empty) for when the plugin is added to the metaverse.
     */
    function _initialize() internal override {
        WMATICType = _defineNextSystemFTType();
        BEATType = _defineNextSystemFTType();
    }

    /**
     * This function returns the uri for a given token id, with
     * the same semantics of ERC1155.
     */
    function _tokenMetadata(uint256 _tokenId) internal view override returns (bytes memory) {
        CurrencyMetadata storage currency = currencies[_tokenId];
        if (!currency.registered) {
            return abi.encodePacked("");
        } else {
            return abi.encodePacked(
                '{"name":"',currency.name,'","description":"', currency.description,
                '","image":"', currency.image, '","decimals":18,"properties":{"icon16x16":"',
                currency.icon16x16, '","icon32x32":"', currency.icon32x32, '","icon64x64":"',
                currency.icon64x64, '","color":"', currency.color, '"}}'
            );
        }
    }
}
