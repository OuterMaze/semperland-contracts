const dates = require("../../utils/dates");

const PAY = '0xa81ec8df';
const PAY_BATCH = '0x119e6f29';
const FUND_CALL = '0x0af6ce8500000000000000000000000000000000000000000000000000000000' +
                    '0000000000000000000000000000000000000000000000000000000000000040' +
                    '0000000000000000000000000000000000000000000000000000000000000001' +
                    '0000000000000000000000000000000000000000000000000000000000000000';
const FUND_BATCH_CALL = '0xce3ee61200000000000000000000000000000000000000000000000000000000' +
                          '0000000000000000000000000000000000000000000000000000000000000040' +
                          '0000000000000000000000000000000000000000000000000000000000000001' +
                          '0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Creates a payment order URI, useful to be QR-encoded and passed to the customer so
 * they pay it.
 * @param domain The domain used for the final URI.
 * @param web3 The web3 client to use several EVM utils from.
 * @param dueTime The time, in seconds, this payment order will be valid until.
 * @param posAddress The signer address for this payment. It must be valid / imported
 *   in this web3 client.
 * @param toAddress The target address to send the payment to. It must not be the zero
 *   address (payments cannot be sent to the zero address).
 * @param reference An external reference. A string. Typically, this value will hold
 *   the invoice id in the real world. But must be anything the user desires (typically
 *   a value that will never repeat).
 * @param description A description. A string. It will be used here as well, but it is
 *   only relevant to the customer as a description of their purchase. In blockchain,
 *   this value will not be present.
 * @param brandAddress An optional brand address. It may be the zero address. Only
 *   useful when the brand is committed so they are not charged fee for their sale.
 *   If used, however, the brand must allow the posAddress as a signer for them.
 * @param rewardingAddress If the payment involves a reward, this is the address of
 *   the account that will pay the reward. If there are no reward tokens, this one
 *   must be the zero address.
 * @param rewardIds The list of token ids that will be used for the reward. Typically
 *   only one or two tokens (or most commonly: zero - no reward) will be used in this
 *   place (small businesses don't use this concept at all).
 * @param rewardValues The list of token values that will be used for the reward. They
 *   must match, in length, to the reward token ids.
 * @param rewardSignature The signature, previously generated, of the rewarding address
 *   (perhaps even using a different web3 client & mnemonic), if rewards are used for
 *   this payment. It must be an empty bytes array when no rewards are used.
 * @param paymentMethod The method to use for payment. One out of 3 methods can be used
 *   in this payment orders mechanism: native, token, or tokens.
 * @returns string
 */
async function makePaymentOrderURI(
    domain, web3, dueTime,
    posAddress, toAddress, reference, description, brandAddress,
    rewardIds, rewardValues, rewardingAddress, rewardSignature,
    paymentMethod
) {
    let now = dates.timestamp();
    let dueDate = now + dueTime;
    let paymentId = web3.utils.soliditySha3(
        {type: 'address', value: posAddress},
        {type: 'string', value: reference},
        {type: 'string', value: description},
        {type: 'uint256', value: now}
    );

    // Building the signature out of the general payment data.
    let messageHash = null;
    switch(paymentMethod.type) {
        case 'native':
            messageHash = web3.utils.soliditySha3(
                {type: 'address', value: toAddress},
                {type: 'bytes32', value: paymentId},
                {type: 'uint256', value: dueDate},
                {type: 'address', value: brandAddress},
                {type: 'address', value: rewardingAddress},
                {type: 'uint256', value: paymentMethod.value},
            );
            break;
        case 'token':
            messageHash = web3.utils.soliditySha3(
                {type: 'address', value: toAddress},
                {type: 'bytes32', value: paymentId},
                {type: 'uint256', value: dueDate},
                {type: 'address', value: brandAddress},
                {type: 'address', value: rewardingAddress},
                {type: 'uint256', value: paymentMethod.id},
                {type: 'uint256', value: paymentMethod.value},
            );
            break;
        case 'tokens':
            messageHash = web3.utils.soliditySha3(
                {type: 'address', value: toAddress},
                {type: 'bytes32', value: paymentId},
                {type: 'uint256', value: dueDate},
                {type: 'address', value: brandAddress},
                {type: 'address', value: rewardingAddress},
                {type: 'uint256[]', value: paymentMethod.ids},
                {type: 'uint256[]', value: paymentMethod.values},
            );
            break;
        default:
            throw new Error("Invalid payment method type: " + paymentMethod.type);
    }
    let paymentSignature = await web3.eth.sign(messageHash, posAddress);

    let fullObj = null;
    switch(paymentMethod.type) {
        case 'native':
            fullObj = {
                type: 'native',
                args: {
                    toAddress: toAddress,
                    paymentId: paymentId,
                    dueDate: dueDate,
                    brandAddress: brandAddress,
                    rewardIds: rewardIds,
                    rewardValues: rewardValues,
                    rewardSignature: rewardSignature,
                    paymentSignature: paymentSignature
                },
                value: paymentMethod.value
            }
            break;
        case 'token':
            fullObj = {
                type: 'token',
                args: {
                    id: paymentMethod.id,
                    value: paymentMethod.value,
                    data: web3.eth.abi.encodeParameters(['bytes', 'bytes'], [PAY, web3.eth.abi.encodeParameters(
                        ['address', 'bytes32', 'uint256', 'address', 'uint256[]', 'uint256[]', 'bytes', 'bytes'],
                        [toAddress, paymentId, dueDate, brandAddress, rewardIds, rewardValues, rewardSignature,
                            paymentSignature]
                    )])
                }
            }
            break;
        case 'tokens':
            fullObj = {
                type: 'tokens',
                args: {
                    ids: paymentMethod.ids,
                    values: paymentMethod.values,
                    data: web3.eth.abi.encodeParameters(['bytes', 'bytes'], [PAY_BATCH, web3.eth.abi.encodeParameters(
                        ['address', 'bytes32', 'uint256', 'address', 'uint256[]', 'uint256[]', 'bytes', 'bytes'],
                        [toAddress, paymentId, dueDate, brandAddress, rewardIds, rewardValues, rewardSignature,
                            paymentSignature]
                    )])
                }
            }
            break;
        // Nothing else will occur.
    }

    // the final URI will be: "payto://<domain>/real-world-payments?data={json}"
    return "payto://" + domain + "/real-world-payments?data=" + encodeURIComponent(JSON.stringify(fullObj));
}

/**
 * Parses a payment URI and requires the fields to exist, depending on the payment type.
 * The return value will be an object equal to the one generated when creating the url.
 * @param url The payment URI to parse.
 * @param domain The expected domain in the payment URI.
 * @returns object The object describing the call details to send the payment.
 */
function parsePaymentOrderURI(url, domain) {
    let prefix = "payto://" + domain + "/real-world-payments?data=";
    if (!url.startsWith(prefix)) {
        throw new Error("Invalid url: " + url + ". It does not start with: " + prefix);
    }
    let obj = JSON.parse(decodeURIComponent(domain.substr(prefix.length)));
    switch(obj.type) {
        case 'native':
        case 'token':
        case 'tokens':
            return obj;
        default:
            throw new Error("Invalid payment method type: " + obj.type);
    }
}


module.exports = {
    makePaymentOrderURI: makePaymentOrderURI,
    FUND_CALL: FUND_CALL,
    FUND_BATCH_CALL: FUND_BATCH_CALL
}
