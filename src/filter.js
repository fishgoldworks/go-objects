'use strict';

/**
 * Creates an object or array retaining properties whose predicate result is truthy.
 *
 * Retained array indexes compact; retained extra enumerable string/symbol properties remain. Own
 * enumerable strings are visited before symbols; inherited properties are excluded. Snapshot keys
 * are fixed, deleted properties are skipped and values are read when visited.
 *
 * @type {typeof import('../types/api.js').filter}
 * @param object The input object or value.
 * @param predicate Called with `(value, key, object)` and `this` bound to the input. Truthy results
 * retain the property.
 * @returns {ReturnType<typeof import('../types/api.js').filter>} A new container of retained values,
 * preserving their references.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection or required callback.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.filter(input, n => n > 1);   // => { b: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#filterobject-predicate
 */
module.exports = require('./internal/collection').filter;
