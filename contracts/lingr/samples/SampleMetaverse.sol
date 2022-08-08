// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "../Metaverse.sol";

contract SampleMetaverse is Metaverse {
    /**
     * The deployer of this metaverse.
     */
    address public deployer;

    constructor() {
        deployer = _msgSender();
    }

    /**
     * Adding the plug-ins is only allowed to the deployer.
     */
    function _canAddPlugin(address _sender) internal view override returns (bool) {
        return _sender == deployer;
    }

    /**
     * Setting the brand registry is only allowed to the deployer.
     */
    function _canSetBrandRegistry(address _sender) internal view override returns (bool) {
        return _sender == deployer;
    }

    /**
     * Setting the economy system is only allowed to the deployer.
     */
    function _canSetEconomy(address _sender) internal view override returns (bool) {
        return _sender == deployer;
    }
}
