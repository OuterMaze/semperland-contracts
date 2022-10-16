/**
 * Creates a value that is EVM-compatible to block.timestamp.
 * @param date The date to use. If absent, Date.now() will be used.
 * @returns {number} The current timestamp in EVM-compatible format to block.timestamp.
 */
function timestamp(date) {
    date = typeof date === "undefined" ? Date.now() : date;
    return Math.round(date / 1000);
}


module.exports = {
    timestamp: timestamp,
}