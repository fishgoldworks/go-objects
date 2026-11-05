'use strict';

/**
 * Creates an object or array by transforming each own enumerable value.
 *
 * Arrays retain length and holes. Values returned by callbacks are stored without awaiting them. Own
 * enumerable strings are visited before symbols; inherited properties are excluded. Snapshot keys
 * are fixed, deleted properties are skipped and values are read when visited.
 *
 * @type {typeof import('../types/api.js').map}
 * @param object The input object or value.
 * @param callback Called with `(value, key, object)` and `this` bound to the input. Results are not
 * awaited.
 * @returns {ReturnType<typeof import('../types/api.js').map>} A new container with the original keys
 * and callback results.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection or required callback.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.map(input, n => n * 2);  // => { a: 2, b: 4, c: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#mapobject-callback
 */
module.exports = require('./internal/collection').map;
