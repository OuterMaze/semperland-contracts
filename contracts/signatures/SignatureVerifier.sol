// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "./ISignatureVerifier.sol";

/**
 * Signature verifying contracts should implement this class
 * as it provides also a default way to check the interfaces
 * compliance appropriately.
 */
abstract contract SignatureVerifier is ISignatureVerifier {
    /**
     * A signature verifier contract satisfies the ISignatureVerifier and IERC165.
     */
    function supportsInterface(bytes4 _interfaceId) public view returns (bool) {
        return _interfaceId == type(IERC165).interfaceId || interfaceId == type(ISignatureVerifier).interfaceId;
    }

    /**
     * Given a message and a signature, tries the verification.
     * If everything is right, the signing account's address is
     * returned. Otherwise, unless there is an error, the zero
     * address is returned.
     */
    function verifySignature(bytes32 _message, bytes memory _signature) external virtual view returns (address);
}
