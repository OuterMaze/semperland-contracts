// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "../../../NativePayable.sol";
import "../base/MetaversePlugin.sol";
import "../base/FTDefiningPlugin.sol";
import "../base/FTTypeCheckingPlugin.sol";
import "../base/FTMintingPlugin.sol";
import "../base/FTBurningPlugin.sol";

/**
 * This contract is the "definition" part of the Currency feature.
 * This means: it maintains the metadata of the defined currencies
 * (i.e. allows to define currencies - brands have to pay a fee,
 * but defining system currencies or brand currencies by an admin
 * or allowed user is free of charge).
 */
contract CurrencyDefinitionPlugin is NativePayable, FTDefiningPlugin, FTTypeCheckingPlugin,
    FTMintingPlugin, FTBurningPlugin {
    /**
     * The address that will receive earnings from currency
     * definition operations (executed by brand users which
     * are appropriately allowed by the brand owner).
     */
    address public brandCurrencyDefinitionEarningsReceiver;

    /**
     * The current price of the definition of a new currency
     * for a brand. 0 means the definition is disabled by this
     * public mean, until the administration sets a price.
     */
    uint256 public currencyDefinitionCost;

    /**
     * A reference to the minting plug-in.
     */
    address private mintingPlugin;

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

        /**
         * The currency supply. If 0, it will be an unbounded
         * currency (starts with no tokens, and can mint many
         * tokens as needed). Otherwise, the supply is minted
         * initially and cannot mint more of them. Also, when
         * using limited supply, the tokens cannot be burned.
         */
        uint256 supply;
    }

    /**
     * The registered currencies' metadata.
     */
    mapping(uint256 => CurrencyMetadata) currencies;

    /**
     * Permission: To add a plug-in (here: setup plug-in).
     */
    bytes32 constant ADD_PLUGIN = keccak256("Metaverse::AddPlugin");

    /**
     * This permission allows users to set the definition costs
     * for brands to define new currency types.
     */
    bytes32 constant METAVERSE_MANAGE_CURRENCIES_SETTINGS = keccak256("Plugins::Currency::Settings::Manage");

    /**
     * This permission allows users to define currencies for free
     * for a brand.
     */
    bytes32 constant METAVERSE_GIVE_BRAND_CURRENCIES = keccak256("Plugins::Currency::Currencies::Brands::Give");

    /**
     * This permission allows users to define currencies for a cost
     * for a brand. Additionally, this permissions lets the user edit
     * the metadata of an existing currency (that operation is free).
     */
    bytes32 constant BRAND_MANAGE_CURRENCIES = keccak256("Plugins::Currency::Brand::Currencies::Manage");

    /**
     * The id of the WMATIC type. Set on initialization.
     */
    uint256 public WMATICType;

    /**
     * The id of the BEAT type. Set on initialization.
     */
    uint256 public BEATType;

    /**
     * The main image for WMATIC.
     */
    string private wmaticImage;

    /**
     * The 16x16 icon for WMATIC.
     */
    string private wmaticIcon16x16;

    /**
     * The 32x32 icon for WMATIC.
     */
    string private wmaticIcon32x32;

    /**
     * The 64x64 icon for WMATIC.
     */
    string private wmaticIcon64x64;

    /**
     * The main image for BEAT.
     */
    string private beatImage;

    /**
     * The 16x16 icon for BEAT.
     */
    string private beatIcon16x16;

    /**
     * The 32x32 icon for BEAT.
     */
    string private beatIcon32x32;

    /**
     * The 64x64 icon for BEAT.
     */
    string private beatIcon64x64;

    /**
     * This plug-in takes the WMATIC & BEAT details on construction.
     */
    constructor(
        address _metaverse, address _earningsReceiver,
        string memory _wmaticImage, string memory _wmaticIcon16x16,
        string memory _wmaticIcon32x32, string memory _wmaticIcon64x64,
        string memory _beatImage, string memory _beatIcon16x16,
        string memory _beatIcon32x32, string memory _beatIcon64x64
    ) MetaversePlugin(_metaverse) {
        require(_earningsReceiver != address(0), "CurrencyDefinitionPlugin: the earnings receiver must not be 0");
        wmaticImage = _wmaticImage;
        wmaticIcon16x16 = _wmaticIcon16x16;
        wmaticIcon32x32 = _wmaticIcon32x32;
        wmaticIcon64x64 = _wmaticIcon64x64;
        beatImage = _beatImage;
        beatIcon16x16 = _beatIcon16x16;
        beatIcon32x32 = _beatIcon32x32;
        beatIcon64x64 = _beatIcon64x64;
        brandCurrencyDefinitionEarningsReceiver = _earningsReceiver;
    }

    /**
     * The title of the current plug-in is "Currency (Definition)".
     */
    function title() public view override returns (string memory) {
        return "Currency (Definition)";
    }

    /**
     * The definition plug-in is initialized with two currencies
     * which belong to the system: WMATIC and BEAT.
     */
    function _initialize() internal override {
        WMATICType = _defineSystemCurrency(address(this), CurrencyMetadata({
            registered: true, name: "WMATIC", description: "Wrapped MATIC in this world",
            color: "#ffd700", image: wmaticImage, icon16x16: wmaticIcon16x16,
            icon32x32: wmaticIcon32x32, icon64x64: wmaticIcon64x64, supply: 0
        }));
        BEATType = _defineSystemCurrency(address(this), CurrencyMetadata({
            registered: true, name: "BEAT", description: "BEAT coin",
            color: "#87cefa", image: beatImage, icon16x16: beatIcon16x16,
            icon32x32: beatIcon32x32, icon64x64: beatIcon64x64, supply: 0
        }));
    }

    /**
     * Tells whether a token id is registered as a currency type.
     */
    function currencyExists(uint256 _tokenId) external view returns (bool) {
        return currencies[_tokenId].registered;
    }

    /**
     * This function returns the JSON contents for the asset's URI.
     */
    function _tokenMetadata(uint256 _tokenId) internal view override returns (bytes memory) {
        CurrencyMetadata storage currency = currencies[_tokenId];
        if (!currency.registered) {
            return abi.encodePacked("");
        } else {
            string memory supply = currency.supply == 0 ? '"unbounded"' : Strings.toString(currency.supply);
            return abi.encodePacked(
                '{"name":"',currency.name,'","description":"', currency.description,
                '","image":"', currency.image, '","decimals":18,"properties":{"icon16x16":"',
                currency.icon16x16, '","icon32x32":"', currency.icon32x32, '","icon64x64":"',
                currency.icon64x64, '","color":"', currency.color, '","type":"currency"',
                ',"supply":', supply, '}}'
            );
        }
    }

    /**
     * An event for when the currency definition cost is updated.
     * Updating it to 0 disables it completely.
     */
    event CurrencyDefinitionCostUpdated(address indexed updatedBy, uint256 newCost);

    /**
     * Sets the currency definition cost.
     */
    function setCurrencyDefinitionCost(uint256 newCost) public
        onlyMetaverseAllowed(METAVERSE_MANAGE_CURRENCIES_SETTINGS)
    {
        currencyDefinitionCost = newCost;
        emit CurrencyDefinitionCostUpdated(_msgSender(), newCost);
    }

    /**
     * An event for when the brand currency definition earnings
     * receiver is changed.
     */
    event BrandCurrencyDefinitionEarningsReceiverUpdated(address indexed updatedBy, address newReceiver);

    /**
     * Set the new brand currency actions earnings receiver.
     */
    function setBrandCurrencyDefinitionEarningsReceiver(address _newReceiver) public
        onlyMetaverseAllowed(METAVERSE_MANAGE_CURRENCIES_SETTINGS)
    {
        require(
            _newReceiver != address(0),
            "CurrencyDefinitionPlugin: the brand currency definition earnings receiver must not be the 0 address"
        );
        brandCurrencyDefinitionEarningsReceiver = _newReceiver;
        emit BrandCurrencyDefinitionEarningsReceiverUpdated(_msgSender(), _newReceiver);
    }

    /**
     * This event is triggered when a currency is defined.
     */
    event CurrencyDefined(
        uint256 indexed tokenId, address indexed brandId, address indexed definedBy,
        uint256 paidPrice, string name, string description
    );

    /**
     * This modifier restricts the token id to belong to an already
     * defined currency type and returns the associated scope.
     */
    modifier definedCurrency(uint256 _tokenId, bytes32 _metaversePermission, bytes32 _brandPermission) {
        require(
            currencies[_tokenId].registered,
            "CurrencyDefinitionPlugin: the specified token id is not of a registered currency type"
        );
        address _scopeId = address(uint160((_tokenId >> 64)) & ((1 << 160) - 1));
        _requireScopeAllowed(_scopeId, _metaversePermission, _brandPermission);
        _;
    }

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
    function _setCurrencyMetadata(
        uint256 _tokenId, address _brandId, address _definedBy, uint256 _paidPrice,
        CurrencyMetadata memory metadata
    ) private {
        currencies[_tokenId] = metadata;
        emit CurrencyDefined(
            _tokenId, _brandId, _definedBy, _paidPrice, metadata.name,
            metadata.description
        );
    }

    /**
     * Defines a new system currency type. Aside from the metadata, the address
     * of the account or contract that defines the system currency type is passed
     * to this method.
     */
    function _defineSystemCurrency(address _definedBy, CurrencyMetadata memory metadata) private returns (uint256) {
        uint256 id = _defineNextSystemFTType();
        _setCurrencyMetadata(id, address(0), _definedBy, 0, metadata);
        return id;
    }

    /**
     * Defines a new brand currency type. Aside from the metadata, the address
     * of the account or contract that defines the brand currency type, and the
     * price paid for this type definition are provided. Also, the brand that
     * will be used to mint this currency for is provided.
     */
    function _defineBrandCurrency(
        address _brandId, uint256 _paidPrice, address _definedBy, CurrencyMetadata memory metadata
    ) private returns (uint256) {
        uint256 id = _defineNextFTType(_brandId);
        _setCurrencyMetadata(id, _brandId, _definedBy, _paidPrice, metadata);
        return id;
    }

    /**
     * Defines a new system currency. This is meant to be called from
     * other plug-ins.
     */
    function defineSystemCurrency(
        address _definedBy, string memory _name, string memory _description,
        string memory _image, string memory _icon16x16, string memory _icon32x32,
        string memory _icon64x64, string memory _color
    ) public onlyWhenInitialized onlyPlugin {
        CurrencyMetadata memory metadata = CurrencyMetadata({
            registered: true, name: _name, description: _description, color: _color,
            image: _image, icon16x16: _icon16x16, icon32x32: _icon32x32,
            icon64x64: _icon64x64, supply: 0
        });
        _defineSystemCurrency(_definedBy, metadata);
    }

    /**
     * Defines a new brand currency. This is meant to be called by users
     * that are authorized inside a brand, and has an associated cost.
     */
    function defineBrandCurrency(
        address _brandId, string memory _name, string memory _description,
        string memory _image, string memory _icon16x16, string memory _icon32x32,
        string memory _icon64x64, string memory _color
    ) public payable onlyWhenInitialized onlyBrandAllowed(_brandId, BRAND_MANAGE_CURRENCIES)
      hasNativeTokenPrice("CurrencyDefinitionPlugin: brand currency definition", currencyDefinitionCost, 1) {
        CurrencyMetadata memory metadata = CurrencyMetadata({
            registered: true, name: _name, description: _description, color: _color,
            image: _image, icon16x16: _icon16x16, icon32x32: _icon32x32,
            icon64x64: _icon64x64, supply: 0
        });
        _defineBrandCurrency(_brandId, msg.value, msg.sender, metadata);
        payable(brandCurrencyDefinitionEarningsReceiver).transfer(msg.value);
    }

    /**
     * Defines a new brand currency. This is meant to be called by users
     * that are authorized by the metaverse (defining brand currencies
     * for an arbitrary brand), and this operation has no cost.
     */
    function defineBrandCurrencyFor(
        address _brandId, string memory _name, string memory _description,
        string memory _image, string memory _icon16x16, string memory _icon32x32,
        string memory _icon64x64, string memory _color
    ) public onlyWhenInitialized onlyMetaverseAllowed(METAVERSE_GIVE_BRAND_CURRENCIES) {
        CurrencyMetadata memory metadata = CurrencyMetadata({
            registered: true, name: _name, description: _description, color: _color,
            image: _image, icon16x16: _icon16x16, icon32x32: _icon32x32,
            icon64x64: _icon64x64, supply: 0
        });
        _defineBrandCurrency(_brandId, 0, msg.sender, metadata);
    }

    /**
     * Notifies that the metadata of a currency is updated.
     */
    event CurrencyMetadataUpdated(address indexed updatedBy, uint256 indexed tokenId);

    /**
     * This modifier post-decorates the code to emit an event for the
     * currency metadata being updated.
     */
    modifier emitCurrencyUpdate(uint256 _tokenId) {
        _;
        emit CurrencyMetadataUpdated(_msgSender(), _tokenId);
    }

    /**
     * Updates the image in a system / brand currency.
     */
    function setCurrencyImage(uint256 _id, string memory _image)
        public onlyWhenInitialized definedCurrency(_id, METAVERSE_MANAGE_CURRENCIES_SETTINGS, BRAND_MANAGE_CURRENCIES)
        emitCurrencyUpdate(_id)
    {
        currencies[_id].image = _image;
    }

    /**
     * Updates the color in a system / brand currency.
     */
    function setCurrencyColor(uint256 _id, string memory _color)
        public onlyWhenInitialized definedCurrency(_id, METAVERSE_MANAGE_CURRENCIES_SETTINGS, BRAND_MANAGE_CURRENCIES)
        emitCurrencyUpdate(_id)
    {
        currencies[_id].color = _color;
    }

    /**
     * Updates the 16x16 icon in a system / brand currency.
     */
    function setCurrencyIcon16x16(uint256 _id, string memory _icon16x16)
        public onlyWhenInitialized definedCurrency(_id, METAVERSE_MANAGE_CURRENCIES_SETTINGS, BRAND_MANAGE_CURRENCIES)
        emitCurrencyUpdate(_id)
    {
        currencies[_id].icon16x16 = _icon16x16;
    }

    /**
     * Updates the 32x32 icon in a system / brand currency.
     */
    function setCurrencyIcon32x32(uint256 _id, string memory _icon32x32)
        public onlyWhenInitialized definedCurrency(_id, METAVERSE_MANAGE_CURRENCIES_SETTINGS, BRAND_MANAGE_CURRENCIES)
        emitCurrencyUpdate(_id)
    {
        currencies[_id].icon32x32 = _icon32x32;
    }

    /**
     * Updates the 64x64 icon in a brand currency.
     */
    function setCurrencyIcon64x64(uint256 _id, string memory _icon64x64)
        public onlyWhenInitialized definedCurrency(_id, METAVERSE_MANAGE_CURRENCIES_SETTINGS, BRAND_MANAGE_CURRENCIES)
        emitCurrencyUpdate(_id)
    {
        currencies[_id].icon64x64 = _icon64x64;
    }

    /**
     * Sets the minting plug-in.
     */
    function setMintingPlugin(address _plugIn) external onlyMetaverseAllowed(ADD_PLUGIN) {
        require(
            mintingPlugin == address(0),
            "CurrencyMintingPlugin: minting plug-in already set"
        );
        require(
            _plugIn != address(0),
            "CurrencyMintingPlugin: cannot set the minting plug-in to address 0"
        );
        require(
            IMetaverse(metaverse).plugins(_plugIn),
            "CurrencyMintingPlugin: the given minting plug-in is not added to the metaverse"
        );
        mintingPlugin = _plugIn;
    }

    /**
     * Mints a currency. Only the minting plug-in can invoke this method.
     */
    function mintCurrency(address _to, uint256 _id, uint256 _amount, bytes memory _data) external {
        require(
            mintingPlugin != address(0),
            "CurrencyDefinitionPlugin: the minting plugin is not set"
        );
        require(
            _msgSender() == mintingPlugin,
            "CurrencyDefinitionPlugin: only the minting plugin is allowed to mint currencies"
        );
        require(
            currencies[_id].supply == 0,
            "CurrencyDefinitionPlugin: the chosen currency has limited supply and cannot be minted"
        );
        _mintFTFor(_to, _id, _amount, _data);
    }
}
