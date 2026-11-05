'use strict';

/**
 * Returns the key-and-value pairs of own enumerable properties.
 *
 * Own enumerable strings are visited before symbols; inherited properties are excluded. Snapshot
 * keys are fixed, deleted properties are skipped and values are read when visited.
 *
 * @type {typeof import('../types/api.js').entries}
 * @param object The input object or value.
 * @returns {ReturnType<typeof import('../types/api.js').entries>} A new array of `[key, value]`
 * pairs in key order, or `[]` for a primitive input.
 * @throws {TypeError} when a required argument is omitted.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.entries(input);        // => [['a', 1], ['b', 2], ['c', 1]]
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#entriesobject
 */
module.exports = require('./internal/collection').entries;
