'use strict';

/**
 * Creates a shallow copy of supported data while preserving property descriptors.
 *
 * Retains child references, accessors and ordinary-record prototypes. Supported built-ins have valid
 * copied native state but may use local-realm prototypes. Unsupported values remain references by
 * default or throw in strict mode.
 *
 * @type {typeof import('../types/api.js').clone}
 * @param value The value to copy.
 * @param [options] Optional settings; see the clone support policy in the full API documentation.
 * Unknown options throw. Defaults to `undefined`.
 * @returns {ReturnType<typeof import('../types/api.js').clone>} A supported object copy, or the
 * original primitive/opaque value according to the unsupported-value policy.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for invalid options, including unsupported values under the strict policy.
 * @throws Errors from proxy traps or native Error stack preparation propagate; custom property
 * getters are not invoked.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.clone(input);          // => { a: { n: 1 }, b: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#clonevalue-options
 */
module.exports = require('./internal/clone').clone;
