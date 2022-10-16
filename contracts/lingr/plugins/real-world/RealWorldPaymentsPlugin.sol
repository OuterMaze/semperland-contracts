// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "../../IMetaverse.sol";
import "../../economy/IEconomy.sol";
import "../base/MetaversePlugin.sol";
import "./RealWorldPaymentsRewardAddressBoxesMixin.sol";
import "./RealWorldPaymentsReceptionMixin.sol";

/**
 * This plug-in enables people to do real-world payments.
 * These payments are generated off-chain, and typically
 * the parties interact face to face (but they also might
 * interact via an external website or another medium not
 * integrated with the blockchain itself).
 */
contract RealWorldPaymentsPlugin is
    MetaversePlugin, RealWorldPaymentsRewardAddressBoxesMixin, RealWorldPaymentsReceptionMixin  {
    /**
     * This is a global payment fee. The fee is expressed
     * as units per 10000 and will not, typically, exceed
     * 300 (3%) in this global setting.
     */
    uint256 public paymentFee;

    /**
     * This is the address that will collect the earnings
     * arising from payment fees.
     */
    address public paymentFeeEarningsReceiver;

    /**
     * This is the tracking of previous payments already
     * being processed in our payment system. This is done
     * to avoid the double payment of an invoice.
     */
    mapping(bytes32 => bool) previousPayments;

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
        address _metaverse, uint256 _paymentFee, address _paymentFeeEarningsReceiver,
        address[] memory _verifiers
    ) MetaversePlugin(_metaverse) RealWorldPaymentsSignaturesMixin(_verifiers) {
        paymentFee = _paymentFee;
        paymentFeeEarningsReceiver = _paymentFeeEarningsReceiver;
    }

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
        override(MetaversePlugin, SignatureVerifier) returns (bool) {
        return MetaversePlugin.supportsInterface(_interfaceId) || SignatureVerifier.supportsInterface(_interfaceId);
    }

    /**
     * Returns the contract being used as ERC1155 source of truth.
     */
    function _economy() internal
        override(RealWorldPaymentsRewardAddressBoxesMixin, RealWorldPaymentsReceptionMixin) view returns (address) {
        return IMetaverse(metaverse).economy();
    }

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
        address rewardAddress = paidData.payment.rewardAddress;
        require(
            (rewardAddress == address(0)) == (rewardIds.length == 0),
            "RealWorldPaymentsPlugin: either the reward address is nonzero, or there are rewards (but not both)"
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
                (bool success,) = to.call{value: paidData.matic}("");
                require(success, "RealWorldPaymentsPlugin: error while transferring native to the target address");
            } else if (paidData.ids.length > 0) {
                IEconomy(_economy()).safeBatchTransferFrom(
                    address(this), to, paidData.ids, paidData.values, ""
                );
            }
        } else {
            uint256 length = paidData.ids.length;
            if (paidData.matic != 0) {
                (bool success,) = to.call{value: paidData.matic * (1000 - paymentFee) / 1000}("");
                require(success, "RealWorldPaymentsPlugin: error while transferring native to the target address");
                (success,) = paymentFeeEarningsReceiver.call{value: paidData.matic * (paymentFee / 1000)}("");
                require(
                    success,
                    "RealWorldPaymentsPlugin: error while transferring native to the earnings receiver address"
                );
            } else if (length > 0) {

                uint256[] memory feeValues = new uint256[](length);
                uint256[] memory remainingValues = new uint256[](length);
                for(uint256 index = 0; index < length; index++) {
                    feeValues[index] = paidData.values[index] * paymentFee / 1000;
                    remainingValues[index] = paidData.values[index] - feeValues[index];
                }
                IEconomy(_economy()).safeBatchTransferFrom(
                    address(this), to, paidData.ids, remainingValues, ""
                );
                IEconomy(_economy()).safeBatchTransferFrom(
                    address(this), paymentFeeEarningsReceiver, paidData.ids, feeValues, ""
                );
            }
        }
        if (rewardAddress != address(0)) {
            _defundTokens(rewardAddress, rewardIds, rewardValues);
            IEconomy(_economy()).safeBatchTransferFrom(
                address(this), paidData.payer, rewardIds, rewardValues, ""
            );
        }
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
