// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "../../../NativePayable.sol";
import "../base/MetaversePlugin.sol";
import "../base/FTTypeCheckingPlugin.sol";
import "../base/FTMintingPlugin.sol";
import "../base/FTBurningPlugin.sol";
import "./CurrencyDefinitionPlugin.sol";

/**
 * This contract is the "minting" part of the Currency feature.
 * This means: it depends on the "definition" part and allows
 * mint operations for plug-ins, brands or metaverse managers.
 */
contract CurrencyMintingPlugin is NativePayable, IERC1155Receiver, FTTypeCheckingPlugin,
    FTMintingPlugin, FTBurningPlugin {
    /**
     * The address of the related currency definition plug-in.
     */
    address public definitionPlugin;

    // Reentrancy lock.
    bool private wmaticUnwrappingLocked = false;

    /**
     * This permission allows users to mint currencies for a cost for
     * a brand.
     */
    bytes32 constant BRAND_MANAGE_CURRENCIES = keccak256("Plugins::Currency::Brand::Currencies::Manage");

    /**
     * This permission allows users to mint BEAT for a given
     * brand (typically, one having committed=true).
     */
    bytes32 constant METAVERSE_MINT_BEAT = keccak256("Plugins::Currency::BEAT::Mint");

    /**
     * This plug-in does not require extra details on construction.
     */
    constructor(address _metaverse, address _definitionPlugin) MetaversePlugin(_metaverse) {
        definitionPlugin = _definitionPlugin;
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
    function mintSystemCurrency(address _to, uint256 _id, uint256 _amount)
        public onlyWhenInitialized definedCurrency(_id) onlyPlugin
    {
        address scope = address(uint160((_id >> 64) & ((1 << 160) - 1)));
        _requireSystemScope(scope, 0x0);
        require(_amount != 0, "CurrencyMintingPlugin: minting (system scope) issued with zero amount");
        CurrencyDefinitionPlugin(definitionPlugin).mintCurrency(_to, _id, _amount, "system currency mint");
    }

    /**
     * This is a mean granted to brand-allowed users to mint any currency
     * defined for the respective brands. This feature can be used at sole
     * discretion of the brand users, and has a fee.
     */
    function mintBrandCurrency(address _to, uint256 _id, uint256 _amount)
        public onlyWhenInitialized definedCurrency(_id)
    {
        address scope = address(uint160((_id >> 64) & ((1 << 160) - 1)));
        _requireBrandScope(scope, BRAND_MANAGE_CURRENCIES);
        require(_amount != 0, "CurrencyMintingPlugin: brand currency minting issued with zero amount");
        CurrencyDefinitionPlugin(definitionPlugin).mintCurrency(_to, _id, _amount, "paid brand mint");
    }

    /**
     * Mints BEAT for a given address. This address may be a brand,
     * a user, or a contract.
     */
    function mintBEAT(address _to, uint256 _amount)
        public onlyWhenInitialized onlyMetaverseAllowed(METAVERSE_MINT_BEAT)
    {
        require(_amount != 0, "CurrencyMintingPlugin: BEAT minting issued with zero amount");
        uint256 BEATType = CurrencyDefinitionPlugin(definitionPlugin).BEATType();
        CurrencyDefinitionPlugin(definitionPlugin).mintCurrency(
            _to, BEATType, _amount, "BEAT mint"
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
            _burnFT(WMATICType, value);
            payable(from).transfer(value);
            wmaticUnwrappingLocked = false;
        } else if (id == BEATType) {
            if (value == 0) return;
            _burnFT(BEATType, value);
        } else {
            // Only plug-ins can burn currencies (and only currencies)
            // by safe-transferring them to this contract.
            if (IMetaverse(metaverse).plugins(_msgSender()) &&
                CurrencyDefinitionPlugin(definitionPlugin).currencyExists(id) &&
                CurrencyDefinitionPlugin(definitionPlugin).currencyIsUnbounded(id)) {
                if (value == 0) return;
                _burnFT(id, value);
            } else {
                revert("CurrencyMintingPlugin: cannot receive, from users, non-currency or bounded currency tokens");
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
    receive() external payable onlyWhenInitialized {
        uint256 WMATICType = CurrencyDefinitionPlugin(definitionPlugin).WMATICType();
        CurrencyDefinitionPlugin(definitionPlugin).mintCurrency(
            _msgSender(), WMATICType, msg.value, "Currency wrapping"
        );
    }
}
