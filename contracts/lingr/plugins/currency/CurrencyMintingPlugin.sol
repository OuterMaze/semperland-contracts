// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "../../../NativePayable.sol";
import "../base/MetaversePlugin.sol";
import "../base/FTTypeCheckingPlugin.sol";
import "../base/FTMintingPlugin.sol";
import "../base/TokenBurningPlugin.sol";
import "./CurrencyDefinitionPlugin.sol";
import "../../DelegableContext.sol";

/**
 * This contract is the "minting" part of the Currency feature.
 * This means: it depends on the "definition" part and allows
 * mint operations for plug-ins, brands or metaverse managers.
 */
contract CurrencyMintingPlugin is NativePayable, IERC1155Receiver, FTTypeCheckingPlugin,
    FTMintingPlugin, TokenBurningPlugin, DelegableContext {
    /**
     * The address of the related currency definition plug-in.
     */
    address public definitionPlugin;

    /**
     * The address that will receive earnings from currency
     * mint operations (executed by brand users which are
     * appropriately allowed by the brand owner).
     */
    address public brandCurrencyMintingEarningsReceiver;

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

    // Reentrancy lock.
    bool private wmaticUnwrappingLocked = false;

    /**
     * This permission allows users to mint currencies for a cost for
     * a brand.
     */
    bytes32 constant BRAND_MANAGE_CURRENCIES = keccak256("Plugins::Currency::Brand::Currencies::Manage");

    /**
     * This permission allows users to define the costs and the
     * mint amount defined in this contract (e.g. to define and
     * mint currencies being a brand, paying the fees).
     */
    bytes32 constant METAVERSE_MANAGE_CURRENCIES_SETTINGS = keccak256("Plugins::Currency::Settings::Manage");

    /**
     * This permission allows users to mint currencies for free for a brand.
     */
    bytes32 constant METAVERSE_GIVE_BRAND_CURRENCIES = keccak256("Plugins::Currency::Currencies::Brands::Give");

    /**
     * This permission allows users to mint BEAT for a given
     * brand (typically, one having committed=true).
     */
    bytes32 constant METAVERSE_MINT_BEAT = keccak256("Plugins::Currency::BEAT::Mint");

    /**
     * This plug-in does not require extra details on construction.
     */
    constructor(address _metaverse, address _definitionPlugin, address _earningsReceiver, uint256 _timeout)
        MetaversePlugin(_metaverse) {
        require(_earningsReceiver != address(0), "CurrencyMintingPlugin: the earnings receiver must not be 0");
        brandCurrencyMintingEarningsReceiver = _earningsReceiver;
        definitionPlugin = _definitionPlugin;
        timeout = _timeout == 0 ? 300 : _timeout;
    }

    /**
     * The title of the current plug-in is "Currency (Minting)".
     */
    function title() public view override returns (string memory) {
        return "Currency (Minting)";
    }

    /**
     * No particular initialization is required by this plug-in.
     */
    function _initialize() internal override {}

    /**
     * Metadata is not implemented in this plug-in.
     */
    function _tokenMetadata(uint256) internal view override returns (bytes memory) {
        return "";
    }

    /**
     * An event for when the brand currency minting earnings
     * receiver is changed.
     */
    event BrandCurrencyMintingEarningsReceiverUpdated(address indexed updatedBy, address newReceiver);

    /**
     * Set the new brand currency minting earnings receiver.
     */
    function setBrandCurrencyMintingEarningsReceiver(address _newReceiver) public
        nonDelegable onlyMetaverseAllowed(METAVERSE_MANAGE_CURRENCIES_SETTINGS)
    {
        require(
            _newReceiver != address(0),
            "CurrencyMintingPlugin: the brand currency minting earnings receiver must not be the 0 address"
        );
        brandCurrencyMintingEarningsReceiver = _newReceiver;
        emit BrandCurrencyMintingEarningsReceiverUpdated(_msgSender(), _newReceiver);
    }

    /**
     * An event for when the currency mint cost is updated.
     * Updating it to 0 disables it completely.
     */
    event CurrencyMintCostUpdated(address indexed updatedBy, uint256 newCost);

    /**
     * Sets the currency mint cost.
     */
    function setCurrencyMintCost(uint256 newCost) public
        nonDelegable onlyMetaverseAllowed(METAVERSE_MANAGE_CURRENCIES_SETTINGS)
    {
        currencyMintCost = newCost;
        emit CurrencyMintCostUpdated(_msgSender(), newCost);
    }

    /**
     * An event for when the currency mint amount is updated.
     * Typically, this value will be something like 1000 eth
     * (1000 * 10^18). Updating it to 0 disables it completely.
     */
    event CurrencyMintAmountUpdated(address indexed updatedBy, uint256 newAmount);

    /**
     * Sets the currency mint amount.
     */
    function setCurrencyMintAmount(uint256 newAmount) public
        nonDelegable onlyMetaverseAllowed(METAVERSE_MANAGE_CURRENCIES_SETTINGS)
    {
        currencyMintAmount = newAmount;
        emit CurrencyMintAmountUpdated(_msgSender(), newAmount);
    }

    /**
     * This modifier requires the mint amount to be nonzero.
     */
    modifier nonzeroMintAmount() {
        require(
            currencyMintAmount != 0,
            "CurrencyMintingPlugin: minting is disabled while the mint to amount per bulk is 0"
        );
        _;
    }

    modifier definedCurrency(uint256 _tokenId) {
        require(
            CurrencyDefinitionPlugin(definitionPlugin).currencyExists(_tokenId),
            "CurrencyMintingPlugin: the specified token id is not of a registered currency type"
        );
        _;
    }

    /**
     * This is a mean granted only to plug-in contracts to mint any
     * system currency. Due to the sensitivity of this feature, only
     * plug-ins in the same metaverse are allowed to use this method.
     */
    function mintSystemCurrency(address _to, uint256 _id, uint256 _bulks)
        public onlyWhenInitialized nonDelegable definedCurrency(_id) nonzeroMintAmount onlyPlugin
    {
        address scope = address(uint160((_id >> 64) & ((1 << 160) - 1)));
        _requireSystemScope(scope, 0x0);
        require(_bulks != 0, "CurrencyMintingPlugin: minting (system scope) issued with no units");
        CurrencyDefinitionPlugin(definitionPlugin).mintCurrency(
            _to, _id, _bulks * currencyMintAmount, "system currency mint"
        );
    }

    /**
     * This is a mean granted to brand-allowed users to mint any currency
     * defined for the respective brands. This feature can be used at sole
     * discretion of the brand users, and has a fee.
     */
    function mintBrandCurrency(
        bytes memory _delegation,
        address _to, uint256 _id, uint256 _bulks
    ) public payable onlyWhenInitialized delegable(_delegation, _delegation.length == 0 ? bytes32(0) : keccak256(abi.encodePacked(_to, _id, _bulks)))
      definedCurrency(_id) nonzeroMintAmount {
        address scope = address(uint160((_id >> 64) & ((1 << 160) - 1)));
        _requireBrandScope(scope, BRAND_MANAGE_CURRENCIES);
        if (IMetaverse(metaverse).isAllowed(METAVERSE_GIVE_BRAND_CURRENCIES, msg.sender)) {
            _requireNoPrice("CurrencyDefinitionPlugin: brand currency definition");
        } else {
            _requireNativeTokenPrice("CurrencyDefinitionPlugin: brand currency definition", currencyMintCost, _bulks);
            payable(brandCurrencyMintingEarningsReceiver).transfer(msg.value);
        }
        CurrencyDefinitionPlugin(definitionPlugin).mintCurrency(
            _to, _id, _bulks * currencyMintAmount, "paid brand mint"
        );
    }

    /**
     * Mints BEAT for a given address. This address may be a brand,
     * a user, or a contract.
     */
    function mintBEAT(address _to, uint256 bulks)
        public onlyWhenInitialized nonzeroMintAmount
        nonDelegable onlyMetaverseAllowed(METAVERSE_MINT_BEAT)
    {
        require(bulks != 0, "CurrencyMintingPlugin: BEAT minting issued with no units");
        uint256 BEATType = CurrencyDefinitionPlugin(definitionPlugin).BEATType();
        CurrencyDefinitionPlugin(definitionPlugin).mintCurrency(
            _to, BEATType, bulks * currencyMintAmount, "BEAT mint"
        );
    }

    /**
     * Receives WMATIC and BEAT. BEAT is burned and WMATIC is unwrapped.
     * Other tokens are all rejected.
     */
    function _receiveToken(address operator, address from, uint256 id, uint256 value) private {
        uint256 WMATICType = CurrencyDefinitionPlugin(definitionPlugin).WMATICType();
        uint256 BEATType = CurrencyDefinitionPlugin(definitionPlugin).BEATType();
        require(WMATICType != 0, "CurrencyMintingPlugin: definition plug-in is not initialized");
        if (id == WMATICType) {
            require(
                operator == from,
                "CurrencyMintingPlugin: for safety, only the owner is able to unwrap these tokens"
            );
            if (value == 0) return;
            require(!wmaticUnwrappingLocked, "CurrencyMintingPlugin: WMATIC-unwrapping reentrancy is forbidden");
            wmaticUnwrappingLocked = true;
            _burnToken(WMATICType, value);
            payable(from).transfer(value);
            wmaticUnwrappingLocked = false;
        } else if (id == BEATType) {
            if (value == 0) return;
            _burnToken(BEATType, value);
        } else {
            // Only plug-ins can burn currencies (and only currencies)
            // by safe-transferring them to this contract.
            if (IMetaverse(metaverse).plugins(_msgSender()) &&
                CurrencyDefinitionPlugin(definitionPlugin).currencyExists(id)) {
                if (value == 0) return;
                _burnToken(id, value);
            } else {
                revert("CurrencyMintingPlugin: cannot receive, from users, non-currency tokens");
            }
        }
    }

    /**
     * Callback to manage the reception of ERC-1155 tokens from the Economy.
     * This callback can only be invoked from the economy system.
     */
    function onERC1155Received(
        address operator, address from, uint256 id, uint256 value, bytes calldata
    ) external nonDelegable onlyEconomy returns (bytes4) {
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
    ) external nonDelegable onlyEconomy returns (bytes4) {
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
    receive() external payable onlyWhenInitialized {
        uint256 WMATICType = CurrencyDefinitionPlugin(definitionPlugin).WMATICType();
        CurrencyDefinitionPlugin(definitionPlugin).mintCurrency(
            _msgSender(), WMATICType, msg.value, "Currency wrapping"
        );
    }

    /**
     * Implements the way for the delegable context to return a metaverse.
     */
    function _metaverse() internal view override returns (address) {
        return metaverse;
    }

    /**
     * The implementation of _msgSender() is the one from DelegableContext.
     */
    function _msgSender() internal view virtual override(DelegableContext, Context) returns (address) {
        return DelegableContext._msgSender();
    }
}
