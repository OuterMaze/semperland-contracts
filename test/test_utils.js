const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);

const {
    BN,           // Big Number support
} = require('@openzeppelin/test-helpers');

/**
 * Returns the total gas of a transaction from its response.
 * @param web3 The web3 client to use for gas calculation
 * @param response The response
 * @returns the total gas, as a BN instance
 */
async function txTotalGas(web3, response) {
    let gasUsed = new BN(response.receipt.gasUsed);
    let nativeTx = await web3.eth.getTransaction(response.tx);
    let gasPrice = new BN(nativeTx.gasPrice);
    return gasUsed.mul(gasPrice);
}

/**
 * Makes the string of a revert reason (for require()/revert()
 * methods of throwing).
 * @param message The first message
 * @param reasonGiven The underlying sub-reason given, if any
 * @returns {string} The full reason
 */
function revertReason(message, reasonGiven) {
    return message + " -- Reason given: " + (reasonGiven === undefined ? message : reasonGiven);
}

/**
 * Encodes a string as base64.
 * @param raw The string to encode
 * @returns {string} The encoded string
 */
function btoa(raw) {
    return new Buffer(raw).toString("base64");
}

/**
 * Decodes a string from base64.
 * @param encoded The string to decode
 * @returns {string} The decoded string
 */
function atob(encoded) {
    return new Buffer(encoded, 'base64').toString("ascii");
}

/**
 * Creates a JSON url from a given payload.
 * @param payload The payload to encode
 * @returns {string} The JSON url
 */
function jsonUrl(payload) {
    new Buffer("pija");
    return "data:application/json;base64," + btoa(JSON.stringify(payload));
}


module.exports = { atob, btoa, jsonUrl, revertReason, txTotalGas };