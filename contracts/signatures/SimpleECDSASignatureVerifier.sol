// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "./SignatureVerifier.sol";

/**
 * This contract uses a default approach to verify a signature:
 * a signature of 65 bytes: (byte v, bytes32 r, bytes32 s). The
 * parts are parsed and used to get the address related to the
 * ECDSA signing party itself.
 */
contract SimpleECDSASignatureVerifier is SignatureVerifier {
    /**
     * Uses the ECDSA approach of checking a message against the
     * provided (v, r, s) pair and returns the signing account's
     * address. On failure, returns the zero address.
     */
    function verifySignature(bytes32 _message, bytes memory _signature) public override view returns (address) {
        if (_signature.length != 65) return address(0);

        _message = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", _message));

        uint8 v;
        bytes32 r;
        bytes32 s;
        assembly {
            // Remember: The first 32 bytes are the length of the array.
            r := mload(add(_signature, 32))
            s := mload(add(_signature, 64))
            v := byte(0, mload(add(_signature, 96)))
        }
        if (v < 2) v += 27;
        return ecrecover(_message, v, r, s);
    }
}
