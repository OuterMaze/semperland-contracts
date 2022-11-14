// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "../../signatures/SignatureVerifierHub.sol";
import "../IMetaverseOwned.sol";
import "../IMetaverse.sol";
import "./IMetaverseSignatureVerifier.sol";

/**
 * This plug-in does not serve purposes for the end users, but just for other plug-ins.
 */
contract MetaverseSignatureVerifier is SignatureVerifierHub, IMetaverseSignatureVerifier, IMetaverseOwned {
    /**
     * Addresses can check for ERC165 compliance by using this
     * embeddable library.
     */
    using ERC165Checker for address;

    /**
     * The metaverse that will own this signature system.
     */
    address public metaverse;

    /**
     * Permission: To add a plug-in (here: setup verifiers).
     */
    bytes32 constant DEPLOY = keccak256("Metaverse::Deploy");

    /**
     * This plug-in MAY make use of initial verifiers. Typically,
     * no default verifier will be specified (but, at least, the
     * ECDSA one will be specified). Each verifier is specified
     * along its key. Keys must be unique.
     */
    constructor(address _metaverse, string[] memory _keys, address[] memory _verifiers)
        SignatureVerifierHub(_keys, _verifiers) {
        require(_metaverse != address(0), "MetaverseSignatureVerifier: the owner contract must not be 0");
        require(
            _metaverse.supportsInterface(type(IMetaverse).interfaceId),
            "MetaverseSignatureVerifier: the owner contract must implement IMetaverse"
        );
        metaverse = _metaverse;
    }

    /**
     * Tells whether a given interface is supported by this contract.
     */
    function supportsInterface(bytes4 _interfaceId) public view virtual
        override(IERC165, SignatureVerifier) returns (bool) {
        return SignatureVerifier.supportsInterface(_interfaceId) ||
               _interfaceId == type(IMetaverseSignatureVerifier).interfaceId ||
               _interfaceId == type(IMetaverseOwned).interfaceId;
    }

    /**
     * Adds a verifier to this plug-in. Verifiers cannot be removed.
     */
    function addVerifier(string memory _key, address _verifier) external {
        require(
            IMetaverse(metaverse).isAllowed(DEPLOY, msg.sender),
            "MetaverseSignatureVerifier: caller is not metaverse owner, and does not have the required permission"
        );
        _addVerifier(_key, _verifier);
    }
}
