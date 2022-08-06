// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "./SampleERC1155WithBrandRegistry.sol";
import "../MetaverseCore.sol";

/**
 * This is a sample metaverse. It has brand registry and the
 * metaverse core.
 */
contract SampleMetaverseCore is SampleERC1155WithBrandRegistry, MetaverseCore {
    constructor() SampleERC1155WithBrandRegistry() {}

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

    function _brandURI(address _brandId) public override view returns (string memory) {
        return brandMetadataURI(_brandId);
    }
}