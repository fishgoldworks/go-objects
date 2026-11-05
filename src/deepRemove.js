'use strict';

/**
 * Removes the first deep match in place and returns its previous value.
 *
 * Deletion uses configurability, not writability, and leaves array holes. Stops at the first match.
 * Replacement objects are not traversed. Earlier writes and user side effects are not rolled back
 * after errors. Traversal is pre-order depth-first, visits own enumerable string/symbol properties
 * and expands only arrays/plain records below the root. See deep traversal rules.
 *
 * @type {typeof import('../types/api.js').deepRemove}
 * @param object The input root whose own enumerable properties are traversed.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
 * to `undefined`.
 * @returns {ReturnType<typeof import('../types/api.js').deepRemove>} The previous matching value, or
 * `undefined` when no property matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for invalid options, depths or descent callbacks.
 * @throws {TypeError} when a matched property is non-configurable and cannot be deleted.
 * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
 * rolled back.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.deepRemove(input, 1);  // => 1
 * input;                         // => { a: {}, b: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepremoveobject-valueorpredicate-options
 */
module.exports = require('./internal/deep').deepRemove;
