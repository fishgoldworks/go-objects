'use strict';

/**
 * Creates a record by renaming own enumerable keys while retaining their values.
 *
 * Arrays become records. The last colliding key wins by default; `onCollision: 'throw'` rejects
 * collisions. Numeric results normalise to strings before collision checks. Own enumerable strings
 * are visited before symbols; inherited properties are excluded. Snapshot keys are fixed, deleted
 * properties are skipped and values are read when visited.
 *
 * @type {typeof import('../types/api.js').mapKeys}
 * @param object The input object or value.
 * @param callback Called with `(value, key, object)` and `this` bound to the input. Must return a
 * string, symbol or safe integer key.
 * @param [options] Optional settings; see key-mapping collision rules below. Unknown options throw.
 * Defaults to `undefined`.
 * @returns {ReturnType<typeof import('../types/api.js').mapKeys>} A new record with mapped keys and
 * original value references.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection or required callback.
 * @throws {TypeError} for invalid options, invalid mapped keys or a forbidden collision.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.mapKeys(input, (_, k) => k.toUpperCase());   // => { A: 1, B: 2, C: 1 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#mapkeysobject-callback-options
 */
module.exports = require('./internal/collection').mapKeys;
