'use strict';

/**
 * Determines whether an own enumerable property contains a matching value.
 *
 * `NaN` matches itself, signed zeros match and objects/functions compare by identity. Primitive
 * inputs return `false`. Own enumerable strings are visited before symbols; inherited properties are
 * excluded. Snapshot keys are fixed, deleted properties are skipped and values are read when
 * visited.
 *
 * @type {typeof import('../types/api.js').hasValue}
 * @param object The input object or value.
 * @param value The literal value to match by SameValueZero.
 * @returns {ReturnType<typeof import('../types/api.js').hasValue>} `true` if an observed value
 * matches by SameValueZero; otherwise `false`.
 * @throws {TypeError} when a required argument is omitted.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.hasValue(input, 2);    // => true
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#hasvalueobject-value
 */
module.exports = require('./internal/collection').hasValue;
