const Web3 = require('web3');

/**
 * Requires a boolean value.
 * @param field The name of the field, path or argument to validate.
 * @param value The value to test.
 */
function requireBool(field, value) {
    if (value !== true && value !== false) {
        throw new TypeError(field + ": the value must be of boolean type");
    }
}

/**
 * Requires a string value.
 * @param field The name of the field, path or argument to validate.
 * @param value The value to test.
 */
function requireString(field, value) {
    if (typeof value !== "string") {
        throw new TypeError(field + ": the value must be of string type");
    }
}

/**
 * Requires a string satisfying a regular expression.
 * @param field The name of the field, path or argument to validate.
 * @param rx The regular expression to satisfy.
 * @param hint The human-readable name of the pattern.
 * @param value The value to test.
 */
function requireRx(field, rx, hint, value) {
    requireString(field, value);
    if (!rx.test(value)) {
        throw new TypeError(field + ": the value must satisfy pattern: " + hint);
    }
}

/**
 * Requires a string to be an unsigned integer.
 * @param field The name of the field, path or argument to validate.
 * @param value The value to test.
 */
function requireUIntString(field, value) {
    requireRx(field, /^\d+$/, "unsigned integer", value);
}

/**
 * Requires a string to be an integer.
 * @param field The name of the field, path or argument to validate.
 * @param value The value to test.
 */
function requireIntString(field, value) {
    requireRx(field, /^-?\d+$/, "integer", value);
}

/**
 * Requires an address value.
 * @param field The name of the field, path or argument to validate.
 * @param value The value to test.
 */
function requireAddress(field, value) {
    if (!Web3.utils.isAddress(value)) {
        throw new TypeError(field + ": the value must be a valid address");
    }
}

/**
 * Requires a bytes value.
 * @param field The name of the field, path or argument to validate.
 * @param value The value to test.
 */
function requireBytes(field, value) {
    if (!Web3.utils.isHexStrict(value) && value.substr(2).length % 2 !== 0) {
        throw new TypeError(field + ": the value must be in this format: 0x{arbitrary " +
                            "lowercase pairs of digits (a-f/0-9)(a-f/0-9)}");
    }
}

/**
 * Requires a bytes32 value.
 * @param field The name of the field, path or argument to validate.
 * @param value The value to test.
 */
function requireBytes32(field, value) {
    if (!Web3.utils.isHexStrict(value) && value.substr(2).length !== 64) {
        throw new TypeError(
            field + ": the value must be in this format: 0x{arbitrary lowercase " +
            "pairs of digits (a-f/0-9)(a-f/0-9)}"
        );
    }
}

/**
 * Requires a value of the specified type.
 * @param field The name of the field, path or argument to validate.
 * @param type The type to expect.
 * @param value The value to test.
 */
function requireType(type, field, value) {
    if (!(value instanceof type)) {
        throw new TypeError(
            field + ": the value must be of type " + (type.name || ("<anonymous function: " + type.toString() + ">"))
        )
    }
}

function _requireBN(signed, size, field, value) {
    let BN = Web3.utils.BN;
    let lower = signed ?
        (new BN(2)).pow(new BN(size - 1)).neg() :
        new BN(0);
    let upper = signed ?
        (new BN(2)).pow(new BN(size - 1).subn(1)) :
        (new BN(2)).pow(new BN(size)).subn(1);
    if (lower.cmp(value) > 0 || upper.cmp(value) < 0) {
        throw new TypeError(
            field + ": the value must be in the range of " +
            (signed ? "signed" : "unsigned") + " " + size + "bit values"
        );
    }
}

function _requireNumber(signed, size, field, value) {
    let lower = signed ?
        (-Math.pow(2, size - 1)) :
        0;
    let upper = signed ?
        (Math.pow(2, size - 1) - 1) :
        (Math.pow(2, size) - 1);
    if (lower > value || upper < value) {
        throw new TypeError(
            field + ": the value must be in the range of " +
            (signed ? "signed" : "unsigned") + " " + size + "bit values"
        );
    }
}

/**
 * Requires an integer value (number, or BN).
 * @param value The value to test.
 * @param field The name of the field, path or argument to validate.
 * @param signed Whether the value should be signed or not.
 * @param size The size. Allowed values: 8, 16, 32, 64, 128, 160, 256.
 */
function requireInt(signed, size, field, value) {
    switch (size) {
        case 8:
        case 16:
        case 32:
            if (Web3.utils.isBN(value)) {
                _requireBN(signed, size, field, value);
                return;
            } else if (typeof value === "number") {
                _requireNumber(signed, size, field, value);
                return;
            } else {
                throw new TypeError(field + ": the value must be a number or BN instance");
            }
        case 64:
        case 128:
        case 160:
        case 256:
            if (Web3.utils.isBN(value)) {
                _requireBN(signed, size, field, value);
            } else {
                throw new TypeError(field + ": the value must be a BN instance");
            }
            break;
        default:
            throw new Error(field + ": the size must be 8, 16, 32, 64, 128, 160 or 256");
    }
}

/**
 * Requires an array of N specific types.
 * @param values The value to test.
 * @param field The name of the field, path or argument to validate.
 * @param callbacks The callbacks to test, respectively, each element.
 */
function requireTuple(callbacks, field, values) {
    if (!Array.isArray(callbacks) || !Array.isArray(values) || callbacks.length !== values.length) {
        throw new Error(field + ": the values & callbacks must have the same length of the callbacks");
    }
    values.forEach(function (value, index) {
        try {
            callbacks[index](field + "." + index, value);
        } catch(e) {
            if (e instanceof TypeError) {
                throw e;
            } else {
                throw new TypeError(field + "." + index + ": " + e.message);
            }
        }
    });
}

/**
 * Requires an array value (sub-elements will be validated with a callback).
 * @param values The value to test.
 * @param field The name of the field or argument to validate.
 * @param callback The callback to test each element.
 */
function requireArray(callback, field, values) {
    if (!Array.isArray(values)) {
        throw new TypeError(field + ": the values must be an array");
    }
    values.forEach(function (value, index) {
        try {
            callback(field + "." + index, value);
        } catch(e) {
            if (e instanceof TypeError) {
                throw e;
            } else {
                throw new TypeError(field + "." + index + ": " + e.message);
            }
        }
    });
}


module.exports = {
    requireBool: requireBool,
    requireString: requireString,
    requireRx: requireRx,
    requireUIntString: requireUIntString,
    requireIntString: requireIntString,
    requireAddress: requireAddress,
    requireBytes: requireBytes,
    requireBytes32: requireBytes32,
    requireInt: requireInt,
    requireInt8: requireInt.bind(null, true, 8),
    requireInt16: requireInt.bind(null, true, 16),
    requireInt32: requireInt.bind(null, true, 32),
    requireInt64: requireInt.bind(null, true, 64),
    requireInt128: requireInt.bind(null, true, 128),
    requireInt160: requireInt.bind(null, true, 160),
    requireInt256: requireInt.bind(null, true, 256),
    requireUInt8: requireInt.bind(null, false, 8),
    requireUInt16: requireInt.bind(null, false, 16),
    requireUInt32: requireInt.bind(null, false, 32),
    requireUInt64: requireInt.bind(null, false, 64),
    requireUInt128: requireInt.bind(null, false, 128),
    requireUInt160: requireInt.bind(null, false, 160),
    requireUInt256: requireInt.bind(null, false, 256),
    requireType: requireType,
    requireTuple: requireTuple,
    requireArray: requireArray,
}
