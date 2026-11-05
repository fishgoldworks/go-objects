'use strict';
const c = require('./common');
const t = require('./traversal');
function call(fn, entry) {
  return Reflect.apply(fn, entry.parent, [entry.value, entry.key, entry.parent, t.toPath(entry.link)]);
}
function deepForEach(obj, callback, options) {
  c.assertObject(obj);
  c.assertFunction(callback);
  t.walk(
    obj,
    (entry) => {
      call(callback, entry);
    },
    t.optionsOf(options)
  );
  return obj;
}
function search(obj, valueOrPredicate, options, mode) {
  c.assertObject(obj);
  const isPredicate = c.isCallable(valueOrPredicate),
    all = [];
  let result,
    count = 0;
  t.walk(
    obj,
    (entry) => {
      // Literal matches do not consume callback paths. Materialise paths only
      // for user callbacks or path-bearing results, not for every visited node.
      if (!(isPredicate ? call(valueOrPredicate, entry) : c.sameValueZero(entry.value, valueOrPredicate))) return;
      if (mode === 'count') count++;
      else if (mode === 'all') all.push(entry.value);
      else {
        result =
          mode === 'key'
            ? entry.key
            : mode === 'path'
              ? t.toPath(entry.link)
              : mode === 'entry'
                ? [t.toPath(entry.link), entry.value]
                : entry.value;
        if (mode !== 'last') return t.STOP;
      }
    },
    t.optionsOf(options)
  );
  return mode === 'count' ? count : mode === 'all' ? all : result;
}
function transform(obj, callback, options, mode) {
  c.assertObject(obj);
  c.assertFunction(callback);
  const config = t.optionsOf(options, mode === 'keys');
  const outputOf = (value) =>
    mode === 'keys'
      ? config.arrays === 'preserve' && Array.isArray(value)
        ? new Array(value.length)
        : c.record(value)
      : mode === 'filter' && Array.isArray(value)
        ? []
        : c.shape(value);
  const result = outputOf(obj),
    copies = new WeakMap([[obj, result]]);
  if (!config.maxDepth) return result;
  const stack = [t.frame(obj, null, result)];
  while (stack.length) {
    const current = stack[stack.length - 1];
    if (current.index >= current.keys.length) {
      stack.pop();
      continue;
    }
    const key = current.keys[current.index++];
    if (!c.enumerable(current.node, key)) continue;
    const value = current.node[key],
      link = { key, previous: current.link, depth: (current.link?.depth || 0) + 1 };
    const structuralIndex =
      mode === 'keys' && config.arrays === 'preserve' && Array.isArray(current.node) && c.indexKey(key);
    const mapped = structuralIndex
      ? key
      : Reflect.apply(callback, current.node, [value, key, current.node, t.toPath(link)]);
    if (mode === 'filter' && !mapped) continue;
    let outputKey = mode === 'keys' ? c.keyOf(mapped) : key;
    if (
      mode === 'keys' &&
      Array.isArray(current.output) &&
      !structuralIndex &&
      (outputKey === 'length' || c.indexKey(outputKey))
    ) {
      throw new TypeError('An array extra property cannot be renamed to a structural key.');
    }
    if (mode === 'keys' && config.onCollision === 'throw' && c.own(current.output, outputKey)) {
      throw new TypeError('Mapped key collision: ' + String(outputKey));
    }
    if (mode === 'filter' && Array.isArray(current.output) && c.indexKey(key)) outputKey = current.output.length;
    let next = mode === 'map' ? mapped : value,
      child;
    if (next === value && c.traversable(value)) {
      if (copies.has(value)) next = copies.get(value);
      else if (t.descend(value, key, current.node, link, config)) {
        next = outputOf(value);
        copies.set(value, next);
        child = t.frame(value, link, next);
      }
    }
    c.define(current.output, outputKey, next);
    if (child) stack.push(child);
  }
  return result;
}
function change(obj, valueOrPredicate, replacement, options, mode, remove) {
  c.assertObject(obj);
  const config = t.optionsOf(options),
    isPredicate = c.isCallable(valueOrPredicate),
    results = [];
  let selected, result;
  function apply(entry) {
    const { parent, key, value } = entry;
    if (remove) {
      if (!Reflect.deleteProperty(parent, key)) throw new TypeError('Cannot delete property ' + String(key));
    } else {
      const descriptor = Object.getOwnPropertyDescriptor(parent, key);
      if (!descriptor || !c.own(descriptor, 'value')) throw new TypeError('Cannot replace an accessor property.');
      const next = c.isCallable(replacement) ? call(replacement, entry) : replacement;
      c.writeData(parent, key, next);
    }
    return value;
  }
  t.walk(
    obj,
    (entry) => {
      if (!(isPredicate ? call(valueOrPredicate, entry) : c.sameValueZero(entry.value, valueOrPredicate))) return;
      if (mode === 'last') {
        selected = entry;
        return;
      }
      result = apply(entry);
      if (mode === 'all') {
        results.push(result);
        return false;
      }
      return t.STOP;
    },
    config
  );
  if (selected) result = apply(selected);
  return mode === 'all' ? results : result;
}
module.exports = {
  deepForEach,
  deepFindEntry: function deepFindEntry(obj, match, options) {
    c.requireArgs(arguments, 2);
    return search(obj, match, options, 'entry');
  },
  deepFind: function deepFind(obj, match, options) {
    c.requireArgs(arguments, 2);
    return search(obj, match, options, 'first');
  },
  deepFindLast: function deepFindLast(obj, match, options) {
    c.requireArgs(arguments, 2);
    return search(obj, match, options, 'last');
  },
  deepFindAll: function deepFindAll(obj, match, options) {
    c.requireArgs(arguments, 2);
    return search(obj, match, options, 'all');
  },
  deepFindKey: function deepFindKey(obj, match, options) {
    c.requireArgs(arguments, 2);
    return search(obj, match, options, 'key');
  },
  findPath: function findPath(obj, match, options) {
    c.requireArgs(arguments, 2);
    return search(obj, match, options, 'path');
  },
  deepCount: function deepCount(obj, match, options) {
    c.requireArgs(arguments, 2);
    return search(obj, match, options, 'count');
  },
  deepMap: (obj, fn, options) => transform(obj, fn, options, 'map'),
  deepMapKeys: (obj, fn, options) => transform(obj, fn, options, 'keys'),
  deepFilter: (obj, fn, options) => transform(obj, fn, options, 'filter'),
  deepRemove: function deepRemove(obj, match, options) {
    c.requireArgs(arguments, 2);
    return change(obj, match, undefined, options, 'first', true);
  },
  deepRemoveLast: function deepRemoveLast(obj, match, options) {
    c.requireArgs(arguments, 2);
    return change(obj, match, undefined, options, 'last', true);
  },
  deepRemoveAll: function deepRemoveAll(obj, match, options) {
    c.requireArgs(arguments, 2);
    return change(obj, match, undefined, options, 'all', true);
  },
  deepReplace: function deepReplace(obj, match, value, options) {
    c.requireArgs(arguments, 3);
    return change(obj, match, value, options, 'first', false);
  },
  deepReplaceLast: function deepReplaceLast(obj, match, value, options) {
    c.requireArgs(arguments, 3);
    return change(obj, match, value, options, 'last', false);
  },
  deepReplaceAll: function deepReplaceAll(obj, match, value, options) {
    c.requireArgs(arguments, 3);
    return change(obj, match, value, options, 'all', false);
  }
};
