// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "../../../signatures/SignatureVerifierHub.sol";
import "../base/MetaversePlugin.sol";

/**
 * This plug-in does not serve purposes for the end users, but just for other plug-ins.
 */
contract SignatureVerifierPlugin is MetaversePlugin, SignatureVerifierHub {
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
        MetaversePlugin(_metaverse) SignatureVerifierHub(_keys, _verifiers) {}

    /**
     * The title for this token.
     */
    function title() public view override returns (string memory) {
        return "Signature Verifier";
    }

    /**
     * This plug-in does not create tokens, so it will not be
     * responsible for any defined token's metadata.
     */
    function _tokenMetadata(uint256) internal view override returns (bytes memory) {
        return "";
    }

    /**
     * This plug-in does not need any type of initialization.
     */
    function _initialize() internal override {}

    /**
     * Tells whether a given interface is supported by this contract.
     */
    function supportsInterface(bytes4 _interfaceId) public view virtual
        override(MetaversePlugin, SignatureVerifier) returns (bool) {
        return MetaversePlugin.supportsInterface(_interfaceId) ||
               SignatureVerifier.supportsInterface(_interfaceId);
    }

    /**
     * Adds a verifier to this plug-in. Verifiers cannot be removed.
     */
    function addVerifier(string memory _key, address _verifier) external onlyMetaverseAllowed(DEPLOY) {
        _addVerifier(_key, _verifier);
    }
}
