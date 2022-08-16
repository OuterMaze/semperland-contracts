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
     * The current price of the definition of a new currency
     * for a brand. 0 means the definition is disabled by this
     * public mean, until the administration sets a price.
     */
    uint256 public currencyDefinitionCost;

    /**
     * The current price of the mint of a currency for a brand.
     * The amount that is minted is defined separately. 0 means
     * the minting is disabled by this mean, until the administration
     * sets a price.
     */
    uint256 public currencyMintCost;

    /**
     * The current amount that is minted when a mint occurs for
     * a brand. 0 means the minting is disabled by this mean, until
     * the administration sets an amount.
     */
    uint256 public currencyMintAmount;

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
     * This permission allows users to define currencies for free
     * for a brand and/or mint currencies for free for a brand.
     */
    bytes32 constant METAVERSE_GIVE_BRAND_CURRENCIES = keccak256("CurrencyPlugin::Currencies::Give");

    /**
     * This permission allows users to mint BEAT for a given
     * brand (typically, one having committed=true).
     */
    bytes32 constant METAVERSE_MINT_BEAT = keccak256("CurrencyPlugin::BEAT::Mint");

    /**
     * This permission allows users to define currencies for a cost
     * for a brand and/or mint those defined currencies (also for
     * a cost) brand-wise. Additionally, this permissions lets the
     * user edit the metadata of an existing currency (that operation
     * is free).
     */
    bytes32 constant BRAND_MANAGE_CURRENCY = keccak256("CurrencyPlugin::Brand::Currencies::Manage");

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

    /**
     * This event is triggered when a currency is defined.
     */
    event CurrencyDefined(
        uint256 indexed tokenId, address indexed brandId, address indexed definedBy,
        string name, string description
    );

    /**
     * Defines a new currency type. This is done by actually setting the metadata
     * for a given token id (token type). Aside from it and the metadata, it are
     * also given: the brand this asset is defined for (0 will be used when this
     * method is called while defining system-wide currencies), the sender (which
     * will either be this contract, an allowed user for a given brand requesting
     * the definition of the currency, or a user who is metaverse-wide allowed to
     * define (for free) the currency for a brand. Finally, the price that was
     * paid while invoking this method. If the price is 0, this means an allowed
     * user (metaverse-wide) defined the currency as a gift for a brand, or it is
     * a system-wide currency (defined by them or this contract).
     *
     * By this point, it is presumed that the token id is already defined and has
     * no collision, so the entry can be added -and an event can be triggered- to
     * the currencies metadata.
     */
    function _defineCurrency(
        uint256 _tokenId, address _brandId, address _definedBy, uint256 _pricePaid,
        string memory _name, string memory _description, string memory _image,
        string memory _icon16x16, string memory _icon32x32, string memory _icon64x64,
        string memory _color
    ) private {
        currencies[_tokenId] = CurrencyMetadata({
            registered: true, name: _name, description: _description, color: _color,
            image: _image, icon16x16: _icon16x16, icon32x32: _icon32x32,
            icon64x64: _icon64x64
        });
        emit CurrencyDefined(_tokenId, _brandId, _definedBy, _name, _description);
    }

    // An internal method goes here.

    // TODO: {1} private method to define a currency type for a brand.
    // TODO: {2} a cost of currency definition, in MATIC.
    // TODO: {3} a cost of currency mint, in MATIC.
    // TODO: {4} an amount of currency mint, when the cost is paid (default: 1000 * 10^18).
    // TODO: {5} a permission to set the definition cost, mint cost & mint amount.
    // TODO: {6} an event for when the definition cost is set.
    // TODO: {7} a public method involving {6}, {5} and {2}.
    // TODO: {8} and event for when the mint cost is set.
    // TODO: {9} a public method involving {8}, {5} and {3}.
    // TODO: {10} an event for when the mint amount is set.
    // TODO: {11} a public method involving {10}, {5} and and {4}.
}
