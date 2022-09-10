// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "../lingr/plugins/base/MetaversePlugin.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "../lingr/plugins/currency/CurrencyMintingPlugin.sol";

/**
 * This sample contract makes use of a related currency minting plug-in.
 * It implements a method to mint system currencies directly, based on
 * the currency minting plug-in.
 */
contract SampleSystemCurrencyMintingPlugin is MetaversePlugin {
    address payable private currencyMintingPlugin;

    constructor(address _metaverse, address payable _currencyMintingPlugin) MetaversePlugin(_metaverse) {
        currencyMintingPlugin = _currencyMintingPlugin;
    }

    function mintSystemCurrency(address _to, uint256 _id, uint256 _amount) public {
        CurrencyMintingPlugin(currencyMintingPlugin).mintSystemCurrency(_to, _id, _amount);
    }

    function title() public view override returns (string memory) {
        return "Sample System Currency Minting";
    }

    function _tokenMetadata(uint256) internal view override returns (bytes memory) {
        return "";
    }

    function _initialize() internal override {}
}