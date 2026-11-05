'use strict';

/**
 * Returns entries of the first object that occur in none of the other objects.
 *
 * Compares values by SameValueZero. With no additional objects, still returns a new record. Own
 * enumerable strings are visited before symbols; inherited properties are excluded. Snapshot keys
 * are fixed, deleted properties are skipped and values are read when visited.
 *
 * @type {typeof import('../types/api.js').except}
 * @param object The input object or value.
 * @param others Additional source objects in argument order.
 * @returns {ReturnType<typeof import('../types/api.js').except>} A new record of own enumerable
 * key/value pairs absent from all other inputs.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.except(input, { b: 2 });   // => { a: 1, c: 1 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#exceptobject-others
 */
module.exports = require('./internal/collection').except;
