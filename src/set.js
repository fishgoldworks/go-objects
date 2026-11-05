'use strict';

/**
 * Sets a value at an own-property path and returns its previous value.
 *
 * Mutates the input. Stores functions and other supplied values as data. Creates missing/`undefined`
 * intermediates, but does not replace `null` or primitive intermediates.
 *
 * @type {typeof import('../types/api.js').set}
 * @param object The input object to update in place.
 * @param path A string, symbol, safe integer or array of those keys. String paths support dot and
 * quoted/numeric bracket syntax.
 * @param value The literal value to store; typed writes must satisfy the selected path.
 * @returns {ReturnType<typeof import('../types/api.js').set>} The previous final value, or
 * `undefined` when the property was absent.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for an invalid path or key; malformed string syntax is rejected with
 * `SyntaxError`.
 * @throws {RangeError} for an empty mutation path; `TypeError` for unsafe path segments, unsupported
 * containers or forbidden writes.
 * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
 * rolled back.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.set(input, 'a.n', 7);  // => 1
 * input;                         // => { a: { n: 7 }, b: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#setobject-path-value
 */
module.exports = require('./internal/path').set;
