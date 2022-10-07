// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import "./ISignatureVerifier.sol";
import "./SignatureVerifier.sol";

/**
 * This contract maintains a list of signature verifier contracts
 * that try checking whether a signature is valid or not. Such
 * check returns the appropriate address. This contract can be
 * extended to add means to add or remove verifiers.
 */
contract SignatureVerifierHub is SignatureVerifier {
    /**
     * Addresses can check for ERC165 compliance by using this
     * embeddable library.
     */
    using ERC165Checker for address;

    /**
     * The contracts used for signature verification.
     */
    address[] public verifiers;

    /**
     * The construction may involve a non-empty list of verifiers
     * that are present by default (typically, only the Simple
     * ECDSA Signature Verifier will exist by default). Addresses
     * not being contracts satisfying ISignatureVerifier will be
     * silently discarded.
     */
    constructor(address[] memory _verifiers) {
        for(uint256 index = 0; index < _verifiers.length; index++) {
            address verifier = _verifiers[index];
            if (_verifiers[index].supportsInterface(type(ISignatureVerifier).interfaceId)) {
                verifiers.push(verifier);
            }
        }
    }

    /**
     * Verifies a signature by iteration among all the verifiers.
     */
    function verifySignature(bytes32 _message, bytes memory _signature) external override view returns (address) {
        for(uint256 index = 0; index < verifiers.length; index++) {
            address verifier = verifiers[index];

            bytes memory callData = abi.encodeWithSelector(
                ISignatureVerifier.verifySignature.selector,
                _message, _signature
            );

            (bool didSucceed, bytes memory returnData) = verifier.staticcall(callData);
            require(
                didSucceed && returnData.length == 32,
                "SignatureVerifierHub: verifySignature call failed"
            );

            address returnedValue;
            assembly {
                // Remember: the first 32 bytes are the length
                returnedValue := mload(add(returnData, 32))
            }
            if (returnedValue != address(0)) return returnedValue;
        }
        return address(0);
    }
}
