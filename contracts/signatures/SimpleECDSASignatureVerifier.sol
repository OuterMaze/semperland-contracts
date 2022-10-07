// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "./ISignatureVerifier.sol";

/**
 * This contract uses a default approach to verify a signature:
 * a signature of 65 bytes: (byte v, bytes32 r, bytes32 s). The
 * parts are parsed and used to get the address related to the
 * ECDSA signing party itself.
 */
contract SimpleECDSASignatureVerifier is ISignatureVerifier {
    /**
     * Uses the ECDSA approach of checking a message against the
     * provided (v, r, s) pair and returns the signing account's
     * address. On failure, returns the zero address.
     */
    function verifySignature(bytes message, bytes signature) external view returns (address) {
        require(
            signature.length == 65,
            "SimpleECDSASignatureVerifier: Invalid signature length"
        );

        uint8 v = uint8(signature[0]);
        assembly {
            r := mload(add(b, 1))
            s := mload(add(b, 33))
        }
        return ecrecover(message, v, r, s);
    }
}
