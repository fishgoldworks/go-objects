'use strict';

/**
 * Removes the first own enumerable match in place and returns its previous value.
 *
 * Deletion uses configurability, not writability, and leaves array holes. Visits keys in forward
 * order. Earlier writes and user side effects are not rolled back after errors. Own enumerable
 * strings are visited before symbols; inherited properties are excluded. Snapshot keys are fixed,
 * deleted properties are skipped and values are read when visited.
 *
 * @type {typeof import('../types/api.js').remove}
 * @param object The input object to update in place.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @returns {ReturnType<typeof import('../types/api.js').remove>} The previous matching value, or
 * `undefined` when no property matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} when a matched property is non-configurable and cannot be deleted.
 * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
 * rolled back.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.remove(input, 1);      // => 1
 * input;                         // => { b: 2, c: 1 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#removeobject-valueorpredicate
 */
module.exports = require('./internal/collection').remove;
