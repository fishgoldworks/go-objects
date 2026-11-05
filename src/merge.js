'use strict';

/**
 * Creates a shallow merged record, with later sources overriding earlier keys.
 *
 * Does not recursively merge nested values or mutate sources. Nested values remain references. Own
 * enumerable strings are visited before symbols; inherited properties are excluded. Snapshot keys
 * are fixed, deleted properties are skipped and values are read when visited.
 *
 * @type {typeof import('../types/api.js').merge}
 * @param object The input object or value.
 * @param others Additional source objects in argument order.
 * @returns {ReturnType<typeof import('../types/api.js').merge>} A new record containing the final
 * value for each supplied own enumerable key.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.merge(input, { a: 9, d: 4 });  // => { a: 9, b: 2, c: 1, d: 4 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#mergeobject-others
 */
module.exports = require('./internal/collection').merge;
