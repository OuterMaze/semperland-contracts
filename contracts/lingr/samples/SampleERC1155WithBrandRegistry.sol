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

    function _isBrandOwnerApproved(address _brandOwner, address _sender) internal view override returns (bool) {
        return isApprovedForAll(_brandOwner, _sender);
    }

    function _canWithdrawBrandRegistrationEarnings(address _sender) internal view override returns (bool) {
        return owner == _sender;
    }
}
