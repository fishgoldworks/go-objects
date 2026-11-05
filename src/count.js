'use strict';

/**
 * Counts own enumerable properties, optionally selecting matches.
 *
 * Omitting the matcher does not read property values. Explicit `undefined` matches undefined values
 * and therefore reads values. Own enumerable strings are visited before symbols; inherited
 * properties are excluded. With a matcher, snapshot keys are fixed, deleted properties are skipped
 * and values are read when visited. Without a matcher, only keys are counted; getters are not
 * evaluated.
 *
 * @type {typeof import('../types/api.js').count}
 * @param object The input object or value.
 * @param [valueOrPredicate] A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate. Defaults to `omitted (count keys without reading
 * values)`.
 * @returns {ReturnType<typeof import('../types/api.js').count>} The number of own enumerable keys
 * when the matcher is omitted; otherwise the number of matching values.
 * @throws {TypeError} for an invalid collection.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.count(input);          // => 3
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#countobject-valueorpredicate
 */
module.exports = require('./internal/collection').count;
