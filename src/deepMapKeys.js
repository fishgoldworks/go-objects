'use strict';

/**
 * Creates a structure by recursively renaming own enumerable keys.
 *
 * With preserved arrays, structural indexes bypass the key mapper while child records are traversed.
 * Extra properties cannot be renamed to `length` or canonical indexes. Collisions default to
 * overwrite and can throw per output container. Unexpanded branches remain references. Traversal is
 * pre-order depth-first, visits own enumerable string/symbol properties and expands only
 * arrays/plain records below the root. See deep traversal rules.
 *
 * @type {typeof import('../types/api.js').deepMapKeys}
 * @param object The input root whose own enumerable properties are traversed.
 * @param callback Called with `(value, key, parent, path)` and `this` bound to the parent. Must
 * return a string, symbol or safe integer key.
 * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
 * to `undefined`.
 * @returns {ReturnType<typeof import('../types/api.js').deepMapKeys>} A new record structure by
 * default; `arrays: 'preserve'` retains arrays and their structural indexes.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection or required callback.
 * @throws {TypeError} for invalid options, invalid mapped keys or a forbidden collision.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.deepMapKeys(input, (_, k) => k.toUpperCase());   // => { A: { N: 1 }, B: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepmapkeysobject-callback-options
 */
module.exports = require('./internal/deep').deepMapKeys;
