// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "@openzeppelin/contracts/utils/Context.sol";

/**
 * These are features to implement a mechanism to emit and
 * pay certain payment orders.
 */
abstract contract OrderPayment is Context {
    /**
     * A payment order, in this trait, will have the minimal needed data.
     * Payment orders may be recurring or not. Each receiver will handle
     * this feature on its own.
     */
    struct PaymentOrder {
        /**
         * Which tokens (ids) are expected for payment.
         */
        uint256[] tokenIds;

        /**
         * Which tokens (amounts) are expected for payment.
         */
        uint256[] tokenAmounts;

        /**
         * The contract that will be notified when the payment
         * is done by an account.
         */
        address receiver;

        /**
         * Whether this order is enabled or not.
         */
        bool enabled;
    }

    /**
     * The next order id.
     */
    uint256 nextOrderIndex;

    /**
     * The currently alive orders.
     */
    mapping(uint256 => PaymentOrder) orders;

    /**
     * Creates the new payment order.
     */
    function _addPaymentOrder(
        address _receiver, uint256[] memory _tokenIds, uint256[] memory _tokenAmounts
    ) internal returns (uint256) {
        require(_receiver != address(0), "OrderPayment: the receiver must not be 0");
        require(
            _tokenIds.length == _tokenAmounts.length && _tokenIds.length != 0,
            "OrderPayment: empty token data or mismatching lengths"
        );
        for(uint256 idx = 0; idx < _tokenIds.length; idx++) {
            require(_tokenAmounts[idx] != 0, "OrderPayment: zero amounts are not allowed");
        }
        uint256 orderId = uint256(keccak256(abi.encodePacked(address(this), _receiver, nextOrderIndex)));
        orders[orderId] = PaymentOrder({
            tokenIds: _tokenIds, tokenAmounts: _tokenAmounts, receiver: _receiver, enabled: true
        });
        nextOrderIndex += 1;
        return orderId;
    }

    /**
     * Requires an order to exist.
     */
    function _requireExistingOrder(uint256 _orderId) private {
        require(orders[_orderId].receiver != address(0), "OrderPayment: invalid payment order id");
    }

    /**
     * Removes an order.
     */
    function _removePaymentOrder(uint256 _orderId) internal {
        _requireExistingOrder(_orderId);
        delete orders[_orderId];
    }

    /**
     * Enables or disables an order.
     */
    function _togglePaymentOrder(uint256 _orderId, bool _enabled) internal {
        _requireExistingOrder(_orderId);
        orders[_orderId].enabled = _enabled;
    }

    /**
     * Implements an order payment. The sender will be the operator, and
     * the _from will be the token(s) owner.
     */
    function _pay(
        uint256 _orderId, address _from, address _to, uint256[] storage _tokenIds, uint256[] storage _tokenAmounts
    ) internal virtual;

    /**
     * Pays an order. The sender will be the operator itself, and the _from
     * argument will have the token(s) owner.
     */
    function payOrder(address _from, uint256 _orderId) external {
        _requireExistingOrder(_orderId);
        require(orders[_orderId].enabled, "OrderPayment: the order must be enabled");
        _pay(_orderId, _from, orders[_orderId].receiver, orders[_orderId].tokenIds, orders[_orderId].tokenAmounts);
    }
}
