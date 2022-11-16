const types = require("../../utils/types.js");
const attributes = require("../../utils/attributes.js");

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
 * @param web3 The web3 client to use several EVM utils from, and sign the payment.
 * @param posAddress The signer address for this payment. It must be valid / imported
 *   in this web3 client.
 * @param now The timestamp this order is being created for. The same will be used when
 *   signing the rewards.
 * @param dueTime The time, in seconds, this payment order will be valid until.
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
 * @param rewardIds The list of token ids that will be used for the reward. Typically
 *   only one or two tokens (or most commonly: zero - no reward) will be used in this
 *   place (small businesses don't use this concept at all).
 * @param rewardValues The list of token values that will be used for the reward. They
 *   must match, in length, to the reward token ids.
 * @param paymentMethod The method to use for payment. One out of 3 methods can be used
 *   in this payment orders mechanism: native, token, or tokens.
 * @param signMethodIndex The method index being used for the signature process.
 *   Typically, this value is 0 and will match, in the other side, with the ECDSA
 *   algorithm (locally: await web3.eth.sign, until this implementation is deprecated
 *   in favor of a new one, quantum-resistant). On absence, this value will be 0.
 *   When ECDSA signing becomes risky, the value 0 should not be used anymore, and the
 *   await web3.eth.sign method should also be avoided, unless the new implementation
 *   reflects the new signing method(s) being used by default (quantum-resistant).
 * @param signMethods The method callbacks being used for the signature process. By default,
 *   an array of [web3.eth.sign] will be used. Be aware of the remarks of the previous
 *   point, which actually apply to this array as well.
 * @returns {Promise<String>} The payment URL.
 */
async function makePaymentOrderURI(
    domain, web3, posAddress, now, dueTime,
    toAddress, reference, description, brandAddress,
    rewardIds, rewardValues, paymentMethod, signMethodIndex,
    signMethods
) {
    types.requireString("domain", domain);
    types.requireType(Function, 'web3.utils.soliditySha3', attributes.getAttr(web3, 'utils.soliditySha3'));
    types.requireAddress('posAddress', posAddress);
    types.requireUInt256('now', now);
    types.requireUInt256('dueTime', dueTime);
    types.requireAddress('toAddress', toAddress);
    types.requireString('reference', reference);
    types.requireString('description', description);
    types.requireAddress('brandAddress', brandAddress);
    types.requireArray(types.requireUInt256, 'rewardIds', rewardIds);
    types.requireArray(types.requireUInt256, 'rewardValues', rewardValues);
    signMethodIndex = signMethodIndex || 0;
    types.requireUInt16('signMethodIndex', signMethodIndex);
    signMethods = signMethods || [function(m, acc) {
        return web3.eth.sign(m, acc);
    }];
    types.requireArray(types.requireType.bind(null, Function), 'signMethods', signMethods);

    let dueDate = now.add(dueTime);
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
            types.requireUInt256('paymentMethod.value', paymentMethod.value);
            messageHash = web3.utils.soliditySha3(
                {type: 'address', value: toAddress},
                {type: 'bytes32', value: paymentId},
                {type: 'uint256', value: dueDate},
                {type: 'address', value: brandAddress},
                {type: 'uint256[]', value: rewardIds},
                {type: 'uint256[]', value: rewardValues},
                {type: 'uint256', value: paymentMethod.value},
            );
            break;
        case 'token':
            types.requireUInt256('paymentMethod.id', paymentMethod.id);
            types.requireUInt256('paymentMethod.value', paymentMethod.value);
            messageHash = web3.utils.soliditySha3(
                {type: 'address', value: toAddress},
                {type: 'bytes32', value: paymentId},
                {type: 'uint256', value: dueDate},
                {type: 'address', value: brandAddress},
                {type: 'uint256[]', value: rewardIds},
                {type: 'uint256[]', value: rewardValues},
                {type: 'uint256', value: paymentMethod.id},
                {type: 'uint256', value: paymentMethod.value},
            );
            break;
        case 'tokens':
            types.requireArray(types.requireUInt256, 'paymentMethod.ids', paymentMethod.ids);
            types.requireArray(types.requireUInt256, 'paymentMethod.values', paymentMethod.values);
            messageHash = web3.utils.soliditySha3(
                {type: 'address', value: toAddress},
                {type: 'bytes32', value: paymentId},
                {type: 'uint256', value: dueDate},
                {type: 'address', value: brandAddress},
                {type: 'uint256[]', value: rewardIds},
                {type: 'uint256[]', value: rewardValues},
                {type: 'uint256[]', value: paymentMethod.ids},
                {type: 'uint256[]', value: paymentMethod.values},
            );
            break;
        default:
            throw new Error("Invalid payment method type: " + paymentMethod.type);
    }
    let paymentSubSignature = await (signMethods[signMethodIndex](messageHash, posAddress));
    let paymentSignature = web3.eth.abi.encodeParameters(['uint16', 'bytes'], [signMethodIndex, paymentSubSignature]);

    let fullObj = {
        type: paymentMethod.type,
        args: {
            toAddress: toAddress,
            payment: {
                posAddress: posAddress,
                reference: reference,
                description: description,
                now: now.toString(),
            },
            dueDate: dueDate.toString(),
            brandAddress: brandAddress,
            rewardIds: rewardIds.map(function(e) { return e.toString(); }),
            rewardValues: rewardValues.map(function(e) { return e.toString(); }),
            paymentSignature: paymentSignature
        }
    };
    switch(paymentMethod.type) {
        case 'native':
            fullObj.value = paymentMethod.value.toString();
            break;
        case 'token':
            fullObj.id = paymentMethod.id.toString();
            fullObj.value = paymentMethod.value.toString();
            break;
        case 'tokens':
            fullObj.ids = paymentMethod.ids.map(function(e) { return e.toString(); });
            fullObj.values = paymentMethod.values.map(function(e) { return e.toString(); });
            break;
        // Nothing else will occur.
    }

    // the final URI will be: "payto://<domain>/real-world-payments?data={json}"
    return "payto://" + domain + "/real-world-payments?data=" + encodeURIComponent(JSON.stringify(fullObj));
}

/**
 * Parses a payment URI and requires the fields to exist, depending on the payment type.
 * The return value will be an object equal to the one generated when creating the url.
 * @param domain The expected domain in the payment URI.
 * @param web3 The web3 client used to parse numbers.
 * @param url The payment URI to parse.
 * @param recoverMethods A list of method callbacks to use. The index of the signing method
 *   will be used to grab one element from this array as well. By default, an array with
 *   a single element [web3.eth.accounts.recover] will be used.
 * @returns object The object describing the payment details.
 */
function parsePaymentOrderURI(domain, web3, url, recoverMethods) {
    recoverMethods = recoverMethods || [function(m, s) {
        return web3.eth.accounts.recover(m, s);
    }];
    let prefix = "payto://" + domain + "/real-world-payments?data=";
    if (!url.startsWith(prefix)) {
        throw new Error("Invalid url: " + url + ". It does not start with: " + prefix);
    }
    let obj = JSON.parse(decodeURIComponent(url.substr(prefix.length)));
    let toBN = function(s) { return new web3.utils.BN(s); };

    types.requireAddress('obj.args.payment.posAddress', attributes.getAttr(obj, 'args.payment.posAddress'));
    types.requireString('obj.args.payment.reference', attributes.getAttr(obj, 'args.payment.reference'));
    types.requireString('obj.args.payment.description', attributes.getAttr(obj, 'args.payment.description'));
    types.requireUIntString('obj.args.payment.now', attributes.getAttr(obj, 'args.payment.now'));
    types.requireAddress('obj.args.toAddress', attributes.getAttr(obj, 'args.toAddress'));
    types.requireUIntString('obj.args.dueDate', attributes.getAttr(obj, 'args.dueDate'));
    types.requireAddress('obj.args.brandAddress', attributes.getAttr(obj, 'args.brandAddress'));
    types.requireArray(
        types.requireUIntString,
        'obj.args.rewardIds', attributes.getAttr(obj, 'args.rewardIds')
    );
    types.requireArray(
        types.requireUIntString,
        'obj.args.rewardValues', attributes.getAttr(obj, 'args.rewardValues')
    );
    if (obj.args.rewardIds.length !== obj.args.rewardValues.length) {
        throw new Error("Reward ids and values length mismatch");
    }
    types.requireBytes('obj.args.paymentSignature', attributes.getAttr(obj, 'args.paymentSignature'));
    obj.args.payment.now = toBN(obj.args.payment.now);
    obj.args.dueDate = toBN(obj.args.dueDate);
    obj.args.rewardIds = obj.args.rewardIds.map(toBN);
    obj.args.rewardValues = obj.args.rewardValues.map(toBN);
    let messageHash;
    let recovered;

    function fullRecover(messageHash, signature) {
        let args = web3.eth.abi.decodeParameters(['uint16', 'bytes'], signature);
        return recoverMethods[args['0']](messageHash, args['1']);
    }

    switch(obj.type) {
        case 'native':
            types.requireUIntString('obj.value', obj.value);
            obj.value = toBN(obj.value);
            messageHash = web3.utils.soliditySha3(
                {type: 'address', value: obj.args.toAddress},
                {type: 'bytes32', value: web3.utils.soliditySha3(
                    {type: 'address', value: obj.args.payment.posAddress},
                    {type: 'string', value: obj.args.payment.reference},
                    {type: 'string', value: obj.args.payment.description},
                    {type: 'uint256', value: obj.args.payment.now}
                 )},
                {type: 'uint256', value: obj.args.dueDate},
                {type: 'address', value: obj.args.brandAddress},
                {type: 'uint256[]', value: obj.args.rewardIds},
                {type: 'uint256[]', value: obj.args.rewardValues},
                {type: 'uint256', value: obj.value},
            );

            recovered = fullRecover(messageHash, obj.args.paymentSignature);
            if (recovered.toLowerCase() !== obj.args.payment.posAddress.toLowerCase()) {
                throw new Error("Signature check failed");
            }
            return obj;
        case 'token':
            types.requireUIntString('obj.id', obj.id);
            types.requireUIntString('obj.value', obj.value);
            obj.id = toBN(obj.id);
            obj.value = toBN(obj.value);
            messageHash = web3.utils.soliditySha3(
                {type: 'address', value: obj.args.toAddress},
                {type: 'bytes32', value: web3.utils.soliditySha3(
                    {type: 'address', value: obj.args.payment.posAddress},
                    {type: 'string', value: obj.args.payment.reference},
                    {type: 'string', value: obj.args.payment.description},
                    {type: 'uint256', value: obj.args.payment.now}
                 )},
                {type: 'uint256', value: obj.args.dueDate},
                {type: 'address', value: obj.args.brandAddress},
                {type: 'uint256[]', value: obj.args.rewardIds},
                {type: 'uint256[]', value: obj.args.rewardValues},
                {type: 'uint256', value: obj.id},
                {type: 'uint256', value: obj.value},
            );

            recovered = fullRecover(messageHash, obj.args.paymentSignature);
            if (recovered.toLowerCase() !== obj.args.payment.posAddress.toLowerCase()) {
                throw new Error("Signature check failed");
            }
            return obj;
        case 'tokens':
            types.requireArray(types.requireUIntString, 'obj.ids', obj.ids);
            types.requireArray(types.requireUIntString, 'obj.values', obj.values);
            if (obj.ids.length !== obj.values.length) {
                throw new Error("Payment ids and values length mismatch");
            }
            obj.ids = obj.ids.map(toBN);
            obj.values = obj.values.map(toBN);
            messageHash = web3.utils.soliditySha3(
                {type: 'address', value: obj.args.toAddress},
                {type: 'bytes32', value: web3.utils.soliditySha3(
                    {type: 'address', value: obj.args.payment.posAddress},
                    {type: 'string', value: obj.args.payment.reference},
                    {type: 'string', value: obj.args.payment.description},
                    {type: 'uint256', value: obj.args.payment.now}
                 )},
                {type: 'uint256', value: obj.args.dueDate},
                {type: 'address', value: obj.args.brandAddress},
                {type: 'uint256[]', value: obj.args.rewardIds},
                {type: 'uint256[]', value: obj.args.rewardValues},
                {type: 'uint256[]', value: obj.ids},
                {type: 'uint256[]', value: obj.values},
            );

            recovered = fullRecover(messageHash, obj.args.paymentSignature);
            if (recovered.toLowerCase() !== obj.args.payment.posAddress.toLowerCase()) {
                throw new Error("Signature check failed");
            }
            return obj;
        default:
            throw new Error("Invalid payment method type: " + obj.type);
    }
}

/**
 * Executes a payment order.
 * @param obj The object from which the transaction will be generated and executed.
 * @param web3 The web3 client to confirm this transaction with.
 * @param address The address (which the web3 object can sign for) to send the transaction.
 * @param erc1155 The address of an ERC1155 contract.
 * @param erc1155ABI The ABI of the ERC1155 contract.
 * @param rwp The address of a Real-World Payments contract.
 * @param rwpABI The ABI of the Real-World Payments contract.
 * @param dryRun If true, then the transaction will not be executed and, instead of a
 *   transaction object, an integer will be returned: the estimated gas cost.address
 * @param gas An object {[amount], [price]} detailing the gas to pay.
 * @param signer An address which may be different to the address from where the
 *   funds can come from. Only meaningful for the IERC-1155 calls.
 * @returns Promise<object|number> The resulting transaction or gas amount (depends on dryRun).
 */
async function executePaymentOrderConfirmationCall(
    obj, web3, address, erc1155, erc1155ABI, rwp, rwpABI, dryRun, gas, signer
) {
    let paymentId = web3.utils.soliditySha3(
        {type: 'address', value: obj.args.payment.posAddress},
        {type: 'string', value: obj.args.payment.reference},
        {type: 'string', value: obj.args.payment.description},
        {type: 'uint256', value: obj.args.payment.now}
    );
    let paymentAndSignerAddressHash = web3.utils.soliditySha3(
        {type: 'bytes32', value: paymentId},
        {type: 'address', value: obj.args.payment.posAddress},
    );
    let method = null;
    let sendArgs = null;
    signer = signer || address;

    switch(obj.type) {
        case 'native':
            method = new web3.eth.Contract(rwpABI, rwp).methods.pay(
                obj.args.toAddress, paymentId, obj.args.dueDate, obj.args.brandAddress,
                obj.args.rewardIds, obj.args.rewardValues, obj.args.paymentSignature,
                paymentAndSignerAddressHash
            );
            sendArgs = {from: signer, value: obj.value};
            break;
        case 'token':
            method = new web3.eth.Contract(erc1155ABI, erc1155).methods.safeTransferFrom(
                address, rwp, obj.id, obj.value, web3.eth.abi.encodeParameters(
                    ['bytes4', 'bytes'], [PAY, web3.eth.abi.encodeParameters(
                        ['address', 'bytes32', 'uint256', 'address', 'uint256[]', 'uint256[]', 'bytes', 'bytes32'],
                        [obj.args.toAddress, paymentId, obj.args.dueDate, obj.args.brandAddress,
                         obj.args.rewardIds, obj.args.rewardValues, obj.args.paymentSignature,
                         paymentAndSignerAddressHash]
                    )]
                )
            );
            sendArgs = {from: signer};
            break;
        case 'tokens':
            method = new web3.eth.Contract(erc1155ABI, erc1155).methods.safeBatchTransferFrom(
                address, rwp, obj.ids, obj.values, web3.eth.abi.encodeParameters(
                    ['bytes4', 'bytes'], [PAY_BATCH, web3.eth.abi.encodeParameters(
                        ['address', 'bytes32', 'uint256', 'address', 'uint256[]', 'uint256[]', 'bytes', 'bytes32'],
                        [obj.args.toAddress, paymentId, obj.args.dueDate, obj.args.brandAddress,
                         obj.args.rewardIds, obj.args.rewardValues, obj.args.paymentSignature,
                         paymentAndSignerAddressHash]
                    )]
                )
            );
            sendArgs = {from: signer};
            break;
        default:
            throw new Error("Invalid payment method type: " + obj.type);
    }
    if (dryRun) {
        return await method.estimateGas(sendArgs);
    } else {
        gas = gas || {};
        if (gas.amount) sendArgs.gas = gas.amount;
        if (gas.price) sendArgs.gasPrice = gas.price;
        return await method.send(sendArgs);
    }
}


module.exports = {
    makePaymentOrderURI: makePaymentOrderURI,
    parsePaymentOrderURI: parsePaymentOrderURI,
    executePaymentOrderConfirmationCall: executePaymentOrderConfirmationCall,
    FUND_CALL: FUND_CALL,
    FUND_BATCH_CALL: FUND_BATCH_CALL
}
