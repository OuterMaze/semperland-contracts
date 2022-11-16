const types = require("../../utils/types.js");
const attributes = require("../../utils/attributes.js");
const dates = require("../../utils/dates.js");

/**
 * Makes a delegate byte array. This delegate is a serialization
 * of a signature created on some data (the messageHash should be
 * created based on external data and also the now timestamp).
 * @param web3 The client to sign with.
 * @param signer The address to use for signing. It must be valid
 *   / imported in the web3 client.
 * @param args The call arguments to sign onto. It is recommended for each value
 *   to be {type: "an-abi-type", value: theValue}.
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
 * @returns {Promise<String>} The byte array of the packed delegation.
 */
async function makeDelegate(web3, signer, args, signMethodIndex, signMethods) {
    signMethodIndex = signMethodIndex || 0;
    signMethods = signMethods || [function(m, acc) {
        return web3.eth.sign(m, acc);
    }];
    types.requireType(Function, 'web3.utils.soliditySha3', attributes.getAttr(web3, 'utils.soliditySha3'));
    types.requireAddress('signer', signer);
    types.requireArray(() => {}, 'args', args);
    types.requireUInt16('signMethodIndex', signMethodIndex);
    types.requireArray(types.requireType.bind(null, Function), 'signMethods', signMethods);

    let now = dates.timestamp();
    let messageHash = web3.utils.soliditySha3(
        {type: 'bytes32', value: web3.utils.soliditySha3.apply(null, args)},
        {type: 'uint256', value: now},
    );

    let paymentSubSignature = await (signMethods[signMethodIndex](messageHash, signer));
    return web3.eth.abi.encodeParameters(
        ["address", "uint256", "bytes32", "bytes"], [signer, now, messageHash, web3.eth.abi.encodeParameters(
            ["uint16", "bytes"], [signMethodIndex, paymentSubSignature]
        )]
    );
}

module.exports = {
    makeDelegate: makeDelegate,
    NO_DELEGATE: "0x"
}