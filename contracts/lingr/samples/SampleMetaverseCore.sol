// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "../MetaverseAssetsRegistrar.sol";

/**
 * This is a sample metaverse. It has brand registry and the
 * metaverse core.
 */
contract SampleMetaverseCore is ERC1155, MetaverseAssetsRegistrar {
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

    function _canAddPlugin(address _sender) internal view override returns (bool) {
        return owner == _sender;
    }

    function _mintFor(address _to, uint256 _tokenId, uint256 _amount, bytes memory _data) internal override {
        _mint(_to, _tokenId, _amount, _data);
    }

    function _burn(address _from, uint256 _tokenId, uint256 _amount) internal override {
        super._burn(_from, _tokenId, _amount);
        _tokenBurned(_from, _tokenId, _amount);
    }

    function _burnBatch(address _from, uint256[] memory _tokenIds, uint256[] memory _amounts) internal override {
        super._burnBatch(_from, _tokenIds, _amounts);
        _tokensBurned(_from, _tokenIds, _amounts);
    }
}