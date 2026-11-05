import Objects from './index.js';
export default Objects;
export type {
  Key,
  Path,
  CloneOptions,
  TraversalOptions,
  MapKeysOptions,
  DeepMapKeysOptions,
  Wrapper
} from './types/api.js';
/**
 * Creates a shallow copy of supported data while preserving property descriptors.
 *
 * Retains child references, accessors and ordinary-record prototypes. Supported built-ins have valid
 * copied native state but may use local-realm prototypes. Unsupported values remain references by
 * default or throw in strict mode.
 *
 * @param value The value to copy.
 * @param [options] Optional settings; see the clone support policy in the full API documentation.
 * Unknown options throw. Defaults to `undefined`.
 * @returns A supported object copy, or the original primitive/opaque value according to the
 * unsupported-value policy.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for invalid options, including unsupported values under the strict policy.
 * @throws Errors from proxy traps or native Error stack preparation propagate; custom property
 * getters are not invoked.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.clone(input);          // => { a: { n: 1 }, b: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#clonevalue-options
 */
export const clone: typeof Objects.clone;
/**
 * Counts own enumerable properties, optionally selecting matches.
 *
 * Omitting the matcher does not read property values. Explicit `undefined` matches undefined values
 * and therefore reads values. Own enumerable strings are visited before symbols; inherited
 * properties are excluded. With a matcher, snapshot keys are fixed, deleted properties are skipped
 * and values are read when visited. Without a matcher, only keys are counted; getters are not
 * evaluated.
 *
 * @param object The input object or value.
 * @param [valueOrPredicate] A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate. Defaults to `omitted (count keys without reading
 * values)`.
 * @returns The number of own enumerable keys when the matcher is omitted; otherwise the number of
 * matching values.
 * @throws {TypeError} for an invalid collection.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.count(input);          // => 3
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#countobject-valueorpredicate
 */
export const count: typeof Objects.count;
/**
 * Creates a graph-preserving copy of supported nested data and property descriptors.
 *
 * Copies supported Map/Set contents and backing-buffer relationships. Unsupported values remain
 * references by default and their children are not visited. User getters are retained without
 * invocation; native Error stack materialisation can invoke `Error.prepareStackTrace`.
 *
 * @param value The value to copy.
 * @param [options] Optional settings; see the clone support policy in the full API documentation.
 * Unknown options throw. Defaults to `undefined`.
 * @returns A copied supported graph with shared identities and cycles preserved; primitives and
 * permitted opaque values retain identity.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for invalid options, including unsupported values under the strict policy.
 * @throws Errors from proxy traps or native Error stack preparation propagate; custom property
 * getters are not invoked.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.deepClone(input);      // => { a: { n: 1 }, b: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepclonevalue-options
 */
export const deepClone: typeof Objects.deepClone;
/**
 * Counts matching property edges during depth-first traversal.
 *
 * Shared/circular containers expand once; the root is excluded. Traversal boundaries retain their
 * property-edge semantics. Traversal is pre-order depth-first, visits own enumerable string/symbol
 * properties and expands only arrays/plain records below the root. See deep traversal rules.
 *
 * @param object The input root whose own enumerable properties are traversed.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
 * to `undefined`.
 * @returns The number of matching visited property edges, excluding the root.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for invalid options, depths or descent callbacks.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.deepCount(input, () => true);  // => 3
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepcountobject-valueorpredicate-options
 */
export const deepCount: typeof Objects.deepCount;
/**
 * Creates a structure by retaining matching branches and pruning rejected containers.
 *
 * Rejecting a container excludes its descendants. Unexpanded branches and shared aliases may retain
 * data: this is not an authorisation or complete redaction boundary. Traversal is pre-order
 * depth-first, visits own enumerable string/symbol properties and expands only arrays/plain records
 * below the root. See deep traversal rules.
 *
 * @param object The input root whose own enumerable properties are traversed.
 * @param predicate Called with `(value, key, parent, path)` and `this` bound to the parent. Truthy
 * results retain the property.
 * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
 * to `undefined`.
 * @returns A new object or array of retained properties, with compacted array indexes.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection or required callback.
 * @throws {TypeError} for invalid options, depths or descent callbacks.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.deepFilter(input, v => typeof v !== 'number' || v > 1);  // => { a: {}, b: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepfilterobject-predicate-options
 */
export const deepFilter: typeof Objects.deepFilter;
/**
 * Returns the first matching value during depth-first traversal.
 *
 * Shared/circular containers expand once; the root is excluded. Traversal boundaries retain their
 * property-edge semantics. Traversal is pre-order depth-first, visits own enumerable string/symbol
 * properties and expands only arrays/plain records below the root. See deep traversal rules.
 *
 * @param object The input root whose own enumerable properties are traversed.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
 * to `undefined`.
 * @returns The matching value, or `undefined` when no property matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for invalid options, depths or descent callbacks.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.deepFind(input, 1);    // => 1
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepfindobject-valueorpredicate-options
 */
export const deepFind: typeof Objects.deepFind;
/**
 * Returns all matching values during depth-first traversal.
 *
 * Shared/circular containers expand once; the root is excluded. Traversal boundaries retain their
 * property-edge semantics. Traversal is pre-order depth-first, visits own enumerable string/symbol
 * properties and expands only arrays/plain records below the root. See deep traversal rules.
 *
 * @param object The input root whose own enumerable properties are traversed.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
 * to `undefined`.
 * @returns A new array of matching values in traversal order, or `[]`.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for invalid options, depths or descent callbacks.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.deepFindAll(input, v => typeof v === 'number');  // => [1, 2]
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepfindallobject-valueorpredicate-options
 */
export const deepFindAll: typeof Objects.deepFindAll;
/**
 * Returns the final key of the first deep match during depth-first traversal.
 *
 * Shared/circular containers expand once; the root is excluded. Traversal boundaries retain their
 * property-edge semantics. Traversal is pre-order depth-first, visits own enumerable string/symbol
 * properties and expands only arrays/plain records below the root. See deep traversal rules.
 *
 * @param object The input root whose own enumerable properties are traversed.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
 * to `undefined`.
 * @returns The final string or symbol key of the first match, or `undefined`.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for invalid options, depths or descent callbacks.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.deepFindKey(input, 1);   // => 'n'
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepfindkeyobject-valueorpredicate-options
 */
export const deepFindKey: typeof Objects.deepFindKey;
/**
 * Returns the last matching value during depth-first traversal.
 *
 * Runs callbacks in forward pre-order and retains the last match. Shared/circular containers expand
 * once; the root is excluded. Traversal boundaries retain their property-edge semantics. Traversal
 * is pre-order depth-first, visits own enumerable string/symbol properties and expands only
 * arrays/plain records below the root. See deep traversal rules.
 *
 * @param object The input root whose own enumerable properties are traversed.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
 * to `undefined`.
 * @returns The matching value, or `undefined` when no property matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for invalid options, depths or descent callbacks.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.deepFindLast(input, v => typeof v === 'number');   // => 2
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepfindlastobject-valueorpredicate-options
 */
export const deepFindLast: typeof Objects.deepFindLast;
/**
 * Visits own enumerable property edges depth-first and returns the original root.
 *
 * Excludes the root itself. Shared/circular containers expand once, but each encountered property
 * edge is visited. Traversal is pre-order depth-first, visits own enumerable string/symbol
 * properties and expands only arrays/plain records below the root. See deep traversal rules.
 *
 * @param object The input root whose own enumerable properties are traversed.
 * @param callback Called with `(value, key, parent, path)` and `this` bound to the parent. Results
 * are not awaited.
 * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
 * to `undefined`.
 * @returns The original root; callback results are ignored.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection or required callback.
 * @throws {TypeError} for invalid options, depths or descent callbacks.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.deepForEach(input, () => undefined);   // => { a: { n: 1 }, b: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepforeachobject-callback-options
 */
export const deepForEach: typeof Objects.deepForEach;
/**
 * Creates a structure by transforming values during depth-first traversal.
 *
 * Returning the original container requests recursive transformation; returning a different value
 * replaces the branch without traversing that replacement. Unexpanded branches and opaque leaves can
 * still reference the input. Traversal is pre-order depth-first, visits own enumerable string/symbol
 * properties and expands only arrays/plain records below the root. See deep traversal rules.
 *
 * @param object The input root whose own enumerable properties are traversed.
 * @param callback Called with `(value, key, parent, path)` and `this` bound to the parent. Results
 * are not awaited.
 * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
 * to `undefined`.
 * @returns A new object or array containing mapped branches, preserving aliases among copied
 * containers.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection or required callback.
 * @throws {TypeError} for invalid options, depths or descent callbacks.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.deepMap(input, v => typeof v === 'number' ? v * 2 : v);  // => { a: { n: 2 }, b: 4 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepmapobject-callback-options
 */
export const deepMap: typeof Objects.deepMap;
/**
 * Creates a structure by recursively renaming own enumerable keys.
 *
 * With preserved arrays, structural indexes bypass the key mapper while child records are traversed.
 * Extra properties cannot be renamed to `length` or canonical indexes. Collisions default to
 * overwrite and can throw per output container. Unexpanded branches remain references. Traversal is
 * pre-order depth-first, visits own enumerable string/symbol properties and expands only
 * arrays/plain records below the root. See deep traversal rules.
 *
 * @param object The input root whose own enumerable properties are traversed.
 * @param callback Called with `(value, key, parent, path)` and `this` bound to the parent. Must
 * return a string, symbol or safe integer key.
 * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
 * to `undefined`.
 * @returns A new record structure by default; `arrays: 'preserve'` retains arrays and their
 * structural indexes.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection or required callback.
 * @throws {TypeError} for invalid options, invalid mapped keys or a forbidden collision.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.deepMapKeys(input, (_, k) => k.toUpperCase());   // => { A: { N: 1 }, B: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepmapkeysobject-callback-options
 */
export const deepMapKeys: typeof Objects.deepMapKeys;
/**
 * Removes the first deep match in place and returns its previous value.
 *
 * Deletion uses configurability, not writability, and leaves array holes. Stops at the first match.
 * Replacement objects are not traversed. Earlier writes and user side effects are not rolled back
 * after errors. Traversal is pre-order depth-first, visits own enumerable string/symbol properties
 * and expands only arrays/plain records below the root. See deep traversal rules.
 *
 * @param object The input root whose own enumerable properties are traversed.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
 * to `undefined`.
 * @returns The previous matching value, or `undefined` when no property matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for invalid options, depths or descent callbacks.
 * @throws {TypeError} when a matched property is non-configurable and cannot be deleted.
 * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
 * rolled back.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.deepRemove(input, 1);  // => 1
 * input;                         // => { a: {}, b: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepremoveobject-valueorpredicate-options
 */
export const deepRemove: typeof Objects.deepRemove;
/**
 * Removes all selected deep matches in place and returns their previous values.
 *
 * Deletion uses configurability, not writability, and leaves array holes. Matched branches are
 * pruned: detached descendants are not subsequently changed. Replacement objects are not traversed.
 * Earlier writes and user side effects are not rolled back after errors. Traversal is pre-order
 * depth-first, visits own enumerable string/symbol properties and expands only arrays/plain records
 * below the root. See deep traversal rules.
 *
 * @param object The input root whose own enumerable properties are traversed.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
 * to `undefined`.
 * @returns A new array of previous values in traversal order, or `[]` when nothing matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for invalid options, depths or descent callbacks.
 * @throws {TypeError} when a matched property is non-configurable and cannot be deleted.
 * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
 * rolled back.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.deepRemoveAll(input, v => typeof v === 'number');  // => [1, 2]
 * input;                                                     // => { a: {} }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepremoveallobject-valueorpredicate-options
 */
export const deepRemoveAll: typeof Objects.deepRemoveAll;
/**
 * Removes the last deep match in place and returns its previous value.
 *
 * Deletion uses configurability, not writability, and leaves array holes. Inspects the full forward
 * depth-first traversal before applying the final match. Replacement objects are not traversed.
 * Earlier writes and user side effects are not rolled back after errors. Traversal is pre-order
 * depth-first, visits own enumerable string/symbol properties and expands only arrays/plain records
 * below the root. See deep traversal rules.
 *
 * @param object The input root whose own enumerable properties are traversed.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
 * to `undefined`.
 * @returns The previous matching value, or `undefined` when no property matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for invalid options, depths or descent callbacks.
 * @throws {TypeError} when a matched property is non-configurable and cannot be deleted.
 * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
 * rolled back.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.deepRemoveLast(input, v => typeof v === 'number');   // => 2
 * input;                                                       // => { a: { n: 1 } }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepremovelastobject-valueorpredicate-options
 */
export const deepRemoveLast: typeof Objects.deepRemoveLast;
/**
 * Replaces the first deep match in place and returns its previous value.
 *
 * A replacement function is called with the normal callback arguments; return a function from it to
 * store function data. Accessor replacement is rejected. Stops at the first match. Replacement
 * objects are not traversed. Earlier writes and user side effects are not rolled back after errors.
 * Traversal is pre-order depth-first, visits own enumerable string/symbol properties and expands
 * only arrays/plain records below the root. See deep traversal rules.
 *
 * @param object The input root whose own enumerable properties are traversed.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @param replacement A literal or synchronous replacement callback. Return a function from a
 * callback to store function data. Typed replacements must fit the matched destinations.
 * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
 * to `undefined`.
 * @returns The previous matching value, or `undefined` when no property matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for invalid options, depths or descent callbacks.
 * @throws {TypeError} when a matched property is an accessor, is non-writable or cannot be written
 * to the destination.
 * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
 * rolled back.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.deepReplace(input, 1, 7);  // => 1
 * input;                             // => { a: { n: 7 }, b: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepreplaceobject-valueorpredicate-replacement-options
 */
export const deepReplace: typeof Objects.deepReplace;
/**
 * Replaces all selected deep matches in place and returns their previous values.
 *
 * A replacement function is called with the normal callback arguments; return a function from it to
 * store function data. Accessor replacement is rejected. Matched branches are pruned: detached
 * descendants are not subsequently changed. Replacement objects are not traversed. Earlier writes
 * and user side effects are not rolled back after errors. Traversal is pre-order depth-first, visits
 * own enumerable string/symbol properties and expands only arrays/plain records below the root. See
 * deep traversal rules.
 *
 * @param object The input root whose own enumerable properties are traversed.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @param replacement A literal or synchronous replacement callback. Return a function from a
 * callback to store function data. Typed replacements must fit the matched destinations.
 * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
 * to `undefined`.
 * @returns A new array of previous values in traversal order, or `[]` when nothing matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for invalid options, depths or descent callbacks.
 * @throws {TypeError} when a matched property is an accessor, is non-writable or cannot be written
 * to the destination.
 * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
 * rolled back.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.deepReplaceAll(input, v => typeof v === 'number', 7);  // => [1, 2]
 * input;                                                         // => { a: { n: 7 }, b: 7 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepreplaceallobject-valueorpredicate-replacement-options
 */
export const deepReplaceAll: typeof Objects.deepReplaceAll;
/**
 * Replaces the last deep match in place and returns its previous value.
 *
 * A replacement function is called with the normal callback arguments; return a function from it to
 * store function data. Accessor replacement is rejected. Inspects the full forward depth-first
 * traversal before applying the final match. Replacement objects are not traversed. Earlier writes
 * and user side effects are not rolled back after errors. Traversal is pre-order depth-first, visits
 * own enumerable string/symbol properties and expands only arrays/plain records below the root. See
 * deep traversal rules.
 *
 * @param object The input root whose own enumerable properties are traversed.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @param replacement A literal or synchronous replacement callback. Return a function from a
 * callback to store function data. Typed replacements must fit the matched destinations.
 * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
 * to `undefined`.
 * @returns The previous matching value, or `undefined` when no property matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for invalid options, depths or descent callbacks.
 * @throws {TypeError} when a matched property is an accessor, is non-writable or cannot be written
 * to the destination.
 * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
 * rolled back.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.deepReplaceLast(input, v => typeof v === 'number', 7);   // => 2
 * input;                                                           // => { a: { n: 1 }, b: 7 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepreplacelastobject-valueorpredicate-replacement-options
 */
export const deepReplaceLast: typeof Objects.deepReplaceLast;
/**
 * Returns the key-and-value pairs of own enumerable properties.
 *
 * Own enumerable strings are visited before symbols; inherited properties are excluded. Snapshot
 * keys are fixed, deleted properties are skipped and values are read when visited.
 *
 * @param object The input object or value.
 * @returns A new array of `[key, value]` pairs in key order, or `[]` for a primitive input.
 * @throws {TypeError} when a required argument is omitted.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.entries(input);        // => [['a', 1], ['b', 2], ['c', 1]]
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#entriesobject
 */
export const entries: typeof Objects.entries;
/**
 * Determines whether every own enumerable property matches a value or predicate.
 *
 * Stops callbacks and value reads at the first failure; keys are snapshotted before searching. Own
 * enumerable strings are visited before symbols; inherited properties are excluded. Snapshot keys
 * are fixed, deleted properties are skipped and values are read when visited.
 *
 * @param object The input object or value.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @returns `false` at the first failure; otherwise `true`, including for an empty input.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.every(input, n => n > 0);  // => true
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#everyobject-valueorpredicate
 */
export const every: typeof Objects.every;
/**
 * Returns entries of the first object that occur in none of the other objects.
 *
 * Compares values by SameValueZero. With no additional objects, still returns a new record. Own
 * enumerable strings are visited before symbols; inherited properties are excluded. Snapshot keys
 * are fixed, deleted properties are skipped and values are read when visited.
 *
 * @param object The input object or value.
 * @param others Additional source objects in argument order.
 * @returns A new record of own enumerable key/value pairs absent from all other inputs.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.except(input, { b: 2 });   // => { a: 1, c: 1 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#exceptobject-others
 */
export const except: typeof Objects.except;
/**
 * Creates an object or array retaining properties whose predicate result is truthy.
 *
 * Retained array indexes compact; retained extra enumerable string/symbol properties remain. Own
 * enumerable strings are visited before symbols; inherited properties are excluded. Snapshot keys
 * are fixed, deleted properties are skipped and values are read when visited.
 *
 * @param object The input object or value.
 * @param predicate Called with `(value, key, object)` and `this` bound to the input. Truthy results
 * retain the property.
 * @returns A new container of retained values, preserving their references.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection or required callback.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.filter(input, n => n > 1);   // => { b: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#filterobject-predicate
 */
export const filter: typeof Objects.filter;
/**
 * Returns the first own enumerable value matching a literal or predicate.
 *
 * Use `findEntry` to distinguish a found `undefined` from no match. Own enumerable strings are
 * visited before symbols; inherited properties are excluded. Snapshot keys are fixed, deleted
 * properties are skipped and values are read when visited.
 *
 * @param object The input object or value.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @returns The matching value, or `undefined` when no property matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.find(input, n => n > 1);   // => 2
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#findobject-valueorpredicate
 */
export const find: typeof Objects.find;
/**
 * Returns all own enumerable values matching a literal or predicate.
 *
 * Own enumerable strings are visited before symbols; inherited properties are excluded. Snapshot
 * keys are fixed, deleted properties are skipped and values are read when visited.
 *
 * @param object The input object or value.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @returns A new array of matching values in forward key order, or `[]`.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.findAll(input, 1);     // => [1, 1]
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#findallobject-valueorpredicate
 */
export const findAll: typeof Objects.findAll;
/**
 * Returns the key and observed value of the first own enumerable match.
 *
 * Captures the value during matching without rereading its getter. A pair with `undefined`
 * distinguishes a found value from no match. Own enumerable strings are visited before symbols;
 * inherited properties are excluded. Snapshot keys are fixed, deleted properties are skipped and
 * values are read when visited.
 *
 * @param object The input object or value.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @returns A `[key, observedValue]` pair, or `undefined` when no property matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.findEntry(input, 2);   // => ['b', 2]
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#findentryobject-valueorpredicate
 */
export const findEntry: typeof Objects.findEntry;
/**
 * Returns the key of the first own enumerable match.
 *
 * Own enumerable strings are visited before symbols; inherited properties are excluded. Snapshot
 * keys are fixed, deleted properties are skipped and values are read when visited.
 *
 * @param object The input object or value.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @returns The matching string or symbol key, or `undefined`.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.findKey(input, 2);     // => 'b'
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#findkeyobject-valueorpredicate
 */
export const findKey: typeof Objects.findKey;
/**
 * Returns the last own enumerable value matching a literal or predicate.
 *
 * Visits keys in reverse order. Use `findEntry` to distinguish a found `undefined` from no match.
 * The complete own-enumerable key list is visited in reverse, so symbols precede strings. Inherited
 * properties are excluded. Snapshot keys are fixed, deleted properties are skipped and values are
 * read when visited.
 *
 * @param object The input object or value.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @returns The matching value, or `undefined` when no property matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.findLast(input, n => n < 2);   // => 1
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#findlastobject-valueorpredicate
 */
export const findLast: typeof Objects.findLast;
/**
 * Returns the path to the first deep match during depth-first traversal.
 *
 * Shared/circular containers expand once; the root is excluded. Traversal boundaries retain their
 * property-edge semantics. Traversal is pre-order depth-first, visits own enumerable string/symbol
 * properties and expands only arrays/plain records below the root. See deep traversal rules.
 *
 * @param object The input root whose own enumerable properties are traversed.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
 * to `undefined`.
 * @returns A fresh array of string/symbol path segments, or `undefined`.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for invalid options, depths or descent callbacks.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.findPath(input, 1);    // => ['a', 'n']
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#findpathobject-valueorpredicate-options
 */
export const findPath: typeof Objects.findPath;
/**
 * Visits each own enumerable property and returns the original object.
 *
 * Does not itself write to the input; callbacks may do so. Own enumerable strings are visited before
 * symbols; inherited properties are excluded. Snapshot keys are fixed, deleted properties are
 * skipped and values are read when visited.
 *
 * @param object The input object or value.
 * @param callback Called with `(value, key, object)` and `this` bound to the input. Results are not
 * awaited.
 * @returns The original object; callback results are ignored.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection or required callback.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.forEach(input, () => undefined);   // => { a: 1, b: 2, c: 1 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#foreachobject-callback
 */
export const forEach: typeof Objects.forEach;
/**
 * Returns a value at an own-property path, using a default when it is missing or `undefined`.
 *
 * Preserves `null`. Reads each own path step once; does not traverse primitive properties. The empty
 * string names the empty-string property.
 *
 * @param object The input object or value.
 * @param path A string, symbol, safe integer or array of those keys. String paths support dot and
 * quoted/numeric bracket syntax.
 * @param [defaultValue] The fallback for missing or `undefined` path values; preserves `null`.
 * Defaults to `undefined`.
 * @returns The observed value, or the default for a missing/`undefined` value. An empty path array
 * returns the original root.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid path or key; malformed string syntax is rejected with
 * `SyntaxError`.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.get(input, 'a.n');     // => 1
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#getobject-path-defaultvalue
 */
export const get: typeof Objects.get;
/**
 * Returns values at several own-property paths in the supplied order.
 *
 * Validates the complete path list before reading values. Paths can repeat. Defaults replace
 * missing/`undefined` values, not `null`.
 *
 * @param object The input object or value.
 * @param paths An actual array of paths, processed in list order.
 * @param [defaultValue] The fallback for missing or `undefined` path values; preserves `null`.
 * Defaults to `undefined`.
 * @returns A new array with one value or default per requested path.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid path or key; malformed string syntax is rejected with
 * `SyntaxError`.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.getEach(input, ['a.n', 'b', 'absent'], 9);   // => [1, 2, 9]
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#geteachobject-paths-defaultvalue
 */
export const getEach: typeof Objects.getEach;
/**
 * Determines whether an own-property path exists, even when its value is `undefined`.
 *
 * Includes non-enumerable properties. The terminal getter is not evaluated; intermediate getters can
 * run. `[]` identifies an object/function root; holes and inherited properties are absent.
 *
 * @param object The input object or value.
 * @param path A string, symbol, safe integer or array of those keys. String paths support dot and
 * quoted/numeric bracket syntax.
 * @returns `true` when the own path exists; otherwise `false`.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid path or key; malformed string syntax is rejected with
 * `SyntaxError`.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.has(input, 'a.n');     // => true
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#hasobject-path
 */
export const has: typeof Objects.has;
/**
 * Determines whether a value has an own enumerable property with a given key.
 *
 * Invalid key kinds and primitive inputs return `false` without coercion hooks. Does not evaluate
 * the property getter.
 *
 * @param object The input object or value.
 * @param key A string, symbol or safe integer literal key. Invalid key kinds return `false`.
 * @returns `true` if the property is own and enumerable; otherwise `false`.
 * @throws {TypeError} when a required argument is omitted.
 * @throws Errors from proxy traps propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.hasKey(input, 'a');    // => true
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#haskeyobject-key
 */
export const hasKey: typeof Objects.hasKey;
/**
 * Determines whether a value has an own property, including a non-enumerable property.
 *
 * Inherited properties, invalid key kinds and primitive inputs return `false`. Does not evaluate the
 * property getter.
 *
 * @param object The input object or value.
 * @param key A string, symbol or safe integer literal key. Invalid key kinds return `false`.
 * @returns `true` if the property exists on the value itself; otherwise `false`.
 * @throws {TypeError} when a required argument is omitted.
 * @throws Errors from proxy traps propagate.
 * @example
 * const input = Object.defineProperty({}, 'hidden', { value: 1 });
 * Objects.hasProp(input, 'hidden');  // => true
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#haspropobject-key
 */
export const hasProp: typeof Objects.hasProp;
/**
 * Determines whether an own enumerable property contains a matching value.
 *
 * `NaN` matches itself, signed zeros match and objects/functions compare by identity. Primitive
 * inputs return `false`. Own enumerable strings are visited before symbols; inherited properties are
 * excluded. Snapshot keys are fixed, deleted properties are skipped and values are read when
 * visited.
 *
 * @param object The input object or value.
 * @param value The literal value to match by SameValueZero.
 * @returns `true` if an observed value matches by SameValueZero; otherwise `false`.
 * @throws {TypeError} when a required argument is omitted.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.hasValue(input, 2);    // => true
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#hasvalueobject-value
 */
export const hasValue: typeof Objects.hasValue;
/**
 * Returns entries of the first object that occur in every other object.
 *
 * Compares values by SameValueZero. With no additional objects, still returns a new record. Own
 * enumerable strings are visited before symbols; inherited properties are excluded. Snapshot keys
 * are fixed, deleted properties are skipped and values are read when visited.
 *
 * @param object The input object or value.
 * @param others Additional source objects in argument order.
 * @returns A new record of matching own enumerable key/value pairs.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.intersect(input, { b: 2 });  // => { b: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#intersectobject-others
 */
export const intersect: typeof Objects.intersect;
/**
 * Returns the own enumerable string and symbol keys of a value.
 *
 * String keys follow `Object.keys` order, followed by symbols. Does not read property values.
 *
 * @param object The input object or value.
 * @returns A new array of keys, or `[]` for a primitive input.
 * @throws {TypeError} when a required argument is omitted.
 * @throws Errors from proxy traps propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.keys(input);           // => ['a', 'b', 'c']
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#keysobject
 */
export const keys: typeof Objects.keys;
/**
 * Creates an object or array by transforming each own enumerable value.
 *
 * Arrays retain length and holes. Values returned by callbacks are stored without awaiting them. Own
 * enumerable strings are visited before symbols; inherited properties are excluded. Snapshot keys
 * are fixed, deleted properties are skipped and values are read when visited.
 *
 * @param object The input object or value.
 * @param callback Called with `(value, key, object)` and `this` bound to the input. Results are not
 * awaited.
 * @returns A new container with the original keys and callback results.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection or required callback.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.map(input, n => n * 2);  // => { a: 2, b: 4, c: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#mapobject-callback
 */
export const map: typeof Objects.map;
/**
 * Creates a record by renaming own enumerable keys while retaining their values.
 *
 * Arrays become records. The last colliding key wins by default; `onCollision: 'throw'` rejects
 * collisions. Numeric results normalise to strings before collision checks. Own enumerable strings
 * are visited before symbols; inherited properties are excluded. Snapshot keys are fixed, deleted
 * properties are skipped and values are read when visited.
 *
 * @param object The input object or value.
 * @param callback Called with `(value, key, object)` and `this` bound to the input. Must return a
 * string, symbol or safe integer key.
 * @param [options] Optional settings; see key-mapping collision rules below. Unknown options throw.
 * Defaults to `undefined`.
 * @returns A new record with mapped keys and original value references.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection or required callback.
 * @throws {TypeError} for invalid options, invalid mapped keys or a forbidden collision.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.mapKeys(input, (_, k) => k.toUpperCase());   // => { A: 1, B: 2, C: 1 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#mapkeysobject-callback-options
 */
export const mapKeys: typeof Objects.mapKeys;
/**
 * Creates a shallow merged record, with later sources overriding earlier keys.
 *
 * Does not recursively merge nested values or mutate sources. Nested values remain references. Own
 * enumerable strings are visited before symbols; inherited properties are excluded. Snapshot keys
 * are fixed, deleted properties are skipped and values are read when visited.
 *
 * @param object The input object or value.
 * @param others Additional source objects in argument order.
 * @returns A new record containing the final value for each supplied own enumerable key.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.merge(input, { a: 9, d: 4 });  // => { a: 9, b: 2, c: 1, d: 4 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#mergeobject-others
 */
export const merge: typeof Objects.merge;
/**
 * Creates a record excluding selected own enumerable keys.
 *
 * Excluded getters are not evaluated. Retained getters are read once; reflection can still trigger
 * proxy traps. Own enumerable strings are visited before symbols; inherited properties are excluded.
 * Snapshot keys are fixed, deleted properties are skipped and values are read when visited.
 *
 * @param object The input object or value.
 * @param keys An actual array of literal keys, not paths; invalid keys throw.
 * @returns A new record of properties not excluded by the key list.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for an invalid key list.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.omit(input, ['b']);    // => { a: 1, c: 1 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#omitobject-keys
 */
export const omit: typeof Objects.omit;
/**
 * Creates a record containing requested own enumerable keys.
 *
 * The key list contains literal keys, not paths. Duplicate keys do not create duplicate result
 * properties. Requested keys are processed in list order, including duplicates. Each requested
 * property is checked when reached; properties added by earlier getters can therefore be selected.
 *
 * @param object The input object or value.
 * @param keys An actual array of literal keys, not paths; invalid keys throw.
 * @returns A new record of requested properties that were present.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for an invalid key list.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.pick(input, ['b']);    // => { b: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#pickobject-keys
 */
export const pick: typeof Objects.pick;
/**
 * Reduces own enumerable values to one accumulator in forward key order.
 *
 * Without an initial argument, the first visited value seeds the accumulator. Explicit `undefined`
 * is a supplied initial value. An empty input without an initial value throws. Own enumerable
 * strings are visited before symbols; inherited properties are excluded. Snapshot keys are fixed,
 * deleted properties are skipped and values are read when visited.
 *
 * @param object The input object or value.
 * @param reducer Called with `(accumulator, value, key, object)` and `this` bound to the input;
 * returns the next accumulator.
 * @param [initialValue] The initial accumulator. Explicit `undefined` counts as supplied. Defaults
 * to `first visited value when omitted`.
 * @returns The final accumulator, or the initial value for an empty input when one was supplied.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection or required callback.
 * @throws {TypeError} for empty input without an initial accumulator.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.reduce(input, (text, n) => text + n, '');  // => '121'
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#reduceobject-reducer-initialvalue
 */
export const reduce: typeof Objects.reduce;
/**
 * Reduces own enumerable values to one accumulator in reverse key order.
 *
 * Without an initial argument, the first visited value seeds the accumulator. Explicit `undefined`
 * is a supplied initial value. An empty input without an initial value throws. The complete
 * own-enumerable key list is visited in reverse, so symbols precede strings. Inherited properties
 * are excluded. Snapshot keys are fixed, deleted properties are skipped and values are read when
 * visited.
 *
 * @param object The input object or value.
 * @param reducer Called with `(accumulator, value, key, object)` and `this` bound to the input;
 * returns the next accumulator.
 * @param [initialValue] The initial accumulator. Explicit `undefined` counts as supplied. Defaults
 * to `first visited value when omitted`.
 * @returns The final accumulator, or the initial value for an empty input when one was supplied.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection or required callback.
 * @throws {TypeError} for empty input without an initial accumulator.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 3 };
 * Objects.reduceRight(input, (text, n) => text + n, '');   // => '321'
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#reducerightobject-reducer-initialvalue
 */
export const reduceRight: typeof Objects.reduceRight;
/**
 * Removes the first own enumerable match in place and returns its previous value.
 *
 * Deletion uses configurability, not writability, and leaves array holes. Visits keys in forward
 * order. Earlier writes and user side effects are not rolled back after errors. Own enumerable
 * strings are visited before symbols; inherited properties are excluded. Snapshot keys are fixed,
 * deleted properties are skipped and values are read when visited.
 *
 * @param object The input object to update in place.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @returns The previous matching value, or `undefined` when no property matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} when a matched property is non-configurable and cannot be deleted.
 * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
 * rolled back.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.remove(input, 1);      // => 1
 * input;                         // => { b: 2, c: 1 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#removeobject-valueorpredicate
 */
export const remove: typeof Objects.remove;
/**
 * Removes all selected own enumerable matches in place and returns their previous values.
 *
 * Deletion uses configurability, not writability, and leaves array holes. Visits keys in forward
 * order. Earlier writes and user side effects are not rolled back after errors. Own enumerable
 * strings are visited before symbols; inherited properties are excluded. Snapshot keys are fixed,
 * deleted properties are skipped and values are read when visited.
 *
 * @param object The input object to update in place.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @returns A new array of previous values in traversal order, or `[]` when nothing matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} when a matched property is non-configurable and cannot be deleted.
 * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
 * rolled back.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.removeAll(input, 1);   // => [1, 1]
 * input;                         // => { b: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#removeallobject-valueorpredicate
 */
export const removeAll: typeof Objects.removeAll;
/**
 * Removes the last own enumerable match in place and returns its previous value.
 *
 * Deletion uses configurability, not writability, and leaves array holes. Visits keys in reverse
 * order. Earlier writes and user side effects are not rolled back after errors. The complete
 * own-enumerable key list is visited in reverse, so symbols precede strings. Inherited properties
 * are excluded. Snapshot keys are fixed, deleted properties are skipped and values are read when
 * visited.
 *
 * @param object The input object to update in place.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @returns The previous matching value, or `undefined` when no property matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} when a matched property is non-configurable and cannot be deleted.
 * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
 * rolled back.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.removeLast(input, 1);  // => 1
 * input;                         // => { a: 1, b: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#removelastobject-valueorpredicate
 */
export const removeLast: typeof Objects.removeLast;
/**
 * Replaces the first own enumerable match in place and returns its previous value.
 *
 * A replacement function is called with the normal callback arguments; return a function from it to
 * store function data. Accessor replacement is rejected. Visits keys in forward order. Earlier
 * writes and user side effects are not rolled back after errors. Own enumerable strings are visited
 * before symbols; inherited properties are excluded. Snapshot keys are fixed, deleted properties are
 * skipped and values are read when visited.
 *
 * @param object The input object to update in place.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @param replacement A literal or synchronous replacement callback. Return a function from a
 * callback to store function data. Typed replacements must fit the matched destinations.
 * @returns The previous matching value, or `undefined` when no property matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} when a matched property is an accessor, is non-writable or cannot be written
 * to the destination.
 * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
 * rolled back.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.replace(input, 1, 7);  // => 1
 * input;                         // => { a: 7, b: 2, c: 1 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#replaceobject-valueorpredicate-replacement
 */
export const replace: typeof Objects.replace;
/**
 * Replaces all selected own enumerable matches in place and returns their previous values.
 *
 * A replacement function is called with the normal callback arguments; return a function from it to
 * store function data. Accessor replacement is rejected. Visits keys in forward order. Earlier
 * writes and user side effects are not rolled back after errors. Own enumerable strings are visited
 * before symbols; inherited properties are excluded. Snapshot keys are fixed, deleted properties are
 * skipped and values are read when visited.
 *
 * @param object The input object to update in place.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @param replacement A literal or synchronous replacement callback. Return a function from a
 * callback to store function data. Typed replacements must fit the matched destinations.
 * @returns A new array of previous values in traversal order, or `[]` when nothing matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} when a matched property is an accessor, is non-writable or cannot be written
 * to the destination.
 * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
 * rolled back.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.replaceAll(input, 1, 7);   // => [1, 1]
 * input;                             // => { a: 7, b: 2, c: 7 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#replaceallobject-valueorpredicate-replacement
 */
export const replaceAll: typeof Objects.replaceAll;
/**
 * Replaces the last own enumerable match in place and returns its previous value.
 *
 * A replacement function is called with the normal callback arguments; return a function from it to
 * store function data. Accessor replacement is rejected. Visits keys in reverse order. Earlier
 * writes and user side effects are not rolled back after errors. The complete own-enumerable key
 * list is visited in reverse, so symbols precede strings. Inherited properties are excluded.
 * Snapshot keys are fixed, deleted properties are skipped and values are read when visited.
 *
 * @param object The input object to update in place.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @param replacement A literal or synchronous replacement callback. Return a function from a
 * callback to store function data. Typed replacements must fit the matched destinations.
 * @returns The previous matching value, or `undefined` when no property matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} when a matched property is an accessor, is non-writable or cannot be written
 * to the destination.
 * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
 * rolled back.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.replaceLast(input, 1, 7);  // => 1
 * input;                             // => { a: 1, b: 2, c: 7 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#replacelastobject-valueorpredicate-replacement
 */
export const replaceLast: typeof Objects.replaceLast;
/**
 * Sets a value at an own-property path and returns its previous value.
 *
 * Mutates the input. Stores functions and other supplied values as data. Creates missing/`undefined`
 * intermediates, but does not replace `null` or primitive intermediates.
 *
 * @param object The input object to update in place.
 * @param path A string, symbol, safe integer or array of those keys. String paths support dot and
 * quoted/numeric bracket syntax.
 * @param value The literal value to store; typed writes must satisfy the selected path.
 * @returns The previous final value, or `undefined` when the property was absent.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for an invalid path or key; malformed string syntax is rejected with
 * `SyntaxError`.
 * @throws {RangeError} for an empty mutation path; `TypeError` for unsafe path segments, unsupported
 * containers or forbidden writes.
 * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
 * rolled back.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.set(input, 'a.n', 7);  // => 1
 * input;                         // => { a: { n: 7 }, b: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#setobject-path-value
 */
export const set: typeof Objects.set;
/**
 * Sets the same value at several own-property paths and returns their previous values.
 *
 * Mutates the input and stores one shared value/reference. Validates all paths before the first
 * write, but a later runtime failure does not roll back earlier writes.
 *
 * @param object The input object to update in place.
 * @param paths An actual array of paths, processed in list order.
 * @param value The literal value to store; typed writes must satisfy the selected path.
 * @returns A new array of previous values in path-list order; absent final properties contribute
 * `undefined`.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for an invalid path or key; malformed string syntax is rejected with
 * `SyntaxError`.
 * @throws {RangeError} for an empty mutation path; `TypeError` for unsafe path segments, unsupported
 * containers or forbidden writes.
 * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
 * rolled back.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.setEach(input, ['a.n', 'b'], 7);   // => [1, 2]
 * input;                                     // => { a: { n: 7 }, b: 7 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#seteachobject-paths-value
 */
export const setEach: typeof Objects.setEach;
/**
 * Determines whether any own enumerable property matches a value or predicate.
 *
 * Stops callbacks and value reads after the first match; keys are snapshotted before searching. Own
 * enumerable strings are visited before symbols; inherited properties are excluded. Snapshot keys
 * are fixed, deleted properties are skipped and values are read when visited.
 *
 * @param object The input object or value.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @returns `true` when a property matches; otherwise `false`, including for an empty input.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.some(input, 2);        // => true
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#someobject-valueorpredicate
 */
export const some: typeof Objects.some;
/**
 * Removes an own property at a path without shifting array indexes.
 *
 * Mutates the input. Missing, `null` or scalar intermediate branches count as absent. Array index
 * deletion leaves a hole and retains length. Does not create containers. A configurable terminal
 * accessor can be deleted without evaluating its getter; intermediate accessors remain forbidden.
 *
 * @param object The input object to update in place.
 * @param path A string, symbol, safe integer or array of those keys. String paths support dot and
 * quoted/numeric bracket syntax.
 * @returns `true` when deletion succeeds or the path is already absent.
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
export const unset: typeof Objects.unset;
/**
 * Updates an own-property path by calling an updater once with its previous value.
 *
 * Mutates the input. Validates the path and destination before calling `updater(previousValue)`.
 * Missing parents are attached only after it returns. Rechecks write restrictions after callback
 * side effects. Returned functions or promises are stored, not invoked or awaited.
 *
 * @param object The input object to update in place.
 * @param path A string, symbol, safe integer or array of those keys. String paths support dot and
 * quoted/numeric bracket syntax.
 * @param updater Called once with the previous value; returns the replacement without awaiting it.
 * Avoid mutating the input in the callback.
 * @returns The value observed before invoking the updater, or `undefined` when the property was
 * absent.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection or required callback.
 * @throws {TypeError} for an invalid path or key; malformed string syntax is rejected with
 * `SyntaxError`.
 * @throws {RangeError} for an empty mutation path; `TypeError` for unsafe path segments, unsupported
 * containers or forbidden writes.
 * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
 * rolled back.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.update(input, 'a.n', n => n + 1);  // => 1
 * input;                                     // => { a: { n: 2 }, b: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#updateobject-path-updater
 */
export const update: typeof Objects.update;
/**
 * Returns the values of own enumerable string and symbol properties.
 *
 * Own enumerable strings are visited before symbols; inherited properties are excluded. Snapshot
 * keys are fixed, deleted properties are skipped and values are read when visited.
 *
 * @param object The input object or value.
 * @returns A new array of observed values in key order, or `[]` for a primitive input.
 * @throws {TypeError} when a required argument is omitted.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.values(input);         // => [1, 2, 1]
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#valuesobject
 */
export const values: typeof Objects.values;
/**
 * Creates an updated root by setting one path without writing to the input.
 *
 * Copies only containers along the path; untouched branches retain identity. Supports frozen
 * ordinary records and arrays. Off-path aliases and cycles still refer to the original graph. Stores
 * the supplied value by reference, including functions. Missing/undefined containers can be created
 * for setting; accessors, array length edits, custom instances and unsupported array prototypes are
 * rejected.
 *
 * @param object The input object or value.
 * @param path A string, symbol, safe integer or array of those keys. String paths support dot and
 * quoted/numeric bracket syntax.
 * @param value The literal value to store by reference. Its type determines the updated result type;
 * schema changes are allowed.
 * @returns The updated root, or the original root for an existing value unchanged by `Object.is`.
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
export const setImmutable: typeof Objects.setImmutable;
/**
 * Creates an updated root by computing a path value without writing to the input.
 *
 * Copies only containers along the path; untouched branches retain identity. Supports frozen
 * ordinary records and arrays. Off-path aliases and cycles still refer to the original graph. Calls
 * the updater once and stores its result without awaiting it. Callback/proxy side effects are not
 * rolled back. Missing/undefined containers can be created for setting; accessors, array length
 * edits, custom instances and unsupported array prototypes are rejected.
 *
 * @param object The input object or value.
 * @param path A string, symbol, safe integer or array of those keys. String paths support dot and
 * quoted/numeric bracket syntax.
 * @param updater Called once with the previous value; returns the replacement without awaiting it.
 * Avoid mutating the input in the callback.
 * @returns The updated root, or the original root for an existing value unchanged by `Object.is`.
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
export const updateImmutable: typeof Objects.updateImmutable;
/**
 * Creates an updated root without one own property, leaving the input unchanged.
 *
 * Copies only containers along the path; untouched branches retain identity. Supports frozen
 * ordinary records and arrays. Off-path aliases and cycles still refer to the original graph. Array
 * index deletion leaves a hole. Existing `null` or scalar intermediates throw, unlike mutating
 * `unset`. Missing/undefined containers can be created for setting; accessors, array length edits,
 * custom instances and unsupported array prototypes are rejected.
 *
 * @param object The input object or value.
 * @param path A string, symbol, safe integer or array of those keys. String paths support dot and
 * quoted/numeric bracket syntax.
 * @returns The updated root, or the original root for an absent path.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for an invalid path or key; malformed string syntax is rejected with
 * `SyntaxError`.
 * @throws {RangeError} for an empty mutation path; `TypeError` for unsafe path segments, unsupported
 * containers or forbidden writes.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.unsetImmutable(input, ['a', 'n']);   // => { a: {}, b: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#unsetimmutableobject-path
 */
export const unsetImmutable: typeof Objects.unsetImmutable;
/**
 * Returns the path and observed value of the first deep match during depth-first traversal.
 *
 * Captures the independent path and value at the match without rereading the getter. Shared/circular
 * containers expand once; the root is excluded. Traversal boundaries retain their property-edge
 * semantics. Traversal is pre-order depth-first, visits own enumerable string/symbol properties and
 * expands only arrays/plain records below the root. See deep traversal rules.
 *
 * @param object The input root whose own enumerable properties are traversed.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
 * to `undefined`.
 * @returns A `[pathSegments, observedValue]` pair, or `undefined` when no property matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for invalid options, depths or descent callbacks.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.deepFindEntry(input, 1);   // => [['a', 'n'], 1]
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepfindentryobject-valueorpredicate-options
 */
export const deepFindEntry: typeof Objects.deepFindEntry;
