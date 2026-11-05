'use strict';

/**
 * Determines whether a value has an own property, including a non-enumerable property.
 *
 * Inherited properties, invalid key kinds and primitive inputs return `false`. Does not evaluate the
 * property getter.
 *
 * @type {typeof import('../types/api.js').hasProp}
 * @param object The input object or value.
 * @param key A string, symbol or safe integer literal key. Invalid key kinds return `false`.
 * @returns {ReturnType<typeof import('../types/api.js').hasProp>} `true` if the property exists on
 * the value itself; otherwise `false`.
 * @throws {TypeError} when a required argument is omitted.
 * @throws Errors from proxy traps propagate.
 * @example
 * const input = Object.defineProperty({}, 'hidden', { value: 1 });
 * Objects.hasProp(input, 'hidden');  // => true
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#haspropobject-key
 */
module.exports = require('./internal/collection').hasProp;
