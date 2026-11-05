'use strict';

/**
 * Creates a record containing requested own enumerable keys.
 *
 * The key list contains literal keys, not paths. Duplicate keys do not create duplicate result
 * properties. Requested keys are processed in list order, including duplicates. Each requested
 * property is checked when reached; properties added by earlier getters can therefore be selected.
 *
 * @type {typeof import('../types/api.js').pick}
 * @param object The input object or value.
 * @param keys An actual array of literal keys, not paths; invalid keys throw.
 * @returns {ReturnType<typeof import('../types/api.js').pick>} A new record of requested properties
 * that were present.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for an invalid key list.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.pick(input, ['b']);    // => { b: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#pickobject-keys
 */
module.exports = require('./internal/collection').pick;
