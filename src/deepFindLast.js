'use strict';

/**
 * Returns the last matching value during depth-first traversal.
 *
 * Runs callbacks in forward pre-order and retains the last match. Shared/circular containers expand
 * once; the root is excluded. Traversal boundaries retain their property-edge semantics. Traversal
 * is pre-order depth-first, visits own enumerable string/symbol properties and expands only
 * arrays/plain records below the root. See deep traversal rules.
 *
 * @type {typeof import('../types/api.js').deepFindLast}
 * @param object The input root whose own enumerable properties are traversed.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
 * to `undefined`.
 * @returns {ReturnType<typeof import('../types/api.js').deepFindLast>} The matching value, or
 * `undefined` when no property matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for invalid options, depths or descent callbacks.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.deepFindLast(input, v => typeof v === 'number');   // => 2
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepfindlastobject-valueorpredicate-options
 */
module.exports = require('./internal/deep').deepFindLast;
