'use strict';
/**
 * Updates an own-property path by calling an updater once with its previous value.
 *
 * Mutates the input. Checks the path, data descriptors and ordinary destination restrictions before
 * calling `updater(previousValue)`. Missing parents are attached only after it returns. Native value
 * validation and exotic-object write restrictions can still fail afterward. Rechecks restrictions
 * after callback side effects. Returned functions or promises are stored, not invoked or awaited.
 *
 * @type {typeof import('../types/api.js').update}
 * @param object The input object to update in place.
 * @param path A string, symbol, safe integer or array of those keys. String paths support dot and
 * quoted/numeric bracket syntax.
 * @param updater Called once with the previous value; returns the replacement without awaiting it.
 * Avoid mutating the input in the callback.
 * @returns {ReturnType<typeof import('../types/api.js').update>} The value observed before invoking
 * the updater, or `undefined` when the property was absent.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection or required callback.
 * @throws {TypeError} for an invalid path or key; malformed string syntax is rejected with
 * `SyntaxError`.
 * @throws {RangeError} for an empty mutation path; `TypeError` for unsafe path segments, unsupported
 * containers or forbidden writes.
 * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
 * rolled back.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.update(input, 'a.n', n => n + 1);  // => 1
 * input;                                     // => { a: { n: 2 }, b: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#updateobject-path-updater
 */
module.exports = require('./internal/path').update;
