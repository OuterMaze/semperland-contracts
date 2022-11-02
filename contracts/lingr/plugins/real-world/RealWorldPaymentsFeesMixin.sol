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
     * The agents are stored here. Each agent has a nonzero
     * share (literally 1 / 1000 to 999 / 100) of whatever
     * fees are meant to be collected from a PoS they promote.
     */
    mapping(address => uint256) agents;

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

    // TODO: Methods, permissions and events to set the earnings receiver.
    // TODO: Methods, permissions and events to set promotional fee.

    constructor(address _metaverse, uint256 _paymentFeeLimit, address _paymentFeeEarningsReceiver)
        MetaversePlugin(_metaverse)
    {
        require(_paymentFeeEarningsReceiver != address(0), "RealWorldPaymentsPlugin: Invalid receiver address");
        require(_paymentFeeLimit <= 100 && _paymentFeeLimit >= 10, "RealWorldPaymentsPlugin: Invalid payment fee");
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
            "RealWorldPaymentsPlugin: The default payment fee must be between 1 / 1000 and the payment fee limit"
        );
        paymentFeeDefaultAmount = _paymentFeeDefaultAmount;
        emit PaymentFeeDefaultAmountUpdated(_msgSender(), _paymentFeeDefaultAmount);
    }

    /**
     * The payment fee is derived from:
     * - min(agent's fee, default amount) if it has an agent.
     * - default amount otherwise.
     */
    function paymentFee(address posAddress) public view returns (uint256) {
        // TODO implement properly.
        return paymentFeeDefaultAmount;
    }
}
