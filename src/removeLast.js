'use strict';

/**
 * Removes the last own enumerable match in place and returns its previous value.
 *
 * Deletion uses configurability, not writability, and leaves array holes. Visits keys in reverse
 * order. Earlier writes and user side effects are not rolled back after errors. The complete
 * own-enumerable key list is visited in reverse, so symbols precede strings. Inherited properties
 * are excluded. Snapshot keys are fixed, deleted properties are skipped and values are read when
 * visited.
 *
 * @type {typeof import('../types/api.js').removeLast}
 * @param object The input object to update in place.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @returns {ReturnType<typeof import('../types/api.js').removeLast>} The previous matching value, or
 * `undefined` when no property matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} when a matched property is non-configurable and cannot be deleted.
 * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
 * rolled back.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.removeLast(input, 1);  // => 1
 * input;                         // => { a: 1, b: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#removelastobject-valueorpredicate
 */
module.exports = require('./internal/collection').removeLast;
