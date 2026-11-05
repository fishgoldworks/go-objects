'use strict';
/**
 * Creates an updated root by setting one path without writing to the input.
 *
 * Copies only containers along the path; untouched branches retain identity. Supports frozen
 * ordinary records and arrays. Off-path aliases and cycles still refer to the original graph. Stores
 * the supplied value by reference, including functions. Missing/undefined containers can be created
 * for setting; accessors, array length edits, custom instances and unsupported array prototypes are
 * rejected.
 *
 * @type {typeof import('../types/api.js').setImmutable}
 * @param object The input object or value.
 * @param path A string, symbol, safe integer or array of those keys. String paths support dot and
 * quoted/numeric bracket syntax.
 * @param value The literal value to store by reference. Its type determines the updated result type;
 * schema changes are allowed.
 * @returns {ReturnType<typeof import('../types/api.js').setImmutable>} The updated root, or the
 * original root for an existing value unchanged by `Object.is`.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for an invalid path or key; malformed string syntax is rejected with
 * `SyntaxError`.
 * @throws {RangeError} for an empty mutation path; `TypeError` for unsafe path segments, unsupported
 * containers or forbidden writes.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.setImmutable(input, ['a', 'n'], 7);  // => { a: { n: 7 }, b: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#setimmutableobject-path-value
 */
module.exports = require('./internal/immutable').setImmutable;
