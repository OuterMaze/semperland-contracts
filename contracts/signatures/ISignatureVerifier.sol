// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

/**
 * Contracts implementing this interface are meant to be used
 * externally (i.e. proxied, or even iterated) to test whether
 * a certain message is appropriately signed with a given
 * signature, whatever it is.
 */
interface ISignatureVerifier {
    /**
     * Verifies a message against its signature. On invalid
     * data format / size, this function reverts. On failure
     * when verifying, this function returns the address of
     * the signing account.
     */
    function verifySignature(bytes message, bytes signature) external view returns (address);
}
