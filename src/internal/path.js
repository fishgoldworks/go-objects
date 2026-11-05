'use strict';
const c = require('./common');
const unsafe = new Set(['__proto__', 'constructor', 'prototype']);

function parseUncached(path) {
  if (Array.isArray(path)) return Array.from(path, c.keyOf);
  if (typeof path === 'symbol' || typeof path === 'number') return [c.keyOf(path)];
  if (typeof path !== 'string') throw new TypeError('Expected a path string, property key or segment array.');
  if (path === '') return [''];
  // Dot-only paths need no bracket/escape state machine. Native delimiter
  // scanning avoids per-character work and the full parser's closures.
  if (!path.includes('[') && !path.includes(']')) {
    const segments = [];
    let start = 0,
      end;
    while ((end = path.indexOf('.', start)) !== -1) {
      if (end === start) throw new SyntaxError('Invalid property path at position ' + start + '.');
      segments.push(path.slice(start, end));
      start = end + 1;
    }
    if (start === path.length) throw new SyntaxError('Invalid property path at position ' + start + '.');
    segments.push(path.slice(start));
    return segments;
  }
  const result = [];
  let i = 0;
  const fail = () => {
    throw new SyntaxError('Invalid property path at position ' + i + '.');
  };
  function identifier() {
    const start = i;
    while (i < path.length && path[i] !== '.' && path[i] !== '[' && path[i] !== ']') i++;
    if (start === i) fail();
    result.push(path.slice(start, i));
  }
  function bracket() {
    i++;
    while (/\s/.test(path[i] || '') && i < path.length) i++;
    const quote = path[i];
    let value = '';
    if (quote === '"' || quote === "'") {
      i++;
      let closed = false;
      while (i < path.length) {
        let char = path[i++];
        if (char === quote) {
          closed = true;
          break;
        }
        if (char === '\\') {
          if (i >= path.length) fail();
          char = path[i++];
          const escapes = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v' };
          if (char === 'u') {
            const hex = path.slice(i, i + 4);
            if (!/^[\da-f]{4}$/i.test(hex)) fail();
            value += String.fromCharCode(parseInt(hex, 16));
            i += 4;
          } else if (c.own(escapes, char)) value += escapes[char];
          else if (char === '\\' || char === '"' || char === "'") value += char;
          else fail();
        } else {
          if (char.charCodeAt(0) < 32) fail();
          value += char;
        }
      }
      if (!closed) fail();
    } else {
      const start = i;
      while (i < path.length && path[i] !== ']') i++;
      value = path.slice(start, i).trim();
      if (!/^-?(0|[1-9]\d*)$/.test(value) || !Number.isSafeInteger(Number(value))) fail();
      value = String(Number(value));
    }
    while (/\s/.test(path[i] || '') && i < path.length) i++;
    if (path[i++] !== ']') fail();
    result.push(value);
  }
  if (path[i] === '[') bracket();
  else identifier();
  while (i < path.length) {
    if (path[i] === '[') bracket();
    else if (path[i] === '.') {
      i++;
      identifier();
    } else fail();
  }
  return result;
}
// Cache syntax, never target values or user-owned arrays. A fixed-size direct
// cache avoids Map churn for streams of distinct paths. Full strings are checked
// on every hit: hash collisions affect hit rate, not correctness. Long paths are
// not retained. Compiled segments stay private; exported parser helpers copy them.
const MAX_CACHED_LENGTH = 256;
const parsedStrings = new Array(256).fill(undefined);
let lastParsed;
function compile(path) {
  if (typeof path !== 'string' || path.length > MAX_CACHED_LENGTH) return parseUncached(path);
  if (lastParsed !== undefined && lastParsed.path === path) return lastParsed.segments;
  const length = path.length;
  const slot =
    (length ^
      (path.charCodeAt(length - 1) << 1) ^
      (path.charCodeAt(length - 2) << 3) ^
      (path.charCodeAt(length >>> 1) << 5) ^
      path.charCodeAt(0)) &
    255;
  const cached = parsedStrings[slot];
  if (cached !== undefined && cached.path === path) {
    lastParsed = cached;
    return cached.segments;
  }
  // Materialise the short string before retaining it. A small slice can keep
  // a much larger source string alive; segments must derive from this copy too.
  path = path.split('').join('');
  const segments = parseUncached(path); // Invalid syntax is never cached.
  lastParsed = { path, segments };
  parsedStrings[slot] = lastParsed;
  return segments;
}
function parse(path) {
  // Callers of the parser helpers may mutate their results. Read APIs use the
  // private compiler directly and never expose or alter its segment arrays.
  if (typeof path !== 'string' || path.length > MAX_CACHED_LENGTH) return parseUncached(path);
  return compile(path).slice();
}
function mutablePath(path) {
  const segments = parse(path);
  if (!segments.length) throw new RangeError('An empty segment array cannot be mutated.');
  for (const key of segments) if (unsafe.has(key)) throw new TypeError('Unsafe mutation path segment: ' + key);
  return segments;
}
function read(obj, segments, defaultValue) {
  let value = obj;
  for (const key of segments) {
    if (!c.isObject(value) || !c.own(value, key)) return defaultValue;
    value = value[key];
  }
  return value === undefined && segments.length ? defaultValue : value;
}
function get(obj, path, defaultValue) {
  return read(obj, compile(path), defaultValue);
}
/** Test own-path existence without evaluating the terminal property's getter. */
function has(obj, path) {
  const segments = compile(path);
  if (!segments.length) return c.isObject(obj);
  let node = obj;
  for (let i = 0; i < segments.length; i++) {
    if (!c.isObject(node) || !c.own(node, segments[i])) return false;
    if (i === segments.length - 1) return true;
    node = node[segments[i]];
  }
}
function assertMutable(value) {
  // Records with custom prototypes are allowed. Functions are never path containers.
  if (value === null || typeof value !== 'object') throw new TypeError('Expected an object path container.');
}
function dataDescriptor(obj, key) {
  const descriptor = Object.getOwnPropertyDescriptor(obj, key);
  if (descriptor && !c.own(descriptor, 'value'))
    throw new TypeError('Mutation paths cannot traverse or replace accessors.');
  return descriptor;
}
function setSegments(obj, segments, value) {
  assertMutable(obj);
  let node = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    const key = segments[i],
      desc = dataDescriptor(node, key);
    if (!desc || desc.value === undefined) {
      const next = c.indexKey(segments[i + 1]) ? [] : {};
      c.writeData(node, key, next);
      node = next;
    } else {
      assertMutable(desc.value);
      node = desc.value;
    }
  }
  const key = segments[segments.length - 1],
    desc = dataDescriptor(node, key);
  const previous = desc ? desc.value : undefined;
  c.writeData(node, key, value);
  return previous;
}
function set(obj, path, value) {
  c.requireArgs(arguments, 3);
  return setSegments(obj, mutablePath(path), value);
}
function assertWritableSlot(node, key, descriptor) {
  if (descriptor ? !descriptor.writable : !Object.isExtensible(node)) {
    throw new TypeError('Cannot write a non-writable or non-extensible destination.');
  }
  // Creating an out-of-range array index also changes length.
  if (
    Array.isArray(node) &&
    c.indexKey(key) &&
    Number(key) >= node.length &&
    !Object.getOwnPropertyDescriptor(node, 'length').writable
  ) {
    throw new TypeError('Cannot extend an array with non-writable length.');
  }
}
/** Compute a replacement once; do not attach missing parents before user code. */
function update(obj, path, updater) {
  const segments = mutablePath(path);
  c.assertFunction(updater);
  assertMutable(obj);
  let node = obj,
    previous;
  for (let i = 0; i < segments.length; i++) {
    const key = segments[i],
      desc = dataDescriptor(node, key);
    if (i === segments.length - 1 || !desc || desc.value === undefined) {
      assertWritableSlot(node, key, desc);
      previous = i === segments.length - 1 && desc ? desc.value : undefined;
      break;
    }
    assertMutable(desc.value);
    node = desc.value;
  }
  const next = updater(previous);
  // User code can change the destination. Revalidate descriptors while writing;
  // side effects performed by callbacks or proxies are not transactional.
  setSegments(obj, segments, next);
  return previous;
}
function unset(obj, path) {
  const segments = mutablePath(path);
  assertMutable(obj);
  let node = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    const desc = dataDescriptor(node, segments[i]);
    if (!desc || desc.value === undefined || desc.value === null) return true;
    if (typeof desc.value !== 'object') return true;
    node = desc.value;
  }
  if (!Reflect.deleteProperty(node, segments[segments.length - 1]))
    throw new TypeError('Cannot delete a non-configurable property.');
  return true;
}
function pathsList(paths, convert) {
  if (!Array.isArray(paths)) throw new TypeError('Expected an array of paths.');
  return Array.from(paths, convert);
}
function getEach(obj, paths, defaultValue) {
  return pathsList(paths, compile).map((path) => read(obj, path, defaultValue));
}
function setEach(obj, paths, value) {
  c.requireArgs(arguments, 3);
  const list = pathsList(paths, mutablePath);
  assertMutable(obj);
  return list.map((path) => setSegments(obj, path, value));
}
module.exports = { get, has, set, update, unset, getEach, setEach, parse, mutablePath };
