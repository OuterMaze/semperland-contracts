// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

/**
 * An interface to tell a component is owned by the metaverse.
 */
interface IMetaverseOwned {
    /**
     * The metaverse this component was created for.
     */
    function metaverse() external view returns (address);
}
