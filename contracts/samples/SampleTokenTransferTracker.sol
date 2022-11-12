// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "../lingr/plugins/base/MetaversePlugin.sol";
import "../lingr/plugins/base/FTDefiningPlugin.sol";
import "../lingr/plugins/base/NFTDefiningPlugin.sol";
import "../lingr/plugins/base/FTMintingPlugin.sol";
import "../lingr/plugins/base/NFTMintingPlugin.sol";
import "../lingr/plugins/base/TokenBurningPlugin.sol";

contract SampleTokenTransferTracker is MetaversePlugin, IERC1155Receiver,
    FTDefiningPlugin, NFTDefiningPlugin, FTMintingPlugin, NFTMintingPlugin, TokenBurningPlugin
{
    uint256 public sampleNFTType;
    uint256 public sampleFTType;

    constructor(address _metaverse) MetaversePlugin(_metaverse) {}

    function title() public view override returns (string memory) {
        return "Sample Token Transfer Tracker";
    }

    function _tokenMetadata(uint256) internal view override returns (bytes memory) {
        return "";
    }

    function _initialize() internal override {
        sampleFTType = _defineNextSystemFTType();
        sampleNFTType = _defineNextNFTType();
    }

    function mintFT() external {
        _mintNFTFor(msg.sender, sampleNFTType, "");
    }

    function mintFT(uint256 _amount) external {
        _mintFTFor(msg.sender, sampleFTType, _amount, "");
    }

    /**
     * Callback to manage the reception of a single token.
     */
    function onERC1155Received(
        address _operator, address _from, uint256 _id, uint256 _value, bytes calldata
    ) external onlyEconomy returns (bytes4) {
        _burnToken(_id, _value);
        return IERC1155Receiver.onERC1155Received.selector;
    }

    /**
     * Callback to manage the reception of ERC-1155 tokens from the Economy.
     * This callback can only be invoked from the economy system.
     */
    function onERC1155BatchReceived(
        address _operator, address _from, uint256[] calldata _ids, uint256[] calldata _values,
        bytes calldata
    ) external onlyEconomy returns (bytes4) {
        _burnTokens(_ids, _values);
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }
}
