'use strict';

/**
 * Replaces all selected own enumerable matches in place and returns their previous values.
 *
 * A replacement function is called with the normal callback arguments; return a function from it to
 * store function data. Accessor replacement is rejected. Visits keys in forward order. Earlier
 * writes and user side effects are not rolled back after errors. Own enumerable strings are visited
 * before symbols; inherited properties are excluded. Snapshot keys are fixed, deleted properties are
 * skipped and values are read when visited.
 *
 * @type {typeof import('../types/api.js').replaceAll}
 * @param object The input object to update in place.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @param replacement A literal or synchronous replacement callback. Return a function from a
 * callback to store function data. Typed replacements must fit the matched destinations.
 * @returns {ReturnType<typeof import('../types/api.js').replaceAll>} A new array of previous values
 * in traversal order, or `[]` when nothing matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} when a matched property is an accessor, is non-writable or cannot be written
 * to the destination.
 * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
 * rolled back.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.replaceAll(input, 1, 7);   // => [1, 1]
 * input;                             // => { a: 7, b: 2, c: 7 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#replaceallobject-valueorpredicate-replacement
 */
module.exports = require('./internal/collection').replaceAll;
