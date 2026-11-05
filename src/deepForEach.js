'use strict';

/**
 * Visits own enumerable property edges depth-first and returns the original root.
 *
 * Excludes the root itself. Shared/circular containers expand once, but each encountered property
 * edge is visited. Traversal is pre-order depth-first, visits own enumerable string/symbol
 * properties and expands only arrays/plain records below the root. See deep traversal rules.
 *
 * @type {typeof import('../types/api.js').deepForEach}
 * @param object The input root whose own enumerable properties are traversed.
 * @param callback Called with `(value, key, parent, path)` and `this` bound to the parent. Results
 * are not awaited.
 * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
 * to `undefined`.
 * @returns {ReturnType<typeof import('../types/api.js').deepForEach>} The original root; callback
 * results are ignored.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection or required callback.
 * @throws {TypeError} for invalid options, depths or descent callbacks.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.deepForEach(input, () => undefined);   // => { a: { n: 1 }, b: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepforeachobject-callback-options
 */
module.exports = require('./internal/deep').deepForEach;
