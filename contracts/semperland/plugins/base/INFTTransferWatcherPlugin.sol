// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

/**
 * This interface can be implemented to track when an NFT is being
 */
interface INFTTransferWatcherPlugin {
    /**
     * This method is invoked when an NFT (defined in the implementing
     * plug-in) changes its ownership to a new one.
     */
    function onNFTOwnerChanged(uint256 _nftId, address _newOwner) external;
}
