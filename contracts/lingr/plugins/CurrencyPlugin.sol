// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "./base/MetaversePlugin.sol";
import "../../NativePayable.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

/**
 * The currency plug-in defines two currencies (WMATIC, which
 * is a wrapper around MATIC so it becomes an ERC-1155 token;
 * and also BEAT, which is a token meant for social purpose
 * and only arises from donations) and allows brands to define
 * their own currencies and mint them.
 *
 * Currencies will hold their metadata in their own structure.
 */
contract CurrencyPlugin is MetaversePlugin, NativePayable, IERC1155Receiver {
    /**
     * The address that will receive earnings from currency
     * definition & mint operations (executed by brand users
     * which are appropriately allowed by the brand owner).
     */
    address public earningsReceiver;

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
     * This permission allows users to define the costs and the
     * mint amount defined in this contract (e.g. to define and
     * mint currencies being a brand, paying the fees).
     */
    bytes32 constant METAVERSE_MANAGE_CURRENCIES_SETTINGS = keccak256("CurrencyPlugin::Settings::Manage");

    /**
     * This permission allows users to define currencies for free
     * for a brand and/or mint currencies for free for a brand.
     */
    bytes32 constant METAVERSE_GIVE_BRAND_CURRENCIES = keccak256("CurrencyPlugin::Currencies::Brands::Give");

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
    bytes32 constant BRAND_MANAGE_CURRENCIES = keccak256("CurrencyPlugin::Brand::Currencies::Manage");

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
     * This plug-in does not require extra details on construction.
     */
    constructor(
        address _metaverse, address _earningsReceiver,
        string memory _wmaticImage, string memory _wmaticIcon16x16,
        string memory _wmaticIcon32x32, string memory _wmaticIcon64x64,
        string memory _beatImage, string memory _beatIcon16x16,
        string memory _beatIcon32x32, string memory _beatIcon64x64
    ) MetaversePlugin(_metaverse) {
        require(_earningsReceiver != address(0), "CurrencyPlugin: the earnings receiver must not be 0");
        wmaticImage = _wmaticImage;
        wmaticIcon16x16 = _wmaticIcon16x16;
        wmaticIcon32x32 = _wmaticIcon32x32;
        wmaticIcon64x64 = _wmaticIcon64x64;
        beatImage = _beatImage;
        beatIcon16x16 = _beatIcon16x16;
        beatIcon32x32 = _beatIcon32x32;
        beatIcon64x64 = _beatIcon64x64;
        earningsReceiver = _earningsReceiver;
    }

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
        WMATICType = _defineSystemCurrency(address(this), CurrencyMetadata({
            registered: true, name: "WMATIC", description: "Wrapped MATIC in this world",
            color: "#ffd700", image: wmaticImage, icon16x16: wmaticIcon16x16,
            icon32x32: wmaticIcon32x32, icon64x64: wmaticIcon64x64
        }));
        BEATType = _defineSystemCurrency(address(this), CurrencyMetadata({
            registered: true, name: "BEAT", description: "BEAT coin",
            color: "#87cefa", image: beatImage, icon16x16: beatIcon16x16,
            icon32x32: beatIcon32x32, icon64x64: beatIcon64x64
        }));
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
     * An event for when the currency definition cost is updated.
     * Updating it to 0 disables it completely.
     */
    event CurrencyDefinitionCostUpdated(uint256 newCost);

    /**
     * Sets the currency definition cost.
     */
    function setCurrencyDefinitionCost(uint256 newCost) public
        onlyMetaverseAllowed(METAVERSE_MANAGE_CURRENCIES_SETTINGS)
    {
        currencyDefinitionCost = newCost;
    }

    /**
     * An event for when the currency mint cost is updated.
     * Updating it to 0 disables it completely.
     */
    event CurrencyMintCostUpdated(uint256 newCost);

    /**
     * Sets the currency mint cost.
     */
    function setCurrencyMintCost(uint256 newCost) public
        onlyMetaverseAllowed(METAVERSE_MANAGE_CURRENCIES_SETTINGS)
    {
        currencyMintCost = newCost;
    }

    /**
     * An event for when the currency mint amount is updated.
     * Typically, this value will be something like 1000 eth
     * (1000 * 10^18). Updating it to 0 disables it completely.
     */
    event CurrencyMintAmountUpdated(uint256 newCost);

    /**
     * Sets the currency mint amount.
     */
    function setCurrencyMintAmount(uint256 newAmount) public
        onlyMetaverseAllowed(METAVERSE_MANAGE_CURRENCIES_SETTINGS)
    {
        currencyMintAmount = newAmount;
    }

    /**
     * An event for when the brand currency actions earnings
     * receiver is changed.
     */
    event BrandCurrencyActionsEarningsReceiverUpdated(address newReceiver);

    /**
     * Set the new brand currency actions earnings receiver.
     */
    function setBrandCurrencyActionsEarningsReceiver(address _newReceiver) public
        onlyMetaverseAllowed(METAVERSE_MANAGE_CURRENCIES_SETTINGS)
    {
        require(
            _newReceiver != address(0),
            "CurrencyPlugin: the brand currency actions earnings receiver must not be the 0 address"
        );
        earningsReceiver = _newReceiver;
        emit BrandCurrencyActionsEarningsReceiverUpdated(_newReceiver);
    }

    /**
     * This event is triggered when a currency is defined.
     */
    event CurrencyDefined(
        uint256 indexed tokenId, address indexed brandId, address indexed definedBy,
        uint256 paidPrice, string name, string description
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
    ) public onlyPlugin {
        CurrencyMetadata memory metadata = CurrencyMetadata({
            registered: true, name: _name, description: _description, color: _color,
            image: _image, icon16x16: _icon16x16, icon32x32: _icon32x32,
            icon64x64: _icon64x64
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
    ) public payable onlyBrandAllowed(_brandId, BRAND_MANAGE_CURRENCIES)
      hasNativeTokenPrice("CurrencyPlugin: brand currency definition", currencyDefinitionCost, 1) {
        CurrencyMetadata memory metadata = CurrencyMetadata({
            registered: true, name: _name, description: _description, color: _color,
            image: _image, icon16x16: _icon16x16, icon32x32: _icon32x32,
            icon64x64: _icon64x64
        });
        _defineBrandCurrency(_brandId, msg.value, msg.sender, metadata);
        payable(earningsReceiver).transfer(msg.value);
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
    ) public onlyMetaverseAllowed(METAVERSE_GIVE_BRAND_CURRENCIES) {
        CurrencyMetadata memory metadata = CurrencyMetadata({
            registered: true, name: _name, description: _description, color: _color,
            image: _image, icon16x16: _icon16x16, icon32x32: _icon32x32,
            icon64x64: _icon64x64
        });
        _defineBrandCurrency(_brandId, 0, msg.sender, metadata);
    }

    /**
     * This modifier requires the mint amount to be nonzero.
     */
    modifier nonzeroMintAmount() {
        require(currencyMintAmount != 0, "CurrencyPlugin: minting is disabled while the mint to amount per bulk is 0");
        _;
    }

    /**
     * This is a mean granted only to plug-in contracts to mint any
     * system currency. Due to the sensitivity of this feature, only
     * plug-ins in the same metaverse are allowed to use this method.
     */
    function mintSystemCurrency(
        address _to, uint256 _id, uint256 bulks
    ) public onlyPlugin inSystemFTRange(_id) nonzeroMintAmount {
        require(bulks != 0, "CurrencyPlugin: minting (system scope) issued with no units");
        _mintFTFor(_to, _id, bulks * currencyMintAmount, "system currency mint");
    }

    function mintBrandCurrency(
        address _to, address _brandId, uint256 _id, uint256 bulks
    ) public payable inBrandFTRange(_brandId, _id) onlyBrandAllowed(_brandId, BRAND_MANAGE_CURRENCIES)
      nonzeroMintAmount
      hasNativeTokenPrice("CurrencyPlugin: minting (for authorized brand)", currencyMintCost, bulks) {
        payable(earningsReceiver).transfer(msg.value);
        _mintFTFor(_to, _id, bulks * currencyMintAmount, "paid brand mint");
    }

    function mintBrandCurrencyFor(
        address _to, uint256 _id, uint256 bulks
    ) public inBrandFTRange(address(0), _id) onlyMetaverseAllowed(METAVERSE_GIVE_BRAND_CURRENCIES) nonzeroMintAmount {
        require(bulks != 0, "CurrencyPlugin: minting (system scope) issued with no units");
        _mintFTFor(_to, _id, bulks * currencyMintAmount, "gifted brand mint");
    }

    /**
     * Mints BEAT for a given address. This address may be a brand,
     * a user, or a contract.
     */
    function mintBEAT(address _to, uint256 bulks) public onlyMetaverseAllowed(METAVERSE_MINT_BEAT) {
        require(bulks != 0, "CurrencyPlugin: BEAT minting issued with no units");
        _mintFTFor(_to, BEATType, bulks * currencyMintAmount, "BEAT mint");
    }

    // TODO: Methods to maintain data of a currency: image, color, icons (16x16, 32x32, 64x64).
    // setBrandCurrencyImage (triggers event CurrencyUpdated(_msgSender(), id))
    // setBrandCurrencyColor (triggers event CurrencyUpdated(_msgSender(), id))
    // setBrandCurrencyIcon16x16 (triggers event CurrencyUpdated(_msgSender(), id))
    // setBrandCurrencyIcon32x32 (triggers event CurrencyUpdated(_msgSender(), id))
    // setBrandCurrencyIcon64x64 (triggers event CurrencyUpdated(_msgSender(), id))
    // setSystemCurrencyImage (triggers event CurrencyUpdated(_msgSender(), id))
    // setSystemCurrencyColor (triggers event CurrencyUpdated(_msgSender(), id))
    // setSystemCurrencyIcon16x16 (triggers event CurrencyUpdated(_msgSender(), id))
    // setSystemCurrencyIcon32x32 (triggers event CurrencyUpdated(_msgSender(), id))
    // setSystemCurrencyIcon64x64 (triggers event CurrencyUpdated(_msgSender(), id))
    // The requested permissions are:
    // - System currencies changes: in-metaverse METAVERSE_MANAGE_CURRENCIES_SETTINGS.
    // - Brand currencies changes: in-brand BRAND_MANAGE_CURRENCIES.

    /**
     * Receives WMATIC and BEAT. BEAT is burned and WMATIC is unwrapped.
     * Other tokens are all rejected.
     */
    function _receiveToken(address operator, address from, uint256 id, uint256 value) private {
        if (id == WMATICType) {
            require(
                operator == from,
                "CurrencyPlugin: for safety, only the owner is able to unwrap these tokens"
            );
            _burnFT(WMATICType, value);
            payable(from).transfer(value);
        } else if (id == BEATType) {
            _burnFT(BEATType, value);
        } else {
            // Only plug-ins can burn currencies (and only currencies)
            // by safe-transferring them to this contract.
            if (IMetaverse(metaverse).plugins(_msgSender()) && currencies[id].registered) {
                _burnFT(id, value);
            } else {
                revert("CurrencyPlugin: cannot receive, from users, other tokens than WMATIC and BEAT");
            }
        }
    }

    /**
     * Callback to manage the reception of ERC-1155 tokens from the Economy.
     * This callback can only be invoked from the economy system.
     */
    function onERC1155Received(
        address operator, address from, uint256 id, uint256 value, bytes calldata
    ) external onlyEconomy returns (bytes4) {
        _receiveToken(operator, from, id, value);
        return 0xf23a6e61;
    }

    /**
     * Callback to manage the reception of ERC-1155 tokens from the Economy.
     * This callback can only be invoked from the economy system.
     */
    function onERC1155BatchReceived(
        address operator, address from, uint256[] calldata ids, uint256[] calldata values,
        bytes calldata
    ) external onlyEconomy returns (bytes4) {
        uint256 length = ids.length;
        for(uint256 index = 0; index < length; index++) {
            _receiveToken(operator, from, ids[index], values[index]);
        }
        return 0xbc197c81;
    }

    /**
     * Receiving MATIC involves automatically wrapping it into WMATIC tokens
     * for the exact address sender.
     */
    receive() external payable {
        require(
            initialized,
            "CurrencyPlugin: cannot receive MATIC because the plug-in is not yet initialized"
        );
        _mintFTFor(_msgSender(), WMATICType, msg.value, "Currency wrapping");
    }
}
