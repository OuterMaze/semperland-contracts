// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "../BrandRegistry.sol";

contract SampleBrandRegistry is BrandRegistry {
    /**
     * The deployer of this metaverse.
     */
    address public deployer;

    constructor(address _metaverse) BrandRegistry(_metaverse) {
        deployer = _msgSender();
    }

    /**
     * Setting the brand registration fee is only allowed to the deployer.
     */
    function _canSetBrandRegistrationCost(address _sender) internal override view returns (bool) {
        return _sender == deployer;
    }

    /**
     * Setting a brand's social commitment is only allowed to the deployer.
     */
    function _canSetBrandCommitment(address _sender) internal override view returns (bool) {
        return _sender == deployer;
    }

    /**
     * Withdrawing funds from brand registrations is only allowed to the deployer.
     */
    function _canWithdrawBrandRegistrationEarnings(address _sender) internal view override returns (bool) {
        return _sender == deployer;
    }
}
