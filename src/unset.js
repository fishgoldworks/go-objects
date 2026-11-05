'use strict';

/**
 * Removes an own property at a path without shifting array indexes.
 *
 * Mutates the input. Missing, `null` or scalar intermediate branches count as absent. Array index
 * deletion leaves a hole and retains length. Does not create containers. A configurable terminal
 * accessor can be deleted without evaluating its getter; intermediate accessors remain forbidden.
 *
 * @type {typeof import('../types/api.js').unset}
 * @param object The input object to update in place.
 * @param path A string, symbol, safe integer or array of those keys. String paths support dot and
 * quoted/numeric bracket syntax.
 * @returns {ReturnType<typeof import('../types/api.js').unset>} `true` when deletion succeeds or the
 * path is already absent.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for an invalid path or key; malformed string syntax is rejected with
 * `SyntaxError`.
 * @throws {TypeError} for unsafe paths, an invalid root, intermediate accessors or a
 * non-configurable final property.
 * @throws {RangeError} for an empty mutation path.
 * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
 * rolled back.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.unset(input, 'a.n');   // => true
 * input;                         // => { a: {}, b: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#unsetobject-path
 */
module.exports = require('./internal/path').unset;
