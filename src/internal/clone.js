'use strict';
const c = require('./common');
const fnSource = Function.prototype.toString;
const bufferLength = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength').get;
const bufferResizable = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;
const typedProto = Object.getPrototypeOf(Uint8Array.prototype);
const typedGet = (name) => Object.getOwnPropertyDescriptor(typedProto, name).get;
const typedBuffer = typedGet('buffer'),
  typedOffset = typedGet('byteOffset'),
  typedLength = typedGet('length');
const dataGet = (name) => Object.getOwnPropertyDescriptor(DataView.prototype, name).get;
const dataBuffer = dataGet('buffer'),
  dataOffset = dataGet('byteOffset'),
  dataLength = dataGet('byteLength');
const mapSize = Object.getOwnPropertyDescriptor(Map.prototype, 'size').get;
const setSize = Object.getOwnPropertyDescriptor(Set.prototype, 'size').get;
const builtins = {
  Date,
  RegExp,
  Map,
  Set,
  Boolean,
  Number,
  String,
  Symbol,
  ArrayBuffer,
  DataView,
  Error,
  EvalError,
  RangeError,
  ReferenceError,
  SyntaxError,
  TypeError,
  URIError,
  Int8Array,
  Uint8Array,
  Uint8ClampedArray,
  Int16Array,
  Uint16Array,
  Int32Array,
  Uint32Array,
  Float32Array,
  Float64Array
};
// Register optional native types only when the host supplies them.
if (typeof BigInt !== 'undefined') builtins.BigInt = BigInt;
if (typeof BigInt64Array !== 'undefined') builtins.BigInt64Array = BigInt64Array;
if (typeof BigUint64Array !== 'undefined') builtins.BigUint64Array = BigUint64Array;
if (typeof AggregateError !== 'undefined') builtins.AggregateError = AggregateError;
if (typeof Float16Array !== 'undefined') builtins.Float16Array = Float16Array;
// Cache trusted constructor identities, not classifications of mutable user
// objects/prototypes. Other realms still use the original source comparison.
const nativeKinds = new Map(Object.entries(builtins).map(([name, fn]) => [fn, name]));
const nativeSources = new Map(Object.entries(builtins).map(([name, fn]) => [fnSource.call(fn), name]));
const typedNames = new Set(Object.keys(builtins).filter((name) => name.endsWith('Array') && name !== 'ArrayBuffer'));
const errors = new Set([
  'Error',
  'EvalError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'TypeError',
  'URIError',
  'AggregateError'
]);

function optionsOf(options) {
  if (options === undefined) return 'reference';
  if (!c.isPlainRecord(options)) throw new TypeError('Expected clone options.');
  for (const key of Reflect.ownKeys(options)) if (key !== 'unsupported') throw new TypeError('Unknown clone option.');
  const policy = c.own(options, 'unsupported') ? options.unsupported : 'reference';
  if (policy !== 'reference' && policy !== 'throw') throw new TypeError('unsupported must be reference or throw.');
  return policy;
}
function nativePrototypeKind(proto) {
  if (!proto) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'constructor');
  if (!descriptor || typeof descriptor.value !== 'function') return undefined;
  const kind = nativeKinds.get(descriptor.value) || nativeSources.get(fnSource.call(descriptor.value));
  if (!kind) return undefined;
  const prototype = Object.getOwnPropertyDescriptor(descriptor.value, 'prototype');
  return prototype && prototype.value === proto ? kind : undefined;
}
function kindOf(value) {
  if (Array.isArray(value)) {
    const proto = Object.getPrototypeOf(value);
    if (proto === null) return 'Array';
    return c.isNativeArrayPrototype(proto) ? 'Array' : undefined;
  }
  if (c.isPlainRecord(value)) return 'Object';
  if (typeof value === 'function') return undefined;
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
    return Object.getPrototypeOf(value) === Buffer.prototype ? 'Buffer' : undefined;
  }
  return nativePrototypeKind(Object.getPrototypeOf(value));
}
function fixedBuffer(value) {
  // Intrinsic getters brand-check the buffer and do not read user-defined properties.
  try {
    bufferLength.call(value);
    return !bufferResizable || !bufferResizable.call(value);
  } catch {
    return false;
  } // SharedArrayBuffer is intentionally an unsupported reference.
}
function copyBuffer(value) {
  const copy = new ArrayBuffer(bufferLength.call(value));
  new Uint8Array(copy).set(new Uint8Array(value));
  return copy;
}
function genuineError(value) {
  // Error has no standard brand-checking getter/method. Object#toString is the
  // portable observable for [[ErrorData]], but @@toStringTag can spoof it.
  // Treat tagged Errors as opaque rather than guessing whether they are genuine.
  // Reflection/trap failures intentionally propagate, matching the rest of cloning.
  const inspected = new Set();
  for (let node = value; node !== null; node = Object.getPrototypeOf(node)) {
    // Tags inherited beyond the immediate native prototype also override the
    // intrinsic brand. Inspect descriptors without evaluating user getters.
    // A Proxy can report a cyclic prototype chain; treat it as unsupported.
    if (inspected.has(node) || Object.getOwnPropertyDescriptor(node, Symbol.toStringTag)) return false;
    inspected.add(node);
  }
  return Object.prototype.toString.call(value) === '[object Error]';
}

function regexState(value) {
  const source = Object.getOwnPropertyDescriptor(RegExp.prototype, 'source').get.call(value);
  let flags = '';
  for (const [property, flag] of [
    ['hasIndices', 'd'],
    ['global', 'g'],
    ['ignoreCase', 'i'],
    ['multiline', 'm'],
    ['dotAll', 's'],
    ['unicode', 'u'],
    ['unicodeSets', 'v'],
    ['sticky', 'y']
  ]) {
    const getter = Object.getOwnPropertyDescriptor(RegExp.prototype, property)?.get;
    if (getter && getter.call(value)) flags += flag;
  }
  return { source, flags };
}

/** Iterative graph copy: register shells before visiting their properties or entries. */
function copyGraph(value, deep, options) {
  const policy = optionsOf(options);
  if (!c.isObject(value)) return value;
  const copies = new WeakMap(),
    pending = [];
  function unsupported(input) {
    if (policy === 'throw') throw new TypeError('Unsupported object type for cloning.');
    return input;
  }
  function allocate(input) {
    if (!c.isObject(input)) return input;
    if (copies.has(input)) return copies.get(input);
    const kind = kindOf(input);
    let output, nativeStackGetter;
    if (!kind) return unsupported(input);
    if (kind === 'Object') output = Object.create(Object.getPrototypeOf(input));
    else if (kind === 'Array') {
      output = new Array(input.length);
      // Removing an array's prototype does not remove its native array state.
      if (Object.getPrototypeOf(input) === null) Object.setPrototypeOf(output, null);
    } else if (kind === 'Date') {
      let state;
      try {
        state = Date.prototype.getTime.call(input);
      } catch {
        return unsupported(input);
      }
      output = new Date(state);
    } else if (kind === 'RegExp') {
      let state;
      try {
        state = regexState(input);
      } catch {
        return unsupported(input);
      }
      output = new RegExp(state.source, state.flags);
    } else if (kind === 'Map') {
      try {
        mapSize.call(input);
      } catch {
        return unsupported(input);
      }
      output = new Map();
    } else if (kind === 'Set') {
      try {
        setSize.call(input);
      } catch {
        return unsupported(input);
      }
      output = new Set();
    } else if (kind === 'Boolean') {
      let state;
      try {
        state = Boolean.prototype.valueOf.call(input);
      } catch {
        return unsupported(input);
      }
      output = new Boolean(state);
    } else if (kind === 'Number') {
      let state;
      try {
        state = Number.prototype.valueOf.call(input);
      } catch {
        return unsupported(input);
      }
      output = new Number(state);
    } else if (kind === 'String') {
      let state;
      try {
        state = String.prototype.valueOf.call(input);
      } catch {
        return unsupported(input);
      }
      output = new String(state);
    } else if (kind === 'BigInt') {
      let state;
      try {
        state = BigInt.prototype.valueOf.call(input);
      } catch {
        return unsupported(input);
      }
      output = Object(state);
    } else if (kind === 'Symbol') {
      let state;
      try {
        state = Symbol.prototype.valueOf.call(input);
      } catch {
        return unsupported(input);
      }
      output = Object(state);
    } else if (kind === 'ArrayBuffer') {
      if (!fixedBuffer(input)) return unsupported(input);
      output = copyBuffer(input);
    } else if (kind === 'DataView' || kind === 'Buffer' || typedNames.has(kind)) {
      const isData = kind === 'DataView';
      let buffer;
      try {
        buffer = (isData ? dataBuffer : typedBuffer).call(input);
      } catch {
        return unsupported(input);
      }
      const fixed = fixedBuffer(buffer);
      if (isData && !fixed) {
        // Resizing can put an attached DataView out of bounds. Its offset/length
        // getters then throw, even though the whole view is an opaque reference.
        // A zero-length view distinguishes attached memory from detachment without
        // reading user properties or requiring the newer ArrayBuffer.detached API.
        new Uint8Array(buffer, 0, 0);
        return unsupported(input);
      }
      // Once the brand is established, preserve failures caused by a detached
      // backing buffer instead of reclassifying a once-valid view as opaque.
      const offset = (isData ? dataOffset : typedOffset).call(input);
      const length = (isData ? dataLength : typedLength).call(input);
      // A buffer subclass is opaque under the clone policy. Do not manufacture
      // a new view backed by that original writable memory (or an invalid shell).
      if (!fixed || kindOf(buffer) !== 'ArrayBuffer') return unsupported(input);
      const copiedBuffer = allocate(buffer);
      output = isData
        ? new DataView(copiedBuffer, offset, length)
        : kind === 'Buffer'
          ? Buffer.from(copiedBuffer, offset, length)
          : new builtins[kind](copiedBuffer, offset, length);
    } else if (errors.has(kind)) {
      if (!genuineError(input)) return unsupported(input);
      // Use only trusted builtin constructors to retain Error's native internal brand.
      // Remove the newly captured own state before restoring the source descriptors.
      const errorProto = Object.getPrototypeOf(input);
      const NativeError = errorProto && Object.getOwnPropertyDescriptor(errorProto, 'constructor')?.value;
      // Reflection can change between classification and allocation. Revalidate
      // the exact callable we are about to invoke, not an earlier descriptor.
      const errorPrototype =
        typeof NativeError === 'function' && Object.getOwnPropertyDescriptor(NativeError, 'prototype')?.value;
      if (
        typeof NativeError !== 'function' ||
        errorPrototype !== errorProto ||
        (nativeKinds.get(NativeError) || nativeSources.get(fnSource.call(NativeError))) !== kind
      ) {
        return unsupported(input);
      }
      output = kind === 'AggregateError' ? new NativeError([]) : new NativeError();
      nativeStackGetter = Object.getOwnPropertyDescriptor(output, 'stack')?.get;
      for (const key of Reflect.ownKeys(output)) Reflect.deleteProperty(output, key);
    }
    copies.set(input, output);
    pending.push({ input, output, kind, nativeStackGetter });
    return output;
  }
  const result = allocate(value);
  while (pending.length) {
    const { input, output, kind, nativeStackGetter } = pending.pop();
    if (kind === 'Map') {
      for (const [key, item] of Map.prototype.entries.call(input))
        Map.prototype.set.call(output, deep ? allocate(key) : key, deep ? allocate(item) : item);
    } else if (kind === 'Set') {
      for (const item of Set.prototype.values.call(input)) Set.prototype.add.call(output, deep ? allocate(item) : item);
    }
    for (const key of Reflect.ownKeys(input)) {
      // Typed array indexed state was already copied with its backing buffer.
      if ((kind === 'Buffer' || typedNames.has(kind)) && c.indexKey(key)) continue;
      let descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (!descriptor) continue; // Proxy traps may change the property set.
      // V8 stores stack state in internal slots, not in the accessor function.
      // Snapshot only the verified intrinsic accessor; custom accessors stay untouched.
      // Materializing a native stack may invoke Error.prepareStackTrace.
      if (key === 'stack' && nativeStackGetter && descriptor.get === nativeStackGetter) {
        descriptor = {
          value: nativeStackGetter.call(input),
          writable: !Object.isFrozen(input),
          enumerable: descriptor.enumerable,
          configurable: descriptor.configurable
        };
      }
      if (deep && c.own(descriptor, 'value')) descriptor.value = allocate(descriptor.value);
      Object.defineProperty(output, key, descriptor);
    }
    if (!Object.isExtensible(input)) Object.preventExtensions(output);
  }
  return result;
}
function clone(value, options) {
  c.requireArgs(arguments, 1);
  return copyGraph(value, false, options);
}
function deepClone(value, options) {
  c.requireArgs(arguments, 1);
  return copyGraph(value, true, options);
}
module.exports = { clone, deepClone };
