'use strict';

/**
 * Returns the last own enumerable value matching a literal or predicate.
 *
 * Visits keys in reverse order. Use `findEntry` to distinguish a found `undefined` from no match.
 * The complete own-enumerable key list is visited in reverse, so symbols precede strings. Inherited
 * properties are excluded. Snapshot keys are fixed, deleted properties are skipped and values are
 * read when visited.
 *
 * @type {typeof import('../types/api.js').findLast}
 * @param object The input object or value.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @returns {ReturnType<typeof import('../types/api.js').findLast>} The matching value, or
 * `undefined` when no property matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.findLast(input, n => n < 2);   // => 1
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#findlastobject-valueorpredicate
 */
module.exports = require('./internal/collection').findLast;
