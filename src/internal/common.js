'use strict';

const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
// HTMLDDA host objects (document.all) report typeof 'undefined' but are not the
// undefined primitive. Strict identity checks preserve them without coercion.
const isObject = (value) =>
  value !== null &&
  (typeof value === 'object' || typeof value === 'function' || (typeof value === 'undefined' && value !== undefined));
// Legacy HTMLDDA collections are callable despite their unusual typeof result.
const isCallable = (value) => typeof value === 'function' || (typeof value === 'undefined' && value !== undefined);
const isKey = (key) =>
  typeof key === 'string' || typeof key === 'symbol' || (typeof key === 'number' && Number.isSafeInteger(key));
const sameValueZero = (a, b) => a === b || (a !== a && b !== b);

function requireArgs(args, minimum) {
  if (args.length < minimum) throw new TypeError('Expected at least ' + minimum + ' arguments.');
}
function assertObject(value) {
  if (!isObject(value)) throw new TypeError('Expected an object or array.');
}
function assertFunction(value) {
  if (!isCallable(value)) throw new TypeError('Expected a callback function.');
}
function keyOf(value) {
  if (!isKey(value)) throw new TypeError('Expected a string, symbol or safe integer property key.');
  return typeof value === 'symbol' ? value : String(value);
}
function keys(value) {
  requireArgs(arguments, 1);
  if (!isObject(value)) return [];
  const result = Object.keys(value);
  // Keep both reflective operations and their order (including Proxy traps),
  // without allocating a filtered-symbol array and a concatenated key array.
  for (const key of Object.getOwnPropertySymbols(value)) {
    if (Object.prototype.propertyIsEnumerable.call(value, key)) result.push(key);
  }
  return result;
}
function enumerable(value, key) {
  return (
    isObject(value) &&
    isKey(key) &&
    // Some browsers disagree with their own descriptors for HTMLDDA indexes.
    // Use the own descriptor for these host objects; retain ordinary trap order.
    (typeof value === 'undefined'
      ? Object.getOwnPropertyDescriptor(value, key)?.enumerable === true
      : Object.prototype.propertyIsEnumerable.call(value, key))
  );
}
function define(target, key, value) {
  Object.defineProperty(target, key, { value, writable: true, enumerable: true, configurable: true });
  return value;
}
function writeData(target, key, value) {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  if (!descriptor) return define(target, key, value);
  if (!own(descriptor, 'value') || !descriptor.writable)
    throw new TypeError('Cannot write an accessor or non-writable property.');
  Object.defineProperty(target, key, { ...descriptor, value });
  return value;
}
function record(value) {
  return Object.getPrototypeOf(value) === null ? Object.create(null) : {};
}
function shape(value) {
  return Array.isArray(value) ? new Array(value.length) : record(value);
}
function indexKey(key) {
  if (typeof key === 'symbol') return false;
  const n = Number(key);
  return Number.isInteger(n) && n >= 0 && n < 4294967295 && String(n) === String(key);
}
function matcher(valueOrPredicate) {
  return isCallable(valueOrPredicate) ? valueOrPredicate : (value) => sameValueZero(value, valueOrPredicate);
}
function collisionMode(options) {
  const mode = options !== undefined && own(options, 'onCollision') ? options.onCollision : 'overwrite';
  if (mode !== 'overwrite' && mode !== 'throw') throw new TypeError('onCollision must be "overwrite" or "throw".');
  return mode;
}
function keyList(list) {
  if (!Array.isArray(list)) throw new TypeError('Expected an array of property keys.');
  return Array.from(list, keyOf);
}
// Inspect constructors on prototypes, not user data's own `constructor` property.
// Only the native Object prototype of a realm (or null) makes a plain record.
// A custom prototype can advertise Object as its constructor without being native.
// Use descriptors so neither the input constructor nor a prototype getter is invoked.
const objectSource = Function.prototype.toString.call(Object);
const arraySource = Function.prototype.toString.call(Array);
function isPlainRecord(value) {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  if (proto === null || proto === Object.prototype) return true;
  const constructor = Object.getOwnPropertyDescriptor(proto, 'constructor');
  return (
    Object.getPrototypeOf(proto) === null &&
    !!constructor &&
    typeof constructor.value === 'function' &&
    Function.prototype.toString.call(constructor.value) === objectSource &&
    Object.getOwnPropertyDescriptor(constructor.value, 'prototype')?.value === proto
  );
}
function isNativeArrayPrototype(proto) {
  if (!proto || !Array.isArray(proto)) return false;
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'constructor');
  if (
    !descriptor ||
    typeof descriptor.value !== 'function' ||
    (descriptor.value !== Array && Function.prototype.toString.call(descriptor.value) !== arraySource)
  )
    return false;
  return Object.getOwnPropertyDescriptor(descriptor.value, 'prototype')?.value === proto;
}
const traversable = (value) => Array.isArray(value) || isPlainRecord(value);

module.exports = {
  requireArgs,
  own,
  isObject,
  isCallable,
  isKey,
  sameValueZero,
  assertObject,
  assertFunction,
  keyOf,
  keys,
  enumerable,
  define,
  writeData,
  record,
  shape,
  indexKey,
  matcher,
  collisionMode,
  keyList,
  isPlainRecord,
  isNativeArrayPrototype,
  traversable
};
