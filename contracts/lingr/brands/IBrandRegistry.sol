// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/**
 * A contract satisfying this interface will have capabilities
 * to query the existing brands' existence or metadata.
 */
interface IBrandRegistry {
    /**
     * Assembles the whole metadata for a brand. WARNING: This method
     * will consume a lot of gas if invoked inside a transaction, so
     * it is recommended to invoke this method in the context of a
     * CALL, and never in the context of a SEND (even as part of other
     * contract's code).
     */
    function brandMetadataURI(address _brandId) external view returns (string memory);

    /**
     * Tells whether an address corresponds to a registered brand or not.
     */
    function brandExists(address _brandId) external view returns (bool);

    /**
     * A hook to execute when the owner of a brand changed.
     */
    function onBrandOwnerChanged(address _brandId, address _newOwner) external;

    /**
     * Tells whether a user has a specific permission on a specific brand
     * or it is allowed by the brand's ownership.
     */
    function isBrandAllowed(address _brandId, bytes32 _permission, address _sender) external view returns (bool);

    /**
     * Tells whether the address is a committed brand, or not
     * (this may also be caused by the address not being a brand).
     */
    function isCommitted(address _brandId) external view returns (bool);
}
