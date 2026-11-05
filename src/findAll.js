'use strict';

/**
 * Returns all own enumerable values matching a literal or predicate.
 *
 * Own enumerable strings are visited before symbols; inherited properties are excluded. Snapshot
 * keys are fixed, deleted properties are skipped and values are read when visited.
 *
 * @type {typeof import('../types/api.js').findAll}
 * @param object The input object or value.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @returns {ReturnType<typeof import('../types/api.js').findAll>} A new array of matching values in
 * forward key order, or `[]`.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.findAll(input, 1);     // => [1, 1]
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#findallobject-valueorpredicate
 */
module.exports = require('./internal/collection').findAll;
