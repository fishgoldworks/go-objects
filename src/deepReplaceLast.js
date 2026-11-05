'use strict';

/**
 * Replaces the last deep match in place and returns its previous value.
 *
 * A replacement function is called with the normal callback arguments; return a function from it to
 * store function data. Accessor replacement is rejected. Inspects the full forward depth-first
 * traversal before applying the final match. Replacement objects are not traversed. Earlier writes
 * and user side effects are not rolled back after errors. Traversal is pre-order depth-first, visits
 * own enumerable string/symbol properties and expands only arrays/plain records below the root. See
 * deep traversal rules.
 *
 * @type {typeof import('../types/api.js').deepReplaceLast}
 * @param object The input root whose own enumerable properties are traversed.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @param replacement A literal or synchronous replacement callback. Return a function from a
 * callback to store function data. Typed replacements must fit the matched destinations.
 * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
 * to `undefined`.
 * @returns {ReturnType<typeof import('../types/api.js').deepReplaceLast>} The previous matching
 * value, or `undefined` when no property matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for invalid options, depths or descent callbacks.
 * @throws {TypeError} when a matched property is an accessor, is non-writable or cannot be written
 * to the destination.
 * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
 * rolled back.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.deepReplaceLast(input, v => typeof v === 'number', 7);   // => 2
 * input;                                                           // => { a: { n: 1 }, b: 7 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepreplacelastobject-valueorpredicate-replacement-options
 */
module.exports = require('./internal/deep').deepReplaceLast;
