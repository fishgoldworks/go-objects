'use strict';

/**
 * Creates a record excluding selected own enumerable keys.
 *
 * Excluded getters are not evaluated. Retained getters are read once; reflection can still trigger
 * proxy traps. Own enumerable strings are visited before symbols; inherited properties are excluded.
 * Snapshot keys are fixed, deleted properties are skipped and values are read when visited.
 *
 * @type {typeof import('../types/api.js').omit}
 * @param object The input object or value.
 * @param keys An actual array of literal keys, not paths; invalid keys throw.
 * @returns {ReturnType<typeof import('../types/api.js').omit>} A new record of properties not
 * excluded by the key list.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for an invalid key list.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.omit(input, ['b']);    // => { a: 1, c: 1 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#omitobject-keys
 */
module.exports = require('./internal/collection').omit;
