'use strict';

/**
 * Creates a graph-preserving copy of supported nested data and property descriptors.
 *
 * Copies supported Map/Set contents and backing-buffer relationships. Unsupported values remain
 * references by default and their children are not visited. User getters are retained without
 * invocation; native Error stack materialisation can invoke `Error.prepareStackTrace`.
 *
 * @type {typeof import('../types/api.js').deepClone}
 * @param value The value to copy.
 * @param [options] Optional settings; see the clone support policy in the full API documentation.
 * Unknown options throw. Defaults to `undefined`.
 * @returns {ReturnType<typeof import('../types/api.js').deepClone>} A copied supported graph with
 * shared identities and cycles preserved; primitives and permitted opaque values retain identity.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for invalid options, including unsupported values under the strict policy.
 * @throws Errors from proxy traps or native Error stack preparation propagate; custom property
 * getters are not invoked.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.deepClone(input);      // => { a: { n: 1 }, b: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepclonevalue-options
 */
module.exports = require('./internal/clone').deepClone;
