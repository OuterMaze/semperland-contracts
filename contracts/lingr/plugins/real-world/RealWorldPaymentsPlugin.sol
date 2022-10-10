// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "../../IMetaverse.sol";
import "../../economy/IEconomy.sol";
import "../base/MetaversePlugin.sol";
import "./RealWorldPaymentsBoxesMixin.sol";
import "./RealWorldPaymentsReceptionMixin.sol";

/**
 * This plug-in enables people to do real-world payments.
 * These payments are generated off-chain, and typically
 * the parties interact face to face (but they also might
 * interact via an external website or another medium not
 * integrated with the blockchain itself).
 */
contract RealWorldPaymentsPlugin is
    MetaversePlugin, RealWorldPaymentsBoxesMixin, RealWorldPaymentsReceptionMixin  {
    /**
     * This is a global payment fee. The fee is expressed
     * as units per 10000 and will not, typically, exceed
     * 300 (3%) in this global setting.
     */
    uint256 paymentFee;

    /**
     * Instantiating this plug-in requires the metaverse,
     * a set of allowed payment order signers and a global
     * fee (which will nevertheless be overridable by a
     * "promotional" setting which can be given by users
     * having the appropriate permissions, but per owner
     * instead of per market).
     */
    constructor(
        address _metaverse, uint256 _paymentFee, address[] memory _verifiers
    ) MetaversePlugin(_metaverse) RealWorldPaymentsSignaturesMixin(_verifiers) {
        // marketImage = _marketImage;
        paymentFee = _paymentFee;
    }

    /**
     * This plug-in has no initialization (i.e. no token type definition).
     */
    function _initialize() internal override {}

    /**
     * This plug-in has no token metadata (since it has no token type definition).
     */
    function _tokenMetadata(uint256 _tokenId) internal view override returns (bytes memory) { return ""; }

    /**
     * The title of the current plug-in is "Real-World Payments".
     */
    function title() external view override returns (string memory) {
        return "Real-World Payments";
    }

    /**
     * Returns the global Economy contract to be used in both traits.
     */
    function _economy() internal view override(RealWorldPaymentsBoxesMixin, RealWorldPaymentsReceptionMixin)
        returns (address) {
        return IMetaverse(metaverse).economy();
    }

    /**
     * Checks interface support both in MetaversePlugin and SignatureVerifier.
     */
    function supportsInterface(bytes4 _interfaceId) public view
        override(MetaversePlugin, SignatureVerifier) returns (bool) {
        return MetaversePlugin.supportsInterface(_interfaceId) || SignatureVerifier.supportsInterface(_interfaceId);
    }

    /**
     * Checks whether, for a given box id (by its hash), a sender can be
     * confirmed to be a valid signer-allowed for it.
     */
    function _canAllowWithdraw(address _sender, bytes32 _boxIdHash) internal virtual override view returns (bool) {
        // TODO implement.
        return false;
    }

    /**
     * Attends an incoming payment (it may be either native or token, but not both).
     */
    function _paid(
        bytes32 _paymentIdHash, uint256 _nativeAmount, uint256[] memory _ids, uint256[] memory _amounts,
        uint256[] memory _rewardIds, uint256[] memory _rewardAmounts, address _signer
    ) internal override {
        // TODO implement.
    }
}
