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
abstract contract RealWorldPaymentsSignaturesMixin is SignatureVerifierHub {
    /**
     * The only needed thing for this trait to be instantiated
     * is the list of verifiers that will be used for validation.
     */
    constructor(address[] memory _verifiers) SignatureVerifierHub(_verifiers) {}

    /**
     * Gets the signer of a real-world payment order hash, given its signature.
     */
    function _getSigningAddress(bytes32 _computedHash, bytes memory _signature) internal returns (address) {
        return verifySignature(_computedHash, _signature);
    }

    /**
     * Gets the signer of a real-world payment order, given its signature and:
     * - The payment id.
     * - The ids of the tokens given as reward.
     * - The amounts of the tokens given as reward. Same length of the ids.
     * - The id of the token expected as payment.
     * - The amount of the token expected as payment.
     * The off-chain side must build the signature like this:
     * - paymentId = web3.utils.asciiToHex(urandom(32 bytes));
     *   ...
     * - data = web3.utils.soliditySha3(paymentId, tokenId, tokenAmount, rewardTokenIds, rewardTokenAmounts);
     * - sig = await web3.eth.sign(data, address);
     */
    function _getTokenInvoiceSigningAddress(
        // This comes from the onERC1155Received token args.
        uint256 _tokenId, uint256 _tokenAmount,
        // This comes from the onERC1155Received data arg (after abi.decode).
        uint256 _paymentId, uint256[] memory _rewardTokenIds, uint256[] memory _rewardTokenAmounts,
        bytes memory _signature
    ) internal returns (address) {
        // The hash involves a single token only (not an array) expected from the user.
        bytes32 messageHash = keccak256(abi.encodePacked(
            _paymentId, _tokenId, _tokenAmount, _rewardTokenIds, _rewardTokenAmounts
        ));
        return _getSigningAddress(messageHash, _signature);
    }

    /**
     * Gets the signer of a real-world payment order, given its signature and:
     * - The payment id.
     * - The ids of the tokens given as reward.
     * - The amounts of the tokens given as reward. Same length of the ids.
     * - The ids of the tokens expected as payment.
     * - The amounts of the tokens expected as payment. Same length of the ids.
     * The off-chain side must build the signature like this:
     * - paymentId = web3.utils.asciiToHex(urandom(32 bytes));
     *   ...
     * - data = web3.utils.soliditySha3(paymentId, tokenIds, tokenAmounts, rewardTokenIds, rewardTokenAmounts);
     * - sig = await web3.eth.sign(data, address);
     */
    function _getBatchTokenInvoiceSigningAddress(
        // This comes from the onERC1155BatchReceived token args.
        uint256[] calldata _tokenIds, uint256[] calldata _tokenAmounts,
        // This comes from the onERC1155Received data arg (after abi.decode).
        uint256 _paymentId, uint256[] memory _rewardTokenIds, uint256[] memory _rewardTokenAmounts,
        bytes memory _signature
    ) internal returns (address) {
        // The hash involves multiple tokens (an array) expected from the user.
        bytes32 messageHash = keccak256(abi.encodePacked(
            _paymentId, _tokenIds, _tokenAmounts, _rewardTokenIds, _rewardTokenAmounts
        ));
        return _getSigningAddress(messageHash, _signature);
    }

    /**
     * Gets the signer of a real-world payment order, given its signature and:
     * - The payment id.
     * - The ids of the tokens given as reward.
     * - The amounts of the tokens given as reward. Same length of the ids.
     * - The amount of native tokens expected as payment.
     * The off-chain side must build the signature like this:
     * - paymentId = web3.utils.asciiToHex(urandom(32 bytes));
     *   ...
     * - data = web3.utils.soliditySha3(paymentId, amount, rewardTokenIds, rewardTokenAmounts);
     * - sig = await web3.eth.sign(data, address);
     */
    function _getNativeInvoiceSigningAddress(
        // This comes from the pay() amount argument.
        uint256 _amount,
        // This comes from the pay() extra arguments (directly).
        uint256 _paymentId, uint256[] memory _rewardTokenIds, uint256[] memory _rewardTokenAmounts,
        bytes memory _signature
    ) internal returns (address) {
        // The hash involves only the native token expected from the user.
        bytes32 messageHash = keccak256(abi.encodePacked(
            _paymentId, _amount, _rewardTokenIds, _rewardTokenAmounts
        ));
        return _getSigningAddress(messageHash, _signature);
    }
}
