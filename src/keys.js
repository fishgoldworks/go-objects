'use strict';

/**
 * Returns the own enumerable string and symbol keys of a value.
 *
 * String keys follow `Object.keys` order, followed by symbols. Does not read property values.
 *
 * @type {typeof import('../types/api.js').keys}
 * @param object The input object or value.
 * @returns {ReturnType<typeof import('../types/api.js').keys>} A new array of keys, or `[]` for a
 * primitive input.
 * @throws {TypeError} when a required argument is omitted.
 * @throws Errors from proxy traps propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.keys(input);           // => ['a', 'b', 'c']
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#keysobject
 */
module.exports = require('./internal/collection').keys;
