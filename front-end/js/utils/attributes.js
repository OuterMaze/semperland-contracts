/**
 * Gets an attribute of an object.
 * @param obj The main object to get the attribute from.
 * @param path The attribute path to resolve.
 * @returns The object at a deeper level of the main object.
 */
function getAttr(obj, path) {
   let parts = path.split(".");
   while(parts.length && obj !== null && obj !== undefined) {
        obj = obj[parts.shift()];
   }
   return obj;
}


module.exports = {
    getAttr: getAttr
}
