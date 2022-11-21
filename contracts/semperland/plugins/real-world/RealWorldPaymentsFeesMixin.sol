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
     * This is a PoS sponsorship. This means that an agent
     * is sponsoring (and managing a custom commission) for
     * this PoS.
     */
    struct PoSSponsorship {
        /**
         * The agent that sponsors this PoS. The 0 address
         * means a PoS has no sponsor, and then the default
         * payment fee will take place.
         */
        address agent;

        /**
         * The fee assigned by the agent. This fee will be
         * expressed in units per 1000 and will replace the
         * payment fee default amount if, and only if, this
         * amount is lower. This value will be between 1 and
         * 999.
         */
        uint256 customFee;
    }

    /**
     * The agents are stored here. Each agent has a nonzero
     * share (literally 1 / 1000 to 999 / 100) of whatever
     * fees are meant to be collected from a PoS they promote.
     */
    mapping(address => Agent) public agents;

    /**
     * The PoS sponsorships are stored here.
     */
    mapping(address => PoSSponsorship) public posSponsorships;

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
    event PaymentFeeDefaultAmountUpdated(address indexed updatedBy, uint256 newAmount);

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
     * This event is triggered when an agent is set, along
     * its fraction (1 to 999). If 0 is the specified fee,
     * then the fee is not changed but the agent is disabled.
     * Disabled agents can still earn commissions from PoSs
     * that have it as agent.
     */
    event PaymentFeeAgentUpdated(address indexed updatedBy, address indexed agent, uint256 feeFraction);

    /**
     * Updates an agent (if already set, only updates the fee
     * fraction this agent has). If the fee is 0, then it is
     * not updated, but the agent is disabled. Setting a fee
     * of other value (up to 999) instantiates (if missing)
     * and updates a manager.
     */
    function updatePaymentFeeAgent(address agent, uint256 feeFraction) external
        onlyMetaverseAllowed(METAVERSE_MANAGE_AGENT_SETTINGS)
    {
        require(
            agent != address(0),
            "RealWorldPaymentsPlugin: the agent must not be the zero address"
        );
        require(
            feeFraction <= 999,
            "RealWorldPaymentsPlugin: the fee fraction must be between 1 and 999"
        );
        if (feeFraction != 0) {
            agents[agent] = Agent({active: true, feeFraction: feeFraction});
        } else {
            Agent storage agentEntry = agents[agent];
            if (agentEntry.active) agentEntry.active = false;
        }
        emit PaymentFeeAgentUpdated(_msgSender(), agent, feeFraction);
    }

    /**
     * Sets an agent for the sender (the sender is considered
     * a PoS). The customFee is always reset to the payment
     * fee default amount.
     */
    function setAgent(address agent) external {
        address sender = _msgSender();
        require(
            agent == address(0) || agents[agent].active,
            "RealWorldPaymentsPlugin: the chosen address is not an active agent"
        );
        posSponsorships[sender] = PoSSponsorship({
            agent: agent, customFee: paymentFeeDefaultAmount
        });
    }

    /**
     * Sets a fee for a PoS managed by the sender (agent).
     * This is only allowed if the PoS allows that agent,
     * and the fee must always between 1 per 1000 and the
     * payment fee limit specified on construction.
     */
    function setFee(address posAddress, uint256 customFee) external {
        address sender = _msgSender();
        require(agents[sender].active, "RealWorldPaymentsPlugin: the sender is not an active agent");
        PoSSponsorship storage posSponsorship = posSponsorships[posAddress];
        require(
            posSponsorship.agent == sender,
            "RealWorldPaymentsPlugin: the sender is not an agent of the given PoS"
        );
        require(
            customFee >= 1 && customFee <= paymentFeeLimit,
            "RealWorldPaymentsPlugin: invalid custom fee"
        );
        posSponsorship.customFee = customFee;
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
        PoSSponsorship storage posSponsorship = posSponsorships[posAddress];
        if (posSponsorship.agent == address(0)) {
            return (paymentFeeDefaultAmount * 1000, 0, address(0));
        }

        Agent storage agentEntry = agents[posSponsorship.agent];
        uint256 customFee = posSponsorship.customFee;
        if (paymentFeeDefaultAmount < customFee) {
            customFee = paymentFeeDefaultAmount;
        }
        return (
            customFee * (1000 - agentEntry.feeFraction),
            customFee * agentEntry.feeFraction,
            posSponsorship.agent
        );
    }
}
