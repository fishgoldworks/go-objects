'use strict';

/**
 * Returns the path to the first deep match during depth-first traversal.
 *
 * Shared/circular containers expand once; the root is excluded. Traversal boundaries retain their
 * property-edge semantics. Traversal is pre-order depth-first, visits own enumerable string/symbol
 * properties and expands only arrays/plain records below the root. See deep traversal rules.
 *
 * @type {typeof import('../types/api.js').findPath}
 * @param object The input root whose own enumerable properties are traversed.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
 * to `undefined`.
 * @returns {ReturnType<typeof import('../types/api.js').findPath>} A fresh array of string/symbol
 * path segments, or `undefined`.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for invalid options, depths or descent callbacks.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.findPath(input, 1);    // => ['a', 'n']
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#findpathobject-valueorpredicate-options
 */
module.exports = require('./internal/deep').findPath;
