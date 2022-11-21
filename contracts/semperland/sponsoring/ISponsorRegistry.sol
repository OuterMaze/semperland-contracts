// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

/**
 * The interface of the SponsorRegistry.
 */
interface ISponsorRegistry {
    /**
     * The sponsors currently registered.
     */
    function sponsors(address) external view returns (bool);

    /**
     * A mapping [sponsor][brand] => true for a brand to be sponsored
     * by a given sponsor. Ony brands can be sponsored.
     */
    function sponsored(address, address) external view returns (bool);
}
