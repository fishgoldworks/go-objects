'use strict';

/**
 * Determines whether a value has an own enumerable property with a given key.
 *
 * Invalid key kinds and primitive inputs return `false` without coercion hooks. Does not evaluate
 * the property getter.
 *
 * @type {typeof import('../types/api.js').hasKey}
 * @param object The input object or value.
 * @param key A string, symbol or safe integer literal key. Invalid key kinds return `false`.
 * @returns {ReturnType<typeof import('../types/api.js').hasKey>} `true` if the property is own and
 * enumerable; otherwise `false`.
 * @throws {TypeError} when a required argument is omitted.
 * @throws Errors from proxy traps propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.hasKey(input, 'a');    // => true
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#haskeyobject-key
 */
module.exports = require('./internal/collection').hasKey;
