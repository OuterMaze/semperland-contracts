// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "../semperland/economy/SafeExchange.sol";

contract SampleERC1155WithSafeExchange is ERC1155, SafeExchange
{
    constructor() ERC1155("about:blank") {
        _mint(_msgSender(), 1, 1 ether, "test");
        _mint(_msgSender(), 2, 2 ether, "test");
        _mint(_msgSender(), 3, 3 ether, "test");
    }

    function _batchTransfer(
        uint256 _dealIndex, address _from, address _to, uint256[] memory _tokenIds, uint256[] memory _tokenAmounts
    ) internal override {
        _safeBatchTransferFrom(_from, _to, _tokenIds, _tokenAmounts, abi.encodePacked(
            "SampleERC1155WithSafeExchange: executing deal ", Strings.toString(_dealIndex)
        ));
    }

    function _isApproved(address _party, address _sender) internal override view returns (bool) {
        return isApprovedForAll(_party, _sender);
    }

    /**
     * Requires only FTs.
     */
    function _requireFTsOnly(uint256[] memory _tokenIds) private {
        for(uint256 i = 0; i < _tokenIds.length; i++) {
            require(
                _tokenIds[i] > 0 && _tokenIds[i] < 4,
                "SampleERC1155WithSafeExchange: only ids 1, 2, 3 are allowed in deal exchanges"
            );
        }
    }

    /**
     * Deal start: checks whether the ids are of FTs only.
     */
    function _checkDealStart(
        address _emitter, address _receiver, uint256[] memory _tokenIds, uint256[] memory _tokenAmounts
    ) internal override {
        _requireFTsOnly(_tokenIds);
    }

    /**
     * Deal acceptance: checks whether the ids are of FTs only.
     */
    function _checkDealAccept(
        uint256 _dealIndex, uint256[] memory _tokenIds, uint256[] memory _tokenAmounts
    ) internal override {
        _requireFTsOnly(_tokenIds);
    }
}
