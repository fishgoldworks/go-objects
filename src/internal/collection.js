'use strict';
const c = require('./common');

function values(obj) {
  c.requireArgs(arguments, 1);
  const result = [];
  for (const key of c.keys(obj)) if (c.enumerable(obj, key)) result.push(obj[key]);
  return result;
}
function entries(obj) {
  c.requireArgs(arguments, 1);
  const result = [];
  for (const key of c.keys(obj)) if (c.enumerable(obj, key)) result.push([key, obj[key]]);
  return result;
}
function hasKey(obj, key) {
  c.requireArgs(arguments, 2);
  return c.enumerable(obj, key);
}
function hasProp(obj, key) {
  c.requireArgs(arguments, 2);
  return c.isObject(obj) && c.isKey(key) && c.own(obj, key);
}
function hasValue(obj, value) {
  c.requireArgs(arguments, 2);
  for (const key of c.keys(obj)) if (c.enumerable(obj, key) && c.sameValueZero(obj[key], value)) return true;
  return false;
}

function forEach(obj, callback) {
  c.assertObject(obj);
  c.assertFunction(callback);
  // Invoke the callable itself; its own `call` property is unrelated user data.
  for (const key of c.keys(obj)) if (c.enumerable(obj, key)) Reflect.apply(callback, obj, [obj[key], key, obj]);
  return obj;
}
function map(obj, callback) {
  c.assertObject(obj);
  c.assertFunction(callback);
  const result = c.shape(obj);
  forEach(obj, (value, key) => c.define(result, key, Reflect.apply(callback, obj, [value, key, obj])));
  return result;
}
function mapKeys(obj, callback, options) {
  c.assertObject(obj);
  c.assertFunction(callback);
  if (options !== undefined) {
    if (!c.isPlainRecord(options)) throw new TypeError('Expected key-mapping options.');
    for (const key of Reflect.ownKeys(options))
      if (key !== 'onCollision') throw new TypeError('Unknown key-mapping option.');
  }
  const mode = c.collisionMode(options),
    result = c.record(obj);
  forEach(obj, (value, key) => {
    const nextKey = c.keyOf(Reflect.apply(callback, obj, [value, key, obj]));
    if (mode === 'throw' && c.own(result, nextKey)) throw new TypeError('Mapped key collision: ' + String(nextKey));
    c.define(result, nextKey, value);
  });
  return result;
}
function filter(obj, predicate) {
  c.assertObject(obj);
  c.assertFunction(predicate);
  const result = Array.isArray(obj) ? [] : c.record(obj);
  forEach(obj, (value, key) => {
    if (Reflect.apply(predicate, obj, [value, key, obj])) {
      c.define(result, Array.isArray(result) && c.indexKey(key) ? result.length : key, value);
    }
  });
  return result;
}
function search(obj, valueOrPredicate, mode) {
  c.assertObject(obj);
  const predicate = c.matcher(valueOrPredicate);
  const list = c.keys(obj);
  if (mode === 'last') list.reverse();
  const found = [];
  let count = 0;
  for (const key of list) {
    if (!c.enumerable(obj, key)) continue;
    const value = obj[key];
    if (!Reflect.apply(predicate, obj, [value, key, obj])) continue;
    if (mode === 'count') count++;
    else if (mode === 'all') found.push(value);
    else return mode === 'key' ? key : mode === 'entry' ? [key, value] : value;
  }
  return mode === 'count' ? count : mode === 'all' ? found : undefined;
}
function assertMatcher(supplied) {
  if (!supplied) throw new TypeError('Expected a value or predicate argument.');
}
function quantify(obj, match, all) {
  c.assertObject(obj);
  const predicate = c.matcher(match);
  for (const key of c.keys(obj)) {
    if (!c.enumerable(obj, key)) continue;
    if (!!Reflect.apply(predicate, obj, [obj[key], key, obj]) !== all) return !all;
  }
  return all;
}
function some(obj, match) {
  assertMatcher(arguments.length >= 2);
  return quantify(obj, match, false);
}
function every(obj, match) {
  assertMatcher(arguments.length >= 2);
  return quantify(obj, match, true);
}
function findEntry(obj, match) {
  assertMatcher(arguments.length >= 2);
  return search(obj, match, 'entry');
}
function count(obj, match) {
  c.assertObject(obj);
  return arguments.length < 2 ? c.keys(obj).length : search(obj, match, 'count');
}
function reduceImpl(obj, callback, initial, supplied, reverse) {
  c.assertObject(obj);
  c.assertFunction(callback);
  const list = c.keys(obj);
  if (reverse) list.reverse();
  let accumulator = initial,
    initialized = supplied;
  for (const key of list) {
    if (!c.enumerable(obj, key)) continue;
    const value = obj[key];
    if (!initialized) {
      accumulator = value;
      initialized = true;
    } else accumulator = Reflect.apply(callback, obj, [accumulator, value, key, obj]);
  }
  if (!initialized) throw new TypeError('Cannot reduce an empty object without an initial value.');
  return accumulator;
}
function reduce(obj, callback, initial) {
  return reduceImpl(obj, callback, initial, arguments.length >= 3, false);
}
function reduceRight(obj, callback, initial) {
  return reduceImpl(obj, callback, initial, arguments.length >= 3, true);
}
function pick(obj, list) {
  c.assertObject(obj);
  const selected = c.keyList(list),
    result = c.record(obj);
  for (const key of selected) if (c.enumerable(obj, key)) c.define(result, key, obj[key]);
  return result;
}
function omit(obj, list) {
  c.assertObject(obj);
  const excluded = new Set(c.keyList(list)),
    result = c.record(obj);
  for (const key of c.keys(obj)) if (!excluded.has(key) && c.enumerable(obj, key)) c.define(result, key, obj[key]);
  return result;
}
function merge(obj, ...others) {
  c.assertObject(obj);
  others.forEach(c.assertObject);
  const result = c.record(obj);
  for (const source of [obj, ...others]) forEach(source, (value, key) => c.define(result, key, value));
  return result;
}
function setOperation(obj, others, intersection) {
  c.assertObject(obj);
  others.forEach(c.assertObject);
  const result = c.record(obj);
  forEach(obj, (value, key) => {
    const matches = (other) => c.enumerable(other, key) && c.sameValueZero(value, other[key]);
    if (intersection ? others.every(matches) : !others.some(matches)) c.define(result, key, value);
  });
  return result;
}
function intersect(obj, ...others) {
  return setOperation(obj, others, true);
}
function except(obj, ...others) {
  return setOperation(obj, others, false);
}

function change(obj, valueOrPredicate, replacement, mode, remove) {
  c.assertObject(obj);
  const predicate = c.matcher(valueOrPredicate),
    result = [];
  const list = c.keys(obj);
  if (mode === 'last') list.reverse();
  for (const key of list) {
    if (!c.enumerable(obj, key)) continue;
    const value = obj[key];
    if (!Reflect.apply(predicate, obj, [value, key, obj])) continue;
    if (remove) {
      if (!Reflect.deleteProperty(obj, key)) throw new TypeError('Cannot delete property ' + String(key));
    } else {
      const descriptor = Object.getOwnPropertyDescriptor(obj, key);
      if (!descriptor || !c.own(descriptor, 'value')) throw new TypeError('Cannot replace an accessor property.');
      const next = c.isCallable(replacement) ? Reflect.apply(replacement, obj, [value, key, obj]) : replacement;
      // Redefine the data value rather than triggering an inherited or own setter.
      c.writeData(obj, key, next);
    }
    if (mode !== 'all') return value;
    result.push(value);
  }
  return mode === 'all' ? result : undefined;
}

module.exports = {
  keys: c.keys,
  values,
  entries,
  hasKey,
  hasProp,
  hasValue,
  forEach,
  map,
  mapKeys,
  filter,
  find: function find(obj, match) {
    c.requireArgs(arguments, 2);
    return search(obj, match, 'first');
  },
  findLast: function findLast(obj, match) {
    c.requireArgs(arguments, 2);
    return search(obj, match, 'last');
  },
  findAll: function findAll(obj, match) {
    c.requireArgs(arguments, 2);
    return search(obj, match, 'all');
  },
  findKey: function findKey(obj, match) {
    c.requireArgs(arguments, 2);
    return search(obj, match, 'key');
  },
  count,
  some,
  every,
  findEntry,
  reduce,
  reduceRight,
  pick,
  omit,
  merge,
  intersect,
  except,
  remove: function remove(obj, match) {
    c.requireArgs(arguments, 2);
    return change(obj, match, undefined, 'first', true);
  },
  removeLast: function removeLast(obj, match) {
    c.requireArgs(arguments, 2);
    return change(obj, match, undefined, 'last', true);
  },
  removeAll: function removeAll(obj, match) {
    c.requireArgs(arguments, 2);
    return change(obj, match, undefined, 'all', true);
  },
  replace: function replace(obj, match, value) {
    c.requireArgs(arguments, 3);
    return change(obj, match, value, 'first', false);
  },
  replaceLast: function replaceLast(obj, match, value) {
    c.requireArgs(arguments, 3);
    return change(obj, match, value, 'last', false);
  },
  replaceAll: function replaceAll(obj, match, value) {
    c.requireArgs(arguments, 3);
    return change(obj, match, value, 'all', false);
  }
};
