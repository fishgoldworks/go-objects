'use strict';

/**
 * Replaces the first deep match in place and returns its previous value.
 *
 * A replacement function is called with the normal callback arguments; return a function from it to
 * store function data. Accessor replacement is rejected. Stops at the first match. Replacement
 * objects are not traversed. Earlier writes and user side effects are not rolled back after errors.
 * Traversal is pre-order depth-first, visits own enumerable string/symbol properties and expands
 * only arrays/plain records below the root. See deep traversal rules.
 *
 * @type {typeof import('../types/api.js').deepReplace}
 * @param object The input root whose own enumerable properties are traversed.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @param replacement A literal or synchronous replacement callback. Return a function from a
 * callback to store function data. Typed replacements must fit the matched destinations.
 * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
 * to `undefined`.
 * @returns {ReturnType<typeof import('../types/api.js').deepReplace>} The previous matching value,
 * or `undefined` when no property matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for invalid options, depths or descent callbacks.
 * @throws {TypeError} when a matched property is an accessor, is non-writable or cannot be written
 * to the destination.
 * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
 * rolled back.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.deepReplace(input, 1, 7);  // => 1
 * input;                             // => { a: { n: 7 }, b: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepreplaceobject-valueorpredicate-replacement-options
 */
module.exports = require('./internal/deep').deepReplace;
