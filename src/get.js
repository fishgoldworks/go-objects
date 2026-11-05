'use strict';

/**
 * Returns a value at an own-property path, using a default when it is missing or `undefined`.
 *
 * Preserves `null`. Reads each own path step once; does not traverse primitive properties. The empty
 * string names the empty-string property.
 *
 * @type {typeof import('../types/api.js').get}
 * @param object The input object or value.
 * @param path A string, symbol, safe integer or array of those keys. String paths support dot and
 * quoted/numeric bracket syntax.
 * @param [defaultValue] The fallback for missing or `undefined` path values; preserves `null`.
 * Defaults to `undefined`.
 * @returns {ReturnType<typeof import('../types/api.js').get>} The observed value, or the default for
 * a missing/`undefined` value. An empty path array returns the original root.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid path or key; malformed string syntax is rejected with
 * `SyntaxError`.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.get(input, 'a.n');     // => 1
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#getobject-path-defaultvalue
 */
module.exports = require('./internal/path').get;
