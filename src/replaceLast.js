'use strict';

/**
 * Replaces the last own enumerable match in place and returns its previous value.
 *
 * A replacement function is called with the normal callback arguments; return a function from it to
 * store function data. Accessor replacement is rejected. Visits keys in reverse order. Earlier
 * writes and user side effects are not rolled back after errors. The complete own-enumerable key
 * list is visited in reverse, so symbols precede strings. Inherited properties are excluded.
 * Snapshot keys are fixed, deleted properties are skipped and values are read when visited.
 *
 * @type {typeof import('../types/api.js').replaceLast}
 * @param object The input object to update in place.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @param replacement A literal or synchronous replacement callback. Return a function from a
 * callback to store function data. Typed replacements must fit the matched destinations.
 * @returns {ReturnType<typeof import('../types/api.js').replaceLast>} The previous matching value,
 * or `undefined` when no property matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} when a matched property is an accessor, is non-writable or cannot be written
 * to the destination.
 * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
 * rolled back.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.replaceLast(input, 1, 7);  // => 1
 * input;                             // => { a: 1, b: 2, c: 7 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#replacelastobject-valueorpredicate-replacement
 */
module.exports = require('./internal/collection').replaceLast;
