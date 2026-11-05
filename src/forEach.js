'use strict';

/**
 * Visits each own enumerable property and returns the original object.
 *
 * Does not itself write to the input; callbacks may do so. Own enumerable strings are visited before
 * symbols; inherited properties are excluded. Snapshot keys are fixed, deleted properties are
 * skipped and values are read when visited.
 *
 * @type {typeof import('../types/api.js').forEach}
 * @param object The input object or value.
 * @param callback Called with `(value, key, object)` and `this` bound to the input. Results are not
 * awaited.
 * @returns {ReturnType<typeof import('../types/api.js').forEach>} The original object; callback
 * results are ignored.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection or required callback.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.forEach(input, () => undefined);   // => { a: 1, b: 2, c: 1 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#foreachobject-callback
 */
module.exports = require('./internal/collection').forEach;
