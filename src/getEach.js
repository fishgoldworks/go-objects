'use strict';

/**
 * Returns values at several own-property paths in the supplied order.
 *
 * Validates the complete path list before reading values. Paths can repeat. Defaults replace
 * missing/`undefined` values, not `null`.
 *
 * @type {typeof import('../types/api.js').getEach}
 * @param object The input object or value.
 * @param paths An actual array of paths, processed in list order.
 * @param [defaultValue] The fallback for missing or `undefined` path values; preserves `null`.
 * Defaults to `undefined`.
 * @returns {ReturnType<typeof import('../types/api.js').getEach>} A new array with one value or
 * default per requested path.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid path or key; malformed string syntax is rejected with
 * `SyntaxError`.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.getEach(input, ['a.n', 'b', 'absent'], 9);   // => [1, 2, 9]
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#geteachobject-paths-defaultvalue
 */
module.exports = require('./internal/path').getEach;
