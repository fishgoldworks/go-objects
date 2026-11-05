'use strict';
/**
 * Determines whether any own enumerable property matches a value or predicate.
 *
 * Stops callbacks and value reads after the first match; keys are snapshotted before searching. Own
 * enumerable strings are visited before symbols; inherited properties are excluded. Snapshot keys
 * are fixed, deleted properties are skipped and values are read when visited.
 *
 * @type {typeof import('../types/api.js').some}
 * @param object The input object or value.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @returns {ReturnType<typeof import('../types/api.js').some>} `true` when a property matches;
 * otherwise `false`, including for an empty input.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.some(input, 2);        // => true
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#someobject-valueorpredicate
 */
module.exports = require('./internal/collection').some;
