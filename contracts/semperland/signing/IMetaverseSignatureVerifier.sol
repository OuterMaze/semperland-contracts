// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "../../signatures/ISignatureVerifier.sol";

/**
 * The interface for MetaverseSignatureVerifier.
 */
interface IMetaverseSignatureVerifier is ISignatureVerifier {
    /**
     * Adds a verifier to this plug-in. Verifiers cannot be removed.
     */
    function addVerifier(string memory _key, address _verifier) external;
}
