'use strict';

/**
 * Reduces own enumerable values to one accumulator in reverse key order.
 *
 * Without an initial argument, the first visited value seeds the accumulator. Explicit `undefined`
 * is a supplied initial value. An empty input without an initial value throws. The complete
 * own-enumerable key list is visited in reverse, so symbols precede strings. Inherited properties
 * are excluded. Snapshot keys are fixed, deleted properties are skipped and values are read when
 * visited.
 *
 * @type {typeof import('../types/api.js').reduceRight}
 * @param object The input object or value.
 * @param reducer Called with `(accumulator, value, key, object)` and `this` bound to the input;
 * returns the next accumulator.
 * @param [initialValue] The initial accumulator. Explicit `undefined` counts as supplied. Defaults
 * to `first visited value when omitted`.
 * @returns {ReturnType<typeof import('../types/api.js').reduceRight>} The final accumulator, or the
 * initial value for an empty input when one was supplied.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection or required callback.
 * @throws {TypeError} for empty input without an initial accumulator.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 3 };
 * Objects.reduceRight(input, (text, n) => text + n, '');   // => '321'
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#reducerightobject-reducer-initialvalue
 */
module.exports = require('./internal/collection').reduceRight;
