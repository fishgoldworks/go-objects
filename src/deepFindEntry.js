'use strict';
/**
 * Returns the path and observed value of the first deep match during depth-first traversal.
 *
 * Captures the independent path and value at the match without rereading the getter. Shared/circular
 * containers expand once; the root is excluded. Traversal boundaries retain their property-edge
 * semantics. Traversal is pre-order depth-first, visits own enumerable string/symbol properties and
 * expands only arrays/plain records below the root. See deep traversal rules.
 *
 * @type {typeof import('../types/api.js').deepFindEntry}
 * @param object The input root whose own enumerable properties are traversed.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
 * to `undefined`.
 * @returns {ReturnType<typeof import('../types/api.js').deepFindEntry>} A `[pathSegments,
 * observedValue]` pair, or `undefined` when no property matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for invalid options, depths or descent callbacks.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.deepFindEntry(input, 1);   // => [['a', 'n'], 1]
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepfindentryobject-valueorpredicate-options
 */
module.exports = require('./internal/deep').deepFindEntry;
