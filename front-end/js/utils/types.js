const Web3 = require('web3');

/**
 * Requires a boolean value.
 * @param value The value to test.
 */
function requireBool(value) {
    if (value !== true && value !== false) {
        throw new TypeError("The value must be of boolean type");
    }
}

/**
 * Requires a string value.
 * @param value The value to test.
 */
function requireString(value) {
    if (typeof value !== "string") {
        throw new TypeError("The value must be of string type");
    }
}

/**
 * Requires an address value.
 * @param value The value to test.
 */
function requireAddress(value) {
    if (!Web3.utils.isAddress(value)) {
        throw new TypeError("The value must be a valid address");
    }
}

/**
 * Requires a bytes value.
 * @param value The value to test.
 */
function requireBytes(value) {
    if (!Web3.utils.isHexStrict(value) && value.substr(2).length % 2 !== 0) {
        throw new TypeError("The value must be in this format: 0x{arbitrary lowercase " +
                            "pairs of digits (a-f/0-9)(a-f/0-9)}");
    }
}

/**
 * Requires a bytes32 value.
 * @param value The value to test.
 */
function requireBytes32(value) {
    if (!Web3.utils.isHexStrict(value) && value.substr(2).length !== 64) {
        throw new TypeError("The value must be in this format: 0x{arbitrary lowercase " +
            "pairs of digits (a-f/0-9)(a-f/0-9)}");
    }
}

function _requireBN(signed, size, value) {
    let lower = signed ?
        (new BN(2)).pow(new BN(size - 1)).neg() :
        new BN(0);
    let upper = signed ?
        (new BN(2)).pow(new BN(size - 1).subn(1)) :
        (new BN(2)).pow(new BN(size).subn(1));
    if (lower.cmp(value) > 0 || upper.cmp(value) < 0) {
        throw new TypeError(
            "The value must be in the range of " + (signed ? "signed" : "unsigned") + " " + size + "bit values"
        );
    }
}

function _requireNumber(signed, size, value) {
    let lower = signed ?
        (-Math.pow(2, size - 1)) :
        0;
    let upper = signed ?
        (Math.pow(2, size - 1) - 1) :
        (Math.pow(2, size) - 1);
    if (lower > value || upper < value) {
        throw new TypeError(
            "The value must be in the range of " + (signed ? "signed" : "unsigned") + " " + size + "bit values"
        );
    }
}

/**
 * Requires an integer value (number, or BN).
 * @param value The value to test.
 * @param signed Whether the value should be signed or not.
 * @param size The size. Allowed values: 8, 16, 32, 64, 128, 160, 256.
 */
function requireInt(signed, size, value) {
    let BN = Web3.utils.BN;
    switch (size) {
        case 8:
        case 16:
        case 32:
            if (Web3.utils.isBN(value)) {
                _requireBN(signed, size, value);
                return;
            } else if (typeof value === "number") {
                _requireNumber(signed, size, value);
                return;
            } else {
                throw new TypeError("The value must be a number or BN instance");
            }
        case 64:
        case 128:
        case 160:
        case 256:
            _requireBN(signed, size, value);
            break;
        default:
            throw new Error("The size must be 8, 16, 32, 64, 128, 160 or 256");
    }
}

/**
 * Requires an array of N specific types.
 * @param values The value to test.
 * @param callbacks The callbacks to test, respectively, each element.
 */
function requireTuple(callbacks, values) {
    if (!(callbacks instanceof Array) || callbacks.length !== values.length) {
        throw new Error("The values must have the same length of the callbacks");
    }
    values.forEach(function (value, index) {
        try {
            callbacks[index](value);
        } catch(e) {
            throw new TypeError("Error on tuple element " + index + ": " + e.message);
        }
    });
}

/**
 * Requires an array value (sub-elements will be validated with a callback).
 * @param values The value to test.
 * @param callback The callback to test each element.
 */
function requireArray(values, callback) {
    values.forEach(function (value, index) {
        try {
            callback(value);
        } catch(e) {
            throw new TypeError("Error on array element " + index + ": " + e.message);
        }
    });
}