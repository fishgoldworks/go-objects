'use strict';
/**
 * Creates an updated root by computing a path value without writing to the input.
 *
 * Copies only containers along the path; untouched branches retain identity. Supports frozen
 * ordinary records and arrays. Off-path aliases and cycles still refer to the original graph. Calls
 * the updater once and stores its result without awaiting it. Callback/proxy side effects are not
 * rolled back. Missing/undefined containers can be created for setting; accessors, array length
 * edits, custom instances and unsupported array prototypes are rejected.
 *
 * @type {typeof import('../types/api.js').updateImmutable}
 * @param object The input object or value.
 * @param path A string, symbol, safe integer or array of those keys. String paths support dot and
 * quoted/numeric bracket syntax.
 * @param updater Called once with the previous value; returns the replacement without awaiting it.
 * Avoid mutating the input in the callback.
 * @returns {ReturnType<typeof import('../types/api.js').updateImmutable>} The updated root, or the
 * original root for an existing value unchanged by `Object.is`.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection or required callback.
 * @throws {TypeError} for an invalid path or key; malformed string syntax is rejected with
 * `SyntaxError`.
 * @throws {RangeError} for an empty mutation path; `TypeError` for unsafe path segments, unsupported
 * containers or forbidden writes.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.updateImmutable(input, ['a', 'n'], n => n + 1);  // => { a: { n: 2 }, b: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#updateimmutableobject-path-updater
 */
module.exports = require('./internal/immutable').updateImmutable;
