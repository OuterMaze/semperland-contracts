// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "./MetaversePlugin.sol";
import "./INFTTransferWatcherPlugin.sol";

/**
 * This interface can be implemented to track when an NFT is being
 */
abstract contract NFTTransferWatcherPlugin is MetaversePlugin, INFTTransferWatcherPlugin {
    /**
     * This method is invoked when an NFT (defined in the implementing
     * plug-in) changes its ownership to a new one.
     */
    function onNFTOwnerChanged(uint256 _nftId, address _newOwner) external virtual;

    /**
     * A metaverse plugin satisfies the IMetaversePlugin and IERC165.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return super.supportsInterface(interfaceId) || interfaceId == type(INFTTransferWatcherPlugin).interfaceId;
    }
}
