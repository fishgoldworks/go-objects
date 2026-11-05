'use strict';

/**
 * Removes all selected own enumerable matches in place and returns their previous values.
 *
 * Deletion uses configurability, not writability, and leaves array holes. Visits keys in forward
 * order. Earlier writes and user side effects are not rolled back after errors. Own enumerable
 * strings are visited before symbols; inherited properties are excluded. Snapshot keys are fixed,
 * deleted properties are skipped and values are read when visited.
 *
 * @type {typeof import('../types/api.js').removeAll}
 * @param object The input object to update in place.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @returns {ReturnType<typeof import('../types/api.js').removeAll>} A new array of previous values
 * in traversal order, or `[]` when nothing matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} when a matched property is non-configurable and cannot be deleted.
 * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
 * rolled back.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.removeAll(input, 1);   // => [1, 1]
 * input;                         // => { b: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#removeallobject-valueorpredicate
 */
module.exports = require('./internal/collection').removeAll;
