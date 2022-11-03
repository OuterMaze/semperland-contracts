// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "../base/MetaversePlugin.sol";

/**
 * This trait implements ways to manage the elements that involve
 * the fee charging in the plug-in. Both the fees and agents are
 * defined here.
 */
abstract contract RealWorldPaymentsFeesMixin is MetaversePlugin {
    /**
     * This is a maximum payment fee. The fee is expressed
     * as units per 10000 and will not, typically, equals
     * to 300 (3%) in this global setting. This limit is a
     * promise: The current fee may be lower than this one
     * but may never be greater than this one.
     */
    uint256 public paymentFeeLimit;

    /**
     * This is the default amount for the payment fee, for
     * when a custom fee is not specified for a given PoS.
     * This fee is mutable, but can never exceed the limit
     * or be below 10 (1%).
     */
    uint256 public paymentFeeDefaultAmount;

    /**
     * This is the address that will collect the earnings
     * arising from payment fees.
     */
    address public paymentFeeEarningsReceiver;

    /**
     * This is the agent details, describing a current or
     * former agent that promotes the platform.
     */
    struct Agent {
        /**
         * The fee fraction is expressed in units per 1000
         * and tells how much of the effective fee is earned
         * by the agent (also, 1000 - feeFraction is how
         * much of the effective fee is earned by the global
         * fee earnings receiver, also expressed in units per
         * 1000).
         *
         * The fee fraction will never be zero for existing
         * records. This means, that no promoter can have a
         * fee fraction of zero. This value will always be
         * between 1 and 999 (both inclusive) for existing
         * records, and 0 for non-existing records.
         */
        uint256 feeFraction;

        /**
         * Whether new PoSs can choose this agent still for
         * themselves (this does not affect agent settings
         * that are currently set for the PoSs, nor the
         * ability to get fee fraction from them - just the
         * ability to be [new] promoters being set to other
         * PoSs).
         */
        bool active;
    }

    /**
     * The agents are stored here. Each agent has a nonzero
     * share (literally 1 / 1000 to 999 / 100) of whatever
     * fees are meant to be collected from a PoS they promote.
     */
    mapping(address => Agent) agents;

    /**
     * This permission allows an account to manage every setting that
     * happens in this plug-in: global default fees, and fee receiver.
     */
    bytes32 constant METAVERSE_MANAGE_FEE_SETTINGS = keccak256("Plugins::RealWorldPayments::Fee::Manage");

    /**
     * This permission allows an account to manage the agents (who are
     * allowed to promote this service and grant promotional fees, and
     * also will have a custom revenue fraction from each fee that is
     * paid related to PoSs promoted by them).
     */
    bytes32 constant METAVERSE_MANAGE_AGENT_SETTINGS = keccak256("Plugins::RealWorldPayments::Agents::Manage");

    constructor(address _metaverse, uint256 _paymentFeeLimit, address _paymentFeeEarningsReceiver)
        MetaversePlugin(_metaverse)
    {
        require(_paymentFeeEarningsReceiver != address(0), "RealWorldPaymentsPlugin: invalid receiver address");
        require(_paymentFeeLimit <= 100 && _paymentFeeLimit >= 10, "RealWorldPaymentsPlugin: invalid payment fee");
        paymentFeeLimit = _paymentFeeLimit;
        paymentFeeDefaultAmount = _paymentFeeLimit;
        paymentFeeEarningsReceiver = _paymentFeeEarningsReceiver;
    }

    /**
     * This event is triggered when the default payment fee amount is updated.
     */
    event PaymentFeeDefaultAmountUpdated(address indexed updatedBy, uint256 paymentFeeDefaultAmount);

    /**
     * Updates the default payment fee amount (this one applies for every
     * PoS that does not have its own agent).
     */
    function setPaymentFeeDefaultAmount(uint256 _paymentFeeDefaultAmount)
        external onlyMetaverseAllowed(METAVERSE_MANAGE_FEE_SETTINGS)
    {
        require(
            _paymentFeeDefaultAmount >= 1 && _paymentFeeDefaultAmount <= paymentFeeLimit,
            "RealWorldPaymentsPlugin: the default payment fee must be between 1 / 1000 and the payment fee limit"
        );
        paymentFeeDefaultAmount = _paymentFeeDefaultAmount;
        emit PaymentFeeDefaultAmountUpdated(_msgSender(), _paymentFeeDefaultAmount);
    }

    /**
     * This event is triggered when the default payment fee amount is updated.
     */
    event PaymentFeeEarningsReceiverUpdated(address indexed updatedBy, address newReceiver);

    /**
     * Set the new fee earnings receiver.
     */
    function setPaymentFeeEarningsReceiver(address _newReceiver) public
        onlyMetaverseAllowed(METAVERSE_MANAGE_FEE_SETTINGS)
    {
        require(
            _newReceiver != address(0),
            "RealWorldPaymentsPlugin: the fee earnings receiver must not be the 0 address"
        );
        paymentFeeEarningsReceiver = _newReceiver;
        emit PaymentFeeEarningsReceiverUpdated(_msgSender(), _newReceiver);
    }

    /**
     * The payment fee is derived from:
     * - min(agent's fee, default amount) if it has an agent.
     * - default amount otherwise.
     * Two fees are returned actually: the sub-fee for the
     * fee receiver, and the sub-fee for the agent. Both fees
     * are expressed in per-thousand units. It also returns
     * the agent of the PoS if-and-only-if the agent fee is
     * nonzero.
     */
    function paymentFee(address posAddress) public view returns (uint256, uint256, address) {
        // TODO implement properly.
        return (paymentFeeDefaultAmount * 1000, 0, address(0));
    }
}
