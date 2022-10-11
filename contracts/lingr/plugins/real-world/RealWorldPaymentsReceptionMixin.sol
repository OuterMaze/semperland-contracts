// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "./RealWorldPaymentsSignaturesMixin.sol";

/**
 * This trait implements ways to receive a payment from a customer.
 * Once the payment is paid (and the payment is valid), this is
 * reported, and subclasses must implement its behaviour.
 */
abstract contract RealWorldPaymentsReceptionMixin is Context, RealWorldPaymentsSignaturesMixin, IERC1155Receiver {
    /**
     * This structure holds data of a payment notification
     * (after having a valid signature check).
     */
    struct PaidData {
        /**
         * The hash of the payment id.
         */
        bytes32 paymentIdHash;

        /**
         * The amount of matic.
         */
        uint256 matic;

        /**
         * Ids of the ERC1155 tokens used.
         */
        uint256[] ids;

        /**
         * Amounts of the ERC1155 tokens used.
         */
        uint256[] values;

        /**
         * Ids of the ERC1155 reward tokens awarded.
         */
        uint256[] rewardIds;

        /**
         * Amounts of the ERC1155 reward tokens awarded.
         */
        uint256[] rewardValues;

        /**
         * The payer (who owns the tokens).
         */
        address payer;

        /**
         * The payment order signer.
         */
        address signer;
    }
    /**
     * Receives payments consisting of one single ERC1155
     * (non-native) token. The payment id is specified as
     * its hash instead.
     */
    function onERC1155Received(
        address _operator, address _from, uint256 _id, uint256 _value, bytes calldata _data
    ) external returns (bytes4) {
        _requireEconomy(_msgSender());
        (bytes32 p, uint256[] memory rIds, uint256[] memory rAmounts, bytes memory sig) = abi.decode(
            _data, (bytes32, uint256[], uint256[], bytes)
        );
        address signer = _getTokenPaymentSigningAddress(_id, _value, p, rIds, rAmounts, sig);
        require(signer != address(0), "RealWorldPaymentsPlugin: token payment signature verification failed");
        uint256[] memory _ids = new uint256[](1);
        uint256[] memory _amounts = new uint256[](1);
        _ids[0] = _id;
        _amounts[0] = _value;
        PaidData memory paidData = PaidData({
            paymentIdHash: p, matic: 0, ids: _ids, values: _amounts,
            rewardIds: rIds, rewardValues: rAmounts, payer: _from, signer: signer
        });
        _paid(paidData);
        return 0xf23a6e61;
    }

    /**
     * Receives payments consisting of multiple ERC1155
     * (non-native) tokens. The payment id is specified
     * as its hash instead.
     */
    function onERC1155BatchReceived(
        address _operator, address _from, uint256[] calldata _ids, uint256[] calldata _values,
        bytes calldata _data
    ) external returns (bytes4) {
        _requireEconomy(_msgSender());
        (bytes32 p, uint256[] memory rIds, uint256[] memory rAmounts, bytes memory sig) = abi.decode(
            _data, (bytes32, uint256[], uint256[], bytes)
        );
        address signer = _getBatchTokenPaymentSigningAddress(_ids, _values, p, rIds, rAmounts, sig);
        require(signer != address(0), "RealWorldPaymentsPlugin: batch token payment signature verification failed");
        PaidData memory paidData = PaidData({
            paymentIdHash: p, matic: 0, ids: _ids, values: _values, rewardIds: rIds,
            rewardValues: rAmounts, payer: _from, signer: signer
        });
        _paid(paidData);
        return 0xbc197c81;
    }

    /**
     * Receives payments consisting of native tokens.
     */
    function pay(
        bytes32 _paymentIdHash, uint256[] memory _rewardTokenIds, uint256[] memory _rewardTokenAmounts,
        bytes memory _signature
    ) external payable {
        address signer = _getNativePaymentSigningAddress(
            msg.value, _paymentIdHash, _rewardTokenIds, _rewardTokenAmounts, _signature
        );
        require(signer != address(0), "RealWorldPaymentsPlugin: native payment signature verification failed");
        PaidData memory paidData = PaidData({
            paymentIdHash: _paymentIdHash, matic: msg.value, ids: new uint256[](0), values: new uint256[](0),
            rewardIds: _rewardTokenIds, rewardValues: _rewardTokenAmounts, payer: _msgSender(), signer: signer
        });
        _paid(paidData);
    }

    /**
     * This method must be overridden to restrict the execution
     * to the economy system.
     */
    function _requireEconomy(address _sender) private {
        require(_economy() == _sender, "RealWorldPaymentsPlugin: the only allowed sender is the economy system");
    }

    /**
     * Returns the contract being used as ERC1155 source of truth.
     */
    function _economy() internal virtual view returns (address);

    /**
     * This method must be overridden to tell what happens
     * when a payment is paid. The payment is specified as
     * a hash instead, and the signer is also given.
     */
    function _paid(PaidData memory paidData) internal virtual;
}
