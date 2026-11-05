'use strict';

/**
 * Creates a structure by transforming values during depth-first traversal.
 *
 * Returning the original container requests recursive transformation; returning a different value
 * replaces the branch without traversing that replacement. Unexpanded branches and opaque leaves can
 * still reference the input. Traversal is pre-order depth-first, visits own enumerable string/symbol
 * properties and expands only arrays/plain records below the root. See deep traversal rules.
 *
 * @type {typeof import('../types/api.js').deepMap}
 * @param object The input root whose own enumerable properties are traversed.
 * @param callback Called with `(value, key, parent, path)` and `this` bound to the parent. Results
 * are not awaited.
 * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
 * to `undefined`.
 * @returns {ReturnType<typeof import('../types/api.js').deepMap>} A new object or array containing
 * mapped branches, preserving aliases among copied containers.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection or required callback.
 * @throws {TypeError} for invalid options, depths or descent callbacks.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.deepMap(input, v => typeof v === 'number' ? v * 2 : v);  // => { a: { n: 2 }, b: 4 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepmapobject-callback-options
 */
module.exports = require('./internal/deep').deepMap;
