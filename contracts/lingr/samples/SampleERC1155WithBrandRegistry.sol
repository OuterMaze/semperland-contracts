// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "../BrandRegistry.sol";
import "../../IdUtils.sol";

contract SampleERC1155WithBrandRegistry is ERC1155, BrandRegistry {
    address public owner;

    constructor() ERC1155("about:blank") {
        owner = msg.sender;
    }

    function _canSetBrandRegistrationCost(address _sender) internal override view returns (bool) {
        return owner == _sender;
    }

    function _mintBrandFor(address _brandId, address _owner) internal override {
        _mint(_owner, uint256(uint160(_brandId)), 1, "SampleERC1155WithBrandRegistry: test _mintBrandFor");
    }

    function _isBrandOwnerApprovedEditor(address _brandOwner, address _sender) internal view override returns (bool) {
        return isApprovedForAll(_brandOwner, _sender);
    }

    function _canWithdrawBrandRegistrationEarnings(address _sender) internal view override returns (bool) {
        return owner == _sender;
    }

    function _canSetBrandCommitment(address _sender) internal view override returns (bool) {
        return owner == _sender;
    }

    function _safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) internal override {
        super._safeTransferFrom(from, to, id, amount, data);
        if (id < (1 << 160)) {
            _setBrandOwner(address(uint160(id)), to);
        }
    }

    function _safeBatchTransferFrom(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal override {
        super._safeBatchTransferFrom(from, to, ids, amounts, data);
        for(uint256 index = 0; index < amounts.length; index++) {
            if (ids[index] < (1 << 160) && amounts[index] != 0) {
                _setBrandOwner(address(uint160(ids[index])), to);
            }
        }
    }
}