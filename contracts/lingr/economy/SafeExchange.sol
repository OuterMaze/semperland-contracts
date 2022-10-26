// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * These are features to implement a safe exchange in another
 * contract inheriting this one.
 */
abstract contract SafeExchange is Context {
    /**
     * The deals subsystem has deals, and each deal has a state,
     * either rejected or ongoing. The "broken" state is a catch-all
     * state for when the deal is cancelled / rejected by any party.
     */
    enum DealState { CREATED, ACCEPTED }

    /**
     * This event is raised when a new deal is created.
     */
    event DealStarted(uint256 indexed dealId, address indexed emitter, address indexed receiver);

    /**
     * This event is raised when a deal is accepted by the receiver.
     */
    event DealAccepted(uint256 indexed dealId, address indexed emitter, address indexed receiver);

    /**
     * This event is raised when a deal is confirmed by its creator,
     * after the receiver's acceptance.
     */
    event DealConfirmed(uint256 indexed dealId, address indexed emitter, address indexed receiver);

    /**
     * This event is raised when a deal is broken by its emitter, the
     * receiver, or an operator on behalf of any of them.
     */
    event DealBroken(uint256 indexed dealId, address indexed breaker);

    /**
     * Each deal knows what is being exchanged, the current state,
     * and who are the involved parties.
     */
    struct Deal {
        address emitter;
        address receiver;
        uint256[] emitterTokenIds;
        uint256[] emitterTokenAmounts;
        uint256[] receiverTokenIds;
        uint256[] receiverTokenAmounts;
        DealState state;
    }

    // The current deal index.
    uint256 private currentDealIndex = 0;

    /**
     * All the ACTIVE / PENDING deals instantiated so far.
     */
    mapping(uint256 => Deal) public deals;

    /**
     * Starting a deal requires the sender to be the _emitter address
     * or an address the sender can operate on their behalf. Also, the
     * objects data must be non-empty, and no element must be 0.
     */
    function dealStart(
        address _emitter, address _receiver, uint256[] memory _tokenIds, uint256[] memory _tokenAmounts
    ) public {
        require(
            _emitter != address(0) && _receiver != address(0),
            "SafeExchange: transfer from/to the zero address"
        );
        require(
            _emitter == _msgSender() || _isApproved(_emitter, _msgSender()),
            "SafeExchange: caller is not emitter nor approved"
        );
        require(
            _tokenIds.length == _tokenAmounts.length && _tokenIds.length != 0,
            "SafeExchange: token ids and amounts length mismatch or 0"
        );
        for(uint256 index = 0; index < _tokenAmounts.length; index++) {
            require(
                _tokenAmounts[index] != 0,
                string(abi.encodePacked(
                    "SafeExchange: token in position ", Strings.toString(index), " must not have amount of 0"
                ))
            );
        }

        // Increment the deal counter and create the new instance.
        currentDealIndex += 1;
        deals[currentDealIndex] = Deal({
            emitter: _emitter, receiver: _receiver, emitterTokenIds: _tokenIds, emitterTokenAmounts: _tokenAmounts,
            state: DealState.CREATED, receiverTokenIds: new uint256[](0), receiverTokenAmounts: new uint256[](0)
        });
        // Then, emit the event.
        emit DealStarted(currentDealIndex, _emitter, _receiver);
    }

    /**
     * Accepting a deal requires the deal to be valid, the sender to
     * be the deal receiver (or an allowed operator of the deal receiver),
     * and the deal to be in the appropriate state. Also, the objects data
     * must be non-empty and no element must be 0.
     */
    function dealAccept(uint256 _dealIndex, uint256[] memory _tokenIds, uint256[] memory _tokenAmounts) public
    {
        Deal storage deal = deals[_dealIndex];
        address receiver = deal.receiver;
        require(
            receiver != address(0),
            "SafeExchange: invalid deal"
        );
        require(
            receiver == _msgSender() || _isApproved(receiver, _msgSender()),
            "SafeExchange: caller is not receiver nor approved"
        );
        require(
            _tokenIds.length == _tokenAmounts.length && _tokenIds.length != 0,
            "SafeExchange: token ids and amounts length mismatch or 0"
        );
        DealState state = deal.state;
        require(
            state == DealState.CREATED,
            "SafeExchange: deal is not in just-created state"
        );
        for(uint256 index = 0; index < _tokenAmounts.length; index++) {
            require(
                _tokenAmounts[index] != 0,
                string(abi.encodePacked(
                    "SafeExchange: token in position ", Strings.toString(index), " must not have amount of 0"
                ))
            );
        }

        // Set the receiver acceptance and offer.
        deal.state = DealState.ACCEPTED;
        deal.receiverTokenIds = _tokenIds;
        deal.receiverTokenAmounts = _tokenAmounts;
        // Then, emit the event.
        emit DealAccepted(_dealIndex, deal.emitter, receiver);
    }

    /**
     * Confirming a deal requires the deal to be valid, the sender to
     * be the deal emitter (or an allowed operator of the deal emitter),
     * and the deal to be in the appropriate state.
     */
    function dealConfirm(uint256 _dealIndex) public
    {
        Deal storage deal = deals[_dealIndex];
        address emitter = deal.emitter;
        require(
            emitter != address(0),
            "SafeExchange: invalid deal"
        );
        require(
            emitter == _msgSender() || _isApproved(emitter, _msgSender()),
            "SafeExchange: caller is not emitter nor approved"
        );
        DealState state = deal.state;
        require(
            state == DealState.ACCEPTED,
            "SafeExchange: deal is not in just-accepted state"
        );

        // Do the exchange. This exchange might fail (it will when the elements
        // are not present in the required amounts in both accounts).
        _batchTransfer(
            _dealIndex, deal.emitter, deal.receiver, deal.emitterTokenIds, deal.emitterTokenAmounts
        );
        _batchTransfer(
            _dealIndex, deal.receiver, deal.emitter, deal.receiverTokenIds, deal.receiverTokenAmounts
        );
        // Now, trigger the event and clear the deal.
        emit DealConfirmed(_dealIndex, deal.emitter, deal.receiver);
        delete deals[_dealIndex];
    }

    /**
     * Breaking a deal requires the deal to be valid, the sender to be
     * the emitter (or approved) or the receiver (or approved).
     */
    function dealBreak(uint256 _dealIndex) public
    {
        Deal storage deal = deals[_dealIndex];
        address emitter = deal.emitter;
        address receiver = deal.receiver;
        address sender = _msgSender();
        require(
            emitter != address(0),
            "SafeExchange: invalid deal"
        );
        require(
            emitter == sender || _isApproved(emitter, sender) ||
            receiver == sender || _isApproved(receiver, sender),
            "SafeExchange: caller is not emitter/receiver nor approved"
        );

        // Now, trigger the event and clear the deal.
        emit DealBroken(_dealIndex, sender);
        delete deals[_dealIndex];
    }

    /**
     * Tells whether a sender is approved for a given party
     * to perform this contract's operations on their behalf.
     */
    function _isApproved(address _party, address _sender) internal virtual view returns (bool);

    /**
     * Does a batch transfer of the tokens from one party to the other.
     */
    function _batchTransfer(
        uint256 _dealIndex, address _from, address _to, uint256[] memory _tokenIds, uint256[] memory _tokenAmounts
    ) internal virtual;
}
