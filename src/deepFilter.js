'use strict';

/**
 * Creates a structure by retaining matching branches and pruning rejected containers.
 *
 * Rejecting a container excludes its descendants. Unexpanded branches and shared aliases may retain
 * data: this is not an authorisation or complete redaction boundary. Traversal is pre-order
 * depth-first, visits own enumerable string/symbol properties and expands only arrays/plain records
 * below the root. See deep traversal rules.
 *
 * @type {typeof import('../types/api.js').deepFilter}
 * @param object The input root whose own enumerable properties are traversed.
 * @param predicate Called with `(value, key, parent, path)` and `this` bound to the parent. Truthy
 * results retain the property.
 * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
 * to `undefined`.
 * @returns {ReturnType<typeof import('../types/api.js').deepFilter>} A new object or array of
 * retained properties, with compacted array indexes.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection or required callback.
 * @throws {TypeError} for invalid options, depths or descent callbacks.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.deepFilter(input, v => typeof v !== 'number' || v > 1);  // => { a: {}, b: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepfilterobject-predicate-options
 */
module.exports = require('./internal/deep').deepFilter;
