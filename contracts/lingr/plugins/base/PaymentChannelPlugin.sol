// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "./MetaversePlugin.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

/**
 * This plug-in allows defining payment channels (which may
 * be temporary or recurring) which are then paid to trigger
 * some specific logic by the issuer. Payment channels are
 * available in two formats: MATIC only, or ERC1155 tokens.
 */
abstract contract PaymentChannelPlugin is MetaversePlugin, IERC1155Receiver {
    /**
     * Each payment channel specifies the payment requirements
     * and the enablement status. This contract will know how
     * to process and accept incoming payments appropriately
     * so that marketplaces can be defined on top.
     */
    struct PaymentChannel {
        /**
         * This flag will always be true on existing records.
         */
        bool exists;

        /**
         * The token ids. By setting a non-empty array in this
         * value, this channel is an ERC1155-payable one. The
         * values in this array should be distinct and valid,
         * but this is not an enforced / validated condition.
         */
        uint256[] tokenIds;

        /**
         * The token values. This array must have the same
         * length of the tokenIds array, and their elements
         * must not be 0.
         */
        uint256[] tokenAmounts;

        /**
         * The amount of MATIC that must be paid, when token
         * ids are not specified. This value may be 0, even
         * if no ERC1155 token is specified (this means: a
         * payment channel may be actually FREE and, in that
         * case, the channel should be one-shot only).
         */
        uint256 nativeAmount;

        /**
         * Whether this channel is enabled or not. Channels
         * may be temporarily disabled.
         */
        bool enabled;
    }

    /**
     * The id of the operation "pay-channel" to use in the data
     * of a received token(s) transfer accepted by this contract.
     */
    bytes4 constant METHOD_PAY_CHANNEL = bytes4(keccak256("payChannel(uint256,uint256)"));


    /**
     * The existing payment channels.
     */
    mapping(uint256 => PaymentChannel) public paymentChannels;

    /**
     * The next index;
     */
    uint256 private nextPaymentChannelIndex;

    /**
     * Creates a payment channel with the given arguments.
     */
    function _createPaymentChannel(
        uint256[] memory tokenIds, uint256[] memory tokenAmounts, uint256 nativeAmount
    ) internal returns (uint256) {
        require(tokenIds.length == tokenAmounts.length, "PaymentChannelPlugin: token ids and amounts length mismatch");
        require(
            nativeAmount == 0 || tokenIds.length == 0,
            "PaymentChannelPlugin: native amount is not allowed when token ids are specified"
        );
        for(uint256 index = 0; index < tokenAmounts.length; index++) {
            require(tokenAmounts[index] > 0, "PaymentChannelPlugin: token amounts must not contain zero value items");
        }
        uint256 id;
        while(true) {
            id = uint256(keccak256(abi.encodePacked(address(this), msg.sender, nextPaymentChannelIndex)));
            nextPaymentChannelIndex += 1;
            if (!paymentChannels[id].exists) {
                paymentChannels[id] = PaymentChannel({
                    exists: true, enabled: true, tokenIds: tokenIds, tokenAmounts: tokenAmounts,
                    nativeAmount: nativeAmount
                });
                break;
            }
        }
        return id;
    }

    /**
     * Destroys an existing payment channel.
     */
    function _removePaymentChannel(uint256 channelId) internal {
        require(paymentChannels[channelId].exists, "PaymentChannelPlugin: invalid channel id");
        delete paymentChannels[channelId];
    }

    /**
     * Toggles a channel by its id.
     */
    function _togglePaymentChannel(uint256 channelId, bool enabled) internal {
        require(paymentChannels[channelId].exists, "PaymentChannelPlugin: invalid channel id");
        paymentChannels[channelId].enabled = enabled;
    }

    /**
     * Allows any account to pay a specific native channel.
     * Further validations or notifications will be handled
     * in the `paid` method.
     */
    function pay(uint256 channelId, uint256 units) external payable {
        PaymentChannel storage channel = paymentChannels[channelId];
        require(channel.exists, "PaymentChannelPlugin: invalid channel id");
        require(channel.tokenIds.length == 0, "PaymentChannelPlugin: not a native channel");
        require(channel.nativeAmount * units == msg.value, "PaymentChannelPlugin: invalid payment amount");
        _paid(_msgSender(), _msgSender(), channelId, units);
    }

    /**
     * Allows any account to pay a specific token channel.
     * Further validations or notifications will be handled
     * in the `_paid` method.
     */
    function onERC1155Received(
        address operator, address from, uint256 id, uint256 value, bytes calldata data
    ) external onlyEconomy returns (bytes4) {
        uint256[] memory ids = new uint256[](1);
        ids[0] = id;
        uint256[] memory values = new uint256[](1);
        values[0] = value;
        _tokensArrival(operator, from, ids, values, data);
        return 0xf23a6e61;
    }

    /**
     * Allows any account to pay a specific token channel.
     * Further validations or notifications will be handled
     * in the `_paid` method.
     */
    function onERC1155BatchReceived(
        address operator, address from, uint256[] calldata ids, uint256[] calldata values,
        bytes calldata data
    ) external onlyEconomy returns (bytes4) {
        _tokensArrival(operator, from, ids, values, data);
        return 0xbc197c81;
    }

    /**
     * Accepts the tokens only if they come in a ("payChannel(uint256,uint256)", (id, units))
     * data signature. Contracts deriving from this contract must only expect ERC1155 transfer
     * data to come in the encode(method, encode(...params)) format.
     */
    function _tokensArrival(
        address operator, address from, uint256[] memory ids, uint256[] memory values,
        bytes calldata data
    ) private {
        (bytes4 method, bytes memory args) = abi.decode(data, (bytes4, bytes));
        _handleTokensArrival(operator, from, ids, values, method, args);
    }

    /**
     * Handles what happens when tokens arrive to this contract. Children contract must
     * override this method if in the need of new reasons to receive tokens.
     */
    function _handleTokensArrival(
        address operator, address from, uint256[] memory ids, uint256[] memory values,
        bytes4 method, bytes memory args
    ) internal virtual {
        if (method == METHOD_PAY_CHANNEL) {
            (uint256 channelId, uint256 units) = abi.decode(args, (uint256, uint256));
            PaymentChannel storage channel = paymentChannels[channelId];
            require(channel.exists, "PaymentChannelPlugin: invalid channel id");
            uint256 length = channel.tokenIds.length;
            require(length != 0, "PaymentChannelPlugin: not a token channel");
            for(uint256 index; index < length; index++) {
                require(
                    ids[index] == channel.tokenIds[index] && values[index] == units * channel.tokenAmounts[index],
                    "PaymentChannelPlugin: mismatching or invalid payment token entry"
                );
            }
            _paid(operator, from, channelId, units);
            return;
        }
        revert("PaymentChannelPlugin: unknown ERC1155 token reception context");
    }

    /**
     * Handles what happens when a channel is paid.
     */
    function _paid(address operator, address from, uint256 channelId, uint256 units) internal virtual;
}
