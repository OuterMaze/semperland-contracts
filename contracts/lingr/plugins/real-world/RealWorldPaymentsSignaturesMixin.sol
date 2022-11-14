// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "../../../signatures/SignatureVerifierHub.sol";

/**
 * This trait has the means to validate the appropriate signatures:
 * - For native payments.
 * - For (tokenId, tokenAmount) payments (typically ERC1155).
 * - For (tokenIds, tokenAmounts) payments (typically ERC1155).
 * It is, actually, a SignatureVerifierHub on its own (this trait
 * does not define, itself, means to manage the list of verifiers).
 */
abstract contract RealWorldPaymentsSignaturesMixin {
    /**
     * Addresses can check for ERC165 comp
     * embeddable library.
     */
    using ERC165Checker for address;

    /**
     * In each case, the signature will have to refer:
     * - The address to pay this payment to.
     * - The payment ID typically refers to an internal code of the payment,
     *   like this: (address pos, invoice id, description, stamp).
     *   - The pos address will match the signer. Used to avoid collisions.
     *   - The invoice id is unique to the PoS (in face: unique to the
     *     underlying company).
     *   - The description of the invoice, which is plain text that humans
     *     consider relevant.
     *   - The stamp is in seconds (e.g. block.timestamp), and recommended
     *     to be related to the due date by some fixed interval.
     *   The payment ID comes from hashing these 4 values and will act
     *   as a nonce so the signature is not used again. It is computed
     *   entirely off-chain.
     * - The due date (typically obtained from block.timestamp in a view,
     *   and adding 600 seconds).
     * - The brand this payment is made for. It must be satisfied that the
     *   brand marks the current signer as a valid signer-on-behalf. This
     *   should only be used (otherwise payments will be correlated) when
     *   the brand is socially committed.
     * - The signer address of the reward to deliver. This will be obtained
     *   later in this comment.
     * - The expected payment from the customer. This will involve one out
     *   of 3 formats:
     *   - MATIC (value).
     *   - Token (id, value).
     *   - Tokens (ids, values).
     *
     * The reward address is obtained by verifying the signature of:
     * - The payment id (same as described above).
     * - The promised reward (ids/values), if any, and the signature of
     *   (payment ID, promised reward). The signer will be the address
     *   that owns the reward tokens that will be delivered.
     *
     * This is all expressed in the following structure (save for the
     * payment, which is given by other means).
     */
    struct PaymentData {
        /**
         * The address that is expecting the payment. This address will
         * belong to the payment.
         */
        address to;

        /**
         * A hash of both the payment id (being itself a hash) and the
         * signer (posAddress) address.
         */
        bytes32 paymentAndSignerAddressHash;

        /**
         * The id of the payment. This one should be a unique hash of the
         * tuple: (PoS address, external ID, concept, stamp), but always
         * computing this externally (off-chain).
         */
        bytes32 paymentId;

        /**
         * The due date of the payment. Past this due date, this payment
         * cannot be attempted and will raise an error when trying. This
         * timestamp is in the same format of `block.timestamp`.
         */
        uint256 dueDate;

        /**
         * This member should be used (otherwise, left address(0)) if the
         * referenced brand is a "committed" one, and allows the signer of
         * this payment as a signer (with special permissions) on it. If
         * the related brand is not "committed", this field should not be
         * used, in favor of anonymity.
         */
        address brandId;

        /**
         * A list of offered rewards (ids here) on payment completion. It
         * may be empty. Always matches in length: rewardValues.
         */
        uint256[] rewardIds;

        /**
         * A list of offered rewards (values here) on payment completion.
         */
        uint256[] rewardValues;

        /**
         * The signature of keccak256(to, paymentId, dueDate, brandId, rewardAddress, ...payment).
         * On match, returns the signer PoS address.
         */
        bytes paymentSignature;
    }

    /**
     * Gets the signer of a real-world payment order, given its signature and
     * all the enumerated data and a single-token payment.
     */
    function _getTokenPaymentSigningAddress(
        // This comes from the onERC1155Received token args.
        uint256 _tokenId, uint256 _tokenAmount,
        // This comes from the onERC1155Received data arg (after abi.decode).
        PaymentData memory _paymentData
    ) internal returns (address) {
        // The hash involves a single token only (not an array) expected
        // from the user.
        bytes32 messageHash = keccak256(abi.encodePacked(
            _paymentData.to, _paymentData.paymentId, _paymentData.dueDate,
            _paymentData.brandId, _paymentData.rewardIds, _paymentData.rewardValues,
            _tokenId, _tokenAmount
        ));
        return ISignatureVerifier(_verifier()).verifySignature(
            messageHash, _paymentData.paymentSignature
        );
    }

    /**
     * Gets the signer of a real-world payment order, given its signature and
     * all the enumerated data and a multiple-token payment.
     */
    function _getBatchTokenPaymentSigningAddress(
        // This comes from the onERC1155BatchReceived token args.
        uint256[] calldata _tokenIds, uint256[] calldata _tokenAmounts,
        // This comes from the onERC1155Received data arg (after abi.decode).
        PaymentData memory _paymentData
    ) internal returns (address) {
        // The hash involves a single token only (not an array) expected
        // from the user.
        bytes32 messageHash = keccak256(abi.encodePacked(
            _paymentData.to, _paymentData.paymentId, _paymentData.dueDate,
            _paymentData.brandId, _paymentData.rewardIds, _paymentData.rewardValues,
            _tokenIds, _tokenAmounts
        ));
        return ISignatureVerifier(_verifier()).verifySignature(
            messageHash, _paymentData.paymentSignature
        );
    }

    /**
     * Gets the signer of a real-world payment order, given its signature and
     * all the enumerated data and a native payment.
     */
    function _getNativePaymentSigningAddress(
        // This comes from the pay() amount argument.
        uint256 _amount,
        PaymentData memory _paymentData
    ) internal returns (address) {
        // The hash involves a single token only (not an array) expected
        // from the user.
        bytes32 messageHash = keccak256(abi.encodePacked(
            _paymentData.to, _paymentData.paymentId, _paymentData.dueDate,
            _paymentData.brandId, _paymentData.rewardIds, _paymentData.rewardValues,
            _amount
        ));
        return ISignatureVerifier(_verifier()).verifySignature(
            messageHash, _paymentData.paymentSignature
        );
    }

    /**
     * The reference to the related signature verifier.
     */
    function _verifier() internal virtual view returns (address);
}
