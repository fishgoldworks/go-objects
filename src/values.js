'use strict';

/**
 * Returns the values of own enumerable string and symbol properties.
 *
 * Own enumerable strings are visited before symbols; inherited properties are excluded. Snapshot
 * keys are fixed, deleted properties are skipped and values are read when visited.
 *
 * @type {typeof import('../types/api.js').values}
 * @param object The input object or value.
 * @returns {ReturnType<typeof import('../types/api.js').values>} A new array of observed values in
 * key order, or `[]` for a primitive input.
 * @throws {TypeError} when a required argument is omitted.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.values(input);         // => [1, 2, 1]
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#valuesobject
 */
module.exports = require('./internal/collection').values;
