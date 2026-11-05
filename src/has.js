'use strict';
/**
 * Determines whether an own-property path exists, even when its value is `undefined`.
 *
 * Includes non-enumerable properties. The terminal getter is not evaluated; intermediate getters can
 * run. `[]` identifies an object/function root; holes and inherited properties are absent.
 *
 * @type {typeof import('../types/api.js').has}
 * @param object The input object or value.
 * @param path A string, symbol, safe integer or array of those keys. String paths support dot and
 * quoted/numeric bracket syntax.
 * @returns {ReturnType<typeof import('../types/api.js').has>} `true` when the own path exists;
 * otherwise `false`.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid path or key; malformed string syntax is rejected with
 * `SyntaxError`.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.has(input, 'a.n');     // => true
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#hasobject-path
 */
module.exports = require('./internal/path').has;
