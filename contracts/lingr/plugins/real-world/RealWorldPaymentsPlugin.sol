// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "../../IMetaverse.sol";
import "../../economy/IEconomy.sol";
import "../base/MetaversePlugin.sol";
import "./RealWorldMarketsManagementPlugin.sol";
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
    uint256 public paymentFee;

    /**
     * The 3rd hash of the box that will be used to receive
     * the fees that are earned on payments. The original
     * value should be kept in secret, although it is not
     * needed at all.
     */
    bytes32 private feeBoxIdHash3;

    /**
     * A reference to the markets management plug-in.
     */
    address marketsManagementPlugin;

    /**
     * Markets (1st hash) by their boxes (3rd hash).
     */
    mapping(bytes32 => bytes32) boxMarkets;

    /**
     * Instantiating this plug-in requires the metaverse,
     * a set of allowed payment order signers and a global
     * fee (which will nevertheless be overridable by a
     * "promotional" setting which can be given by users
     * having the appropriate permissions, but per owner
     * instead of per market).
     */
    constructor(
        address _metaverse, uint256 _paymentFee, address[] memory _verifiers,
        bytes32 _feeBoxIdHash2, address _marketsManagementPlugin
    ) MetaversePlugin(_metaverse) RealWorldPaymentsSignaturesMixin(_verifiers) {
        feeBoxIdHash3 = _hash(_feeBoxIdHash2);
        _makeBox(feeBoxIdHash3);
        paymentFee = _paymentFee;
        marketsManagementPlugin = _marketsManagementPlugin;
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
     * Checks whether, for a given box id (by its hash), a sender is allowed to
     * add / remove signers for a given box.
     */
    function _canAllowAccounts(address _sender, bytes32 _boxIdHash) internal virtual override view returns (bool) {
        return _canManageMarket(_sender, boxMarkets[_hash(_hash(_boxIdHash))]);
    }

    /**
     * Tells whether a sender is manager of the market by its hash.
     */
    function _canManageMarket(address _sender, bytes32 _marketIdHash) private view returns (bool) {
        return RealWorldMarketsManagementPlugin(marketsManagementPlugin).isMarketManager(
            _marketIdHash, keccak256(abi.encodePacked(_managerAddressHash))
        );
        return false;
    }

    /**
     * Checks whether a given box belongs to an owner that is a brand regarded
     * as a socially committed one.
     */
    function _boxHasCommittedOwner(bytes32 _boxIdHash3) private view returns (bool) {
        return RealWorldMarketsManagementPlugin(marketsManagementPlugin).isMarketOwnedByCommittedBrand(
            boxMarkets[_boxIdHash3]
        );
    }

    /**
     * Creates a box for a market (Given the 2nd hash of the box).
     * This is only allowed when the sender is allowed to manage
     * the said market (also fails if the market does not exist).
     */
    function makeBox(bytes32 _boxIdHash2, bytes32 _marketIdHash) external {
        bytes32 _boxIdHash3 = _hash(_boxIdHash2);
        require(
            _canManageMarket(boxMarkets[_boxIdHash3]),
            "RealWorldPaymentsPlugin: the sender is not allowed to create a box for this market"
        );
        _makeBox(_boxIdHash3);
    }

    /**
     * Attends an incoming payment (it may be either native or token, but not both).
     */
    function _paid(PaidData memory paidData) internal override {
        Payment storage payment = payments[paidData.paymentIdHash];
        require(payment.creator != address(0), "RealWorldPaymentsPlugin: payment does not exist");
        bytes32 boxIdHash3 = payment.boxIdHash3;
        BoxFunds storage box = boxes[boxIdHash3];
        require(box.exists, "RealWorldPaymentsPlugin: the box associated to this payment does not exist anymore");
        BoxPermissions storage perms = boxPermissions[boxIdHash3];
        require(
            perms.paymentMakeAllowed[keccak256(abi.encode(paidData.signer))],
            "RealWorldPaymentsPlugin: the payment signer is not allowed anymore to operate in the associated box"
        );
        if (_boxHasCommittedOwner(boxIdHash3)) {
            // Move 100% to the owner's box.
            _fund(boxIdHash3, paidData.matic, paidData.ids, paidData.values);
        } else {
            // Move (1 - fee) to the owner's box.
            // Move (fee)) to our box.
            uint256 length = paidData.values.length;
            uint256[] memory feeValues = new uint256[](length);
            uint256[] memory remainingValues = new uint256[](length);
            for(uint256 index = 0; index < length; index++) {
                feeValues[index] = paidData.values[index] * paymentFee / 1000;
                remainingValues[index] = paidData.values[index] - feeValues[index];
            }
            uint256 feeMatic = paidData.matic * paymentFee / 1000;
            uint256 remainingMatic = paidData.matic - feeMatic;
            _fund(feeBoxIdHash3, feeMatic, paidData.ids, feeValues);
            _fund(boxIdHash3, remainingMatic, paidData.ids, remainingValues);
        }
        IEconomy(_economy()).safeBatchTransferFrom(
            address(this), paidData.payer, paidData.rewardIds, paidData.rewardValues, ""
        );
        delete payments[paidData.paymentIdHash];
    }
}
