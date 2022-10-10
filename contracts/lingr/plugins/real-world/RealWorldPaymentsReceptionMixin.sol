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
        _paid(p, 0, _ids, _amounts, rIds, rAmounts);
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
        _paid(p, 0, _ids, _values, rIds, rAmounts);
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
        _paid(_paymentIdHash, msg.value, new uint256[](0), new uint256[](0), _rewardTokenIds, _rewardTokenAmounts);
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
     * a hash instead.
     */
    function _paid(
        bytes32 _paymentIdHash, uint256 _nativeAmount, uint256[] memory _ids, uint256[] memory _amounts,
        uint256[] memory _rewardIds, uint256[] memory _rewardAmounts
    ) internal virtual;
}
