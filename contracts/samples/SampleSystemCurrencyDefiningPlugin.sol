// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "../lingr/plugins/base/MetaversePlugin.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "../lingr/plugins/currency/CurrencyDefinitionPlugin.sol";

/**
 * This sample contract makes use of a related currency defining plug-in.
 * It implements a method to define system currencies directly, based on
 * the currency definition plug-in.
 */
contract SampleSystemCurrencyDefiningPlugin is MetaversePlugin {
    address private currencyDefiningPlugin;
    uint256 public nextCurrencyIndex = 1;

    constructor(address _metaverse, address _currencyDefiningPlugin) MetaversePlugin(_metaverse) {
        currencyDefiningPlugin = _currencyDefiningPlugin;
    }

    function defineSystemCurrency() public {
        string memory name = string(abi.encodePacked("SysCurr #", Strings.toString(nextCurrencyIndex)));
        string memory description = string(abi.encodePacked("System Currency #", Strings.toString(nextCurrencyIndex)));
        string memory image = string(abi.encodePacked(
            "http://example.org/sys-currs/image-", Strings.toString(nextCurrencyIndex), ".png"
        ));
        string memory icon16x16 = string(abi.encodePacked(
            "http://example.org/sys-currs/icon16-", Strings.toString(nextCurrencyIndex), ".png"
        ));
        string memory icon32x32 = string(abi.encodePacked(
            "http://example.org/sys-currs/icon32-", Strings.toString(nextCurrencyIndex), ".png"
        ));
        string memory icon64x64 = string(abi.encodePacked(
            "http://example.org/sys-currs/icon64-", Strings.toString(nextCurrencyIndex), ".png"
        ));
        CurrencyDefinitionPlugin(currencyDefiningPlugin).defineSystemCurrency(
            _msgSender(), name, description, image, icon16x16, icon32x32, icon64x64, "#ddcc00"
        );
        nextCurrencyIndex += 1;
    }

    function title() public view override returns (string memory) {
        return "Sample System Currency Definition";
    }

    function _tokenMetadata(uint256) internal view override returns (bytes memory) {
        return "";
    }

    function _initialize() internal override {}
}
