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
     * The registered verifier contracts (by index).
     */
    address[] public verifiers;

    /**
     * The registered verifier keys (by index).
     */
    string[] public verifiersKeys;

    /**
     * The internal mapping of verifiers. Only intended to avoid
     * using the same key twice.
     */
    mapping(string => address) private verifiersMapping;

    /**
     * Tells whether a given address can be considered a signer
     * of a given (by index) signing method registered here.
     * This is an explicit process an address must do for each
     * method (even the SimpleECDSA) they want to enable.
     */
    mapping(address => mapping(uint16 => bool)) public canSign;

    /**
     * The construction may involve a non-empty list of verifiers
     * that are present by default (typically, only the Simple
     * ECDSA Signature Verifier will exist by default). Addresses
     * not being contracts satisfying ISignatureVerifier will be
     * silently discarded.
     */
    constructor(string[] memory _keys, address[] memory _verifiers) {
        require(_keys.length == _verifiers.length, "SignatureVerifierHub: keys and verifiers length mismatch");
        for(uint256 index = 0; index < _verifiers.length; index++) {
            _addVerifier(_keys[index], _verifiers[index]);
        }
    }

    /**
     * The length of the registered verifiers.
     */
    function verifiersLength() external view returns (uint256) {
        return verifiers.length;
    }

    /**
     * Attempts adding a verifier contract to this hub.
     */
    function _addVerifier(string memory _key, address _verifier) internal {
        require(
            verifiers.length < 65536, "SignatureVerifierHub: No available space for a new verifier contract"
        );
        require(
            _verifier != address(0) && _verifier.supportsInterface(type(ISignatureVerifier).interfaceId),
            string(abi.encodePacked("SignatureVerifierHub: Invalid verifier contract at key: ", _key))
        );
        require(
            verifiersMapping[_key] == address(0), string(abi.encodePacked(
                "SignatureVerifierHub: The verifier contract key '", _key, "' is in use or somehow not available"
            ))
        );
        verifiersMapping[_key] = _verifier;
        verifiers.push(_verifier);
        verifiersKeys.push(_key);
    }

    /**
     * Tells whether an address registered itself to be able to sign using
     * a given method (in this case: ECDSA).
     */
    function setSignatureMethodAllowance(uint16 _method, bool _canSign) external {
        canSign[msg.sender][_method] = _canSign;
    }

    /**
     * Verifies a signature by iteration among all the verifiers.
     */
    function verifySignature(bytes32 _message, bytes memory _signature) public override view returns (address) {
        (uint16 index, bytes memory _subSignature) = abi.decode(_signature, (uint16, bytes));
        require(index < verifiers.length, "SignatureVerifierHub: invalid verifier index");

        try ISignatureVerifier(verifiers[index]).verifySignature(_message, _subSignature) returns (address result) {
            if (canSign[result][index]) return result;
        } catch {}
        return address(0);
    }
}
