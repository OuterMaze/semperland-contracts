// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "../../IMetaverse.sol";
import "../../economy/IEconomy.sol";
import "../base/MetaversePlugin.sol";
import "./RealWorldPaymentsRewardAddressBoxesMixin.sol";
import "./RealWorldPaymentsReceptionMixin.sol";
import "./RealWorldPaymentsFeesMixin.sol";

/**
 * This plug-in enables people to do real-world payments.
 * These payments are generated off-chain, and typically
 * the parties interact face to face (but they also might
 * interact via an external website or another medium not
 * integrated with the blockchain itself).
 */
contract RealWorldPaymentsPlugin is RealWorldPaymentsRewardAddressBoxesMixin, RealWorldPaymentsReceptionMixin,
    RealWorldPaymentsFeesMixin {
    /**
     * This is the tracking of previous payments already
     * being processed in our payment system. This is done
     * to avoid the double payment of an invoice.
     */
    mapping(bytes32 => bool) private previousPayments;

    /**
     * This permission allows PoSs to sign payments on behalf of a
     * brand. This one matters when the brand is committed, actually,
     * but is anyway checked for all brands when present.
     */
    bytes32 constant BRAND_SIGN_PAYMENTS = keccak256("Plugins::RealWorldPayments::Brand::Payments::Sign");

    /**
     * Instantiating this plug-in requires the metaverse,
     * a set of allowed payment order signers and a global
     * fee (which will nevertheless be overridable by a
     * "promotional" setting which can be given by users
     * having the appropriate permissions, but per owner
     * instead of per market).
     */
    constructor(
        address _metaverse, uint256 _paymentFeeLimit, address _paymentFeeEarningsReceiver,
        address[] memory _verifiers
    ) RealWorldPaymentsFeesMixin(_metaverse, _paymentFeeLimit, _paymentFeeEarningsReceiver)
      RealWorldPaymentsSignaturesMixin(_verifiers) {}

    /**
     * No initialization is required for this plug-in.
     */
    function _initialize() internal override {}

    /**
     * No token metadata is rendered by this plug-in.
     */
    function _tokenMetadata(uint256) internal view override returns (bytes memory) { return ""; }

    /**
     * The title for this plug-in is: Real-World Payments.
     */
    function title() external view override returns (string memory) {
        return "Real-World Payments";
    }

    /**
     * Checks interface support both in MetaversePlugin and SignatureVerifier.
     */
    function supportsInterface(bytes4 _interfaceId) public view
        override(MetaversePlugin, RealWorldPaymentsReceptionMixin) returns (bool) {
        return MetaversePlugin.supportsInterface(_interfaceId) ||
               RealWorldPaymentsReceptionMixin.supportsInterface(_interfaceId);
    }

    /**
     * Returns the contract being used as ERC1155 source of truth.
     */
    function _economy() internal
        override(RealWorldPaymentsRewardAddressBoxesMixin, RealWorldPaymentsReceptionMixin) view returns (address) {
        return IMetaverse(metaverse).economy();
    }

    /**
     * An event registering who signed the payment, who paid it, who
     * was the payment sent to, what's the payment's digest, and also
     * the amount(s) paid and the received reward(s), if any.
     */
    event PaymentComplete(
        // Indices:
        // - signer (for when I'm a PoS watching my own events)
        // - from (for when I'm a customer watching my own events)
        // - paymentId (for both cases).
        address indexed signer, address to, address indexed from, bytes32 indexed paymentId,
        uint256 matic, uint256[] ids, uint256[] values, uint256[] rewardIds, uint256[] rewardValues
    );

    /**
     * This method must be overridden to tell what happens
     * when a payment is paid. The payment is specified as
     * a hash instead, and the signer is also given.
     */
    function _paid(PaidData memory paidData) internal override {
        // First, check the nonce.
        bytes32 paymentId = paidData.payment.paymentId;
        require(!previousPayments[paymentId], "RealWorldPaymentsPlugin: payment already processed");
        previousPayments[paymentId] = true;
        // the payment's .to address must be nonzero.
        address to = paidData.payment.to;
        require(
            to != address(0),
            "RealWorldPaymentsPlugin: the target address must not be zero"
        );
        uint256[] memory rewardIds = paidData.payment.rewardIds;
        uint256[] memory rewardValues = paidData.payment.rewardValues;
        // Then, require rewardAddress to be address(0) if, and only if,
        // the reward ids is a non-empty list.
        require(
            rewardIds.length == rewardValues.length,
            "RealWorldPaymentsPlugin: reward token ids and amounts length mismatch"
        );
        address brandId = paidData.payment.brandId;
        require(
            brandId == address(0) || IBrandRegistry(IMetaverse(metaverse).brandRegistry()).isBrandAllowed(
                brandId, BRAND_SIGN_PAYMENTS, paidData.signer
            ),
            "RealWorldPaymentsPlugin: a brand is given for the payment, but the signer is not allowed to sign into it"
        );
        // Now, the payment is checked. Everything there is checked.
        // The next thing to do is to check whether there is a committed
        // brand selected in the payment.
        bool committed = IBrandRegistry(IMetaverse(metaverse).brandRegistry()).isCommitted(brandId);
        if (committed) {
            if (paidData.matic != 0) {
                _sendNative(paidData.matic, 1000000, to, "the target address");
            } else if (paidData.ids.length > 0) {
                uint256[] memory amounts = new uint256[](paidData.ids.length);
                _sendTokens(paidData.ids, paidData.values, 1000000, to, amounts);
            }
        } else {
            uint256 length = paidData.ids.length;
            (uint256 receiverFee, uint256 agentFee, address agent) = paymentFee(paidData.signer);
            uint256 fee = receiverFee + agentFee;
            if (paidData.matic != 0) {
                uint256 sentNative = _sendNative(
                    paidData.matic, receiverFee, paymentFeeEarningsReceiver, "the earnings receiver target"
                );
                if (agentFee != 0) {
                    // The agent will be nonzero.
                    sentNative += _sendNative(paidData.matic, agentFee, agent, "the agent address");
                }
                _sendNative(paidData.matic - sentNative, 1000000, to, "the target address");
            } else if (length > 0) {
                uint256[] memory amounts = new uint256[](paidData.ids.length);
                _sendTokens(paidData.ids, paidData.values, receiverFee, paymentFeeEarningsReceiver, amounts);
                if (agentFee != 0) {
                    _sendTokens(paidData.ids, paidData.values, agentFee, agent, amounts);
                }
                _sendTokens(paidData.ids, paidData.values, 1000000, to, amounts);
            }
        }
        if (rewardIds.length != 0) {
            _defundTokens(paidData.signer, rewardIds, rewardValues);
            IEconomy(_economy()).safeBatchTransferFrom(
                address(this), paidData.payer, rewardIds, rewardValues, ""
            );
        }
        // Add the event to track everything.
        emit PaymentComplete(
            paidData.signer, to, paidData.payer, paymentId, paidData.matic,
            paidData.ids, paidData.values, rewardIds, rewardValues
        );
    }

    /**
     * Sends native tokens by using a fractional multiplier.
     */
    function _sendNative(uint256 _value, uint256 _fee, address _to, string memory _text) private returns (uint256) {
        uint256 fraction = _fee == 1000000 ? _value : _value * _fee / 1000000;
        (bool success,) = _to.call{value: fraction}("");
        require(
            success,
            string(abi.encodePacked(
                "RealWorldPaymentsPlugin: error while transferring native to ", _text
            ))
        );
        return fraction;
    }

    /**
     * Sends tokens by using a fractional multiplier.
     */
    function _sendTokens(
        uint256[] memory _ids, uint256[] memory _values, uint256 _fee, address _to, uint256[] memory amounts
    ) private {
        uint256 length = _values.length;
        uint256[] memory fractionalValues = new uint256[](length);
        for(uint256 index = 0; index < length; index++) {
            uint256 amount = _fee == 1000000 ? _values[index] - amounts[index] : _values[index] * _fee / 1000000;
            fractionalValues[index] = amount;
            amounts[index] += amount;
        }
        IEconomy(_economy()).safeBatchTransferFrom(
            address(this), _to, _ids, fractionalValues, ""
        );
    }

    /**
     * This method must be overridden to tell what happens
     * when an account manifests its wish to fund themselves
     * by adding balance of a single token.
     */
    function _funded(address _from, uint256 _id, uint256 _value) internal override {
        _fundToken(_from, _id, _value);
    }

    /**
     * This method must be overridden to tell what happens
     * when an account manifests its wish to fund themselves
     * by adding balance of a single token.
     */
    function _batchFunded(address _from, uint256[] calldata _ids, uint256[] calldata _values) internal override {
        _fundTokens(_from, _ids, _values);
    }
}
