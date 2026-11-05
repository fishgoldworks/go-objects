'use strict';

/**
 * Sets the same value at several own-property paths and returns their previous values.
 *
 * Mutates the input and stores one shared value/reference. Validates all paths before the first
 * write, but a later runtime failure does not roll back earlier writes.
 *
 * @type {typeof import('../types/api.js').setEach}
 * @param object The input object to update in place.
 * @param paths An actual array of paths, processed in list order.
 * @param value The literal value to store; typed writes must satisfy the selected path.
 * @returns {ReturnType<typeof import('../types/api.js').setEach>} A new array of previous values in
 * path-list order; absent final properties contribute `undefined`.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for an invalid path or key; malformed string syntax is rejected with
 * `SyntaxError`.
 * @throws {RangeError} for an empty mutation path; `TypeError` for unsafe path segments, unsupported
 * containers or forbidden writes.
 * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
 * rolled back.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.setEach(input, ['a.n', 'b'], 7);   // => [1, 2]
 * input;                                     // => { a: { n: 7 }, b: 7 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#seteachobject-paths-value
 */
module.exports = require('./internal/path').setEach;
