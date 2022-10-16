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
        PaymentData payment;

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
         * The payer (who owns the tokens).
         */
        address payer;

        /**
         * The payment order signer.
         */
        address signer;
    }

    /**
     * Parses a data chunk into a payment data record.
     */
    function _parsePaymentData(bytes memory _data) private returns (PaymentData memory) {
        (address to, bytes32 paymentId, uint256 dueDate, address brandId,
         uint256[] memory rewardIds, uint256[] memory rewardValues,
         bytes memory rewardSignature, bytes memory paymentSignature) = abi.decode(
            _data, (address, bytes32, uint256, address, uint256[], uint256[], bytes, bytes)
        );
        return PaymentData({
            to: to, paymentId: paymentId, dueDate: dueDate, brandId: brandId,
            rewardIds: rewardIds, rewardValues: rewardValues,
            rewardSignature: rewardSignature, paymentSignature: paymentSignature
        });
    }

    /**
     * Receives payments consisting of one single ERC1155
     * (non-native) token. The payment id is specified as
     * its hash instead.
     */
    function onERC1155Received(
        address, address _from, uint256 _id, uint256 _value, bytes calldata _data
    ) external returns (bytes4) {
        _requireEconomy(_msgSender());
        (bytes4 selector, bytes memory innerData) = abi.decode(_data, (bytes4, bytes));
        if (selector == bytes4(keccak256("fund(address,uint256[],uint256[],bytes)"))) {
            _funded(_from, _id, _value);
        } else if (selector == bytes4(keccak256("pay(address,uint256[],uint256[],bytes)"))) {
            PaymentData memory paymentData = _parsePaymentData(innerData);
            address signer = _getTokenPaymentSigningAddress(_id, _value, paymentData);
            require(signer != address(0), "RealWorldPaymentsPlugin: token payment signature verification failed");
            uint256[] memory _ids = new uint256[](1);
            uint256[] memory _amounts = new uint256[](1);
            _ids[0] = _id;
            _amounts[0] = _value;
            PaidData memory paidData = PaidData({
            payment: paymentData, matic: 0, ids: _ids, values: _amounts,
            payer: _from, signer: signer
            });
            _paid(paidData);
        } else {
            revert("RealWorldPaymentsPlugin: Unexpected incoming batch-transfer data");
        }
        return 0xf23a6e61;
    }

    /**
     * Receives payments consisting of multiple ERC1155
     * (non-native) tokens. The payment id is specified
     * as its hash instead.
     */
    function onERC1155BatchReceived(
        address, address _from, uint256[] calldata _ids, uint256[] calldata _values,
        bytes calldata _data
    ) external returns (bytes4) {
        _requireEconomy(_msgSender());
        (bytes4 selector, bytes memory innerData) = abi.decode(_data, (bytes4, bytes));
        if (selector == bytes4(keccak256("fund(address,uint256[],uint256[],bytes)"))) {
            _batchFunded(_from, _ids, _values);
        } else if (selector == bytes4(keccak256("pay(address,uint256[],uint256[],bytes)"))) {
            PaymentData memory paymentData = _parsePaymentData(innerData);
            address signer = _getBatchTokenPaymentSigningAddress(_ids, _values, paymentData);
            require(signer != address(0), "RealWorldPaymentsPlugin: batch token payment signature verification failed");
            PaidData memory paidData = PaidData({
            payment: paymentData, matic: 0, ids: _ids, values: _values,
            payer: _from, signer: signer
            });
            _paid(paidData);
        } else {
            revert("RealWorldPaymentsPlugin: Unexpected incoming batch-transfer data");
        }
        return 0xbc197c81;
    }

    /**
     * Receives payments consisting of native tokens.
     */
    function pay(
        address _to, bytes32 _paymentId, uint256 _dueDate, address _brandId,
        uint256[] memory _rewardTokenIds, uint256[] memory _rewardTokenAmounts,
        bytes memory _rewardSignature, bytes memory _paymentSignature
    ) external payable {
        PaymentData memory paymentData = PaymentData({
            to: _to, paymentId: _paymentId, dueDate: _dueDate, brandId: _brandId,
            rewardIds: _rewardTokenIds, rewardValues: _rewardTokenAmounts,
            rewardSignature: _rewardSignature, paymentSignature: _paymentSignature
        });
        address signer = _getNativePaymentSigningAddress(msg.value, paymentData);
        require(signer != address(0), "RealWorldPaymentsPlugin: native payment signature verification failed");
        PaidData memory paidData = PaidData({
            payment: paymentData, matic: msg.value, ids: new uint256[](0), values: new uint256[](0),
            payer: _msgSender(), signer: signer
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

    /**
     * This method must be overridden to tell what happens
     * when an account manifests its wish to fund themselves
     * by adding balance of a single token.
     */
    function _funded(address _from, uint256 _id, uint256 _value) internal virtual;

    /**
     * This method must be overridden to tell what happens
     * when an account manifests its wish to fund themselves
     * by adding balance of a single token.
     */
    function _batchFunded(address _from, uint256[] calldata _ids, uint256[] calldata _values) internal virtual;
}
