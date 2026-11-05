'use strict';
/**
 * Returns the key and observed value of the first own enumerable match.
 *
 * Captures the value during matching without rereading its getter. A pair with `undefined`
 * distinguishes a found value from no match. Own enumerable strings are visited before symbols;
 * inherited properties are excluded. Snapshot keys are fixed, deleted properties are skipped and
 * values are read when visited.
 *
 * @type {typeof import('../types/api.js').findEntry}
 * @param object The input object or value.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @returns {ReturnType<typeof import('../types/api.js').findEntry>} A `[key, observedValue]` pair,
 * or `undefined` when no property matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.findEntry(input, 2);   // => ['b', 2]
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#findentryobject-valueorpredicate
 */
module.exports = require('./internal/collection').findEntry;
