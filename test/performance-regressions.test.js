'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const O = require('..');
const traversal = require('../src/internal/traversal');
const paths = require('../src/internal/path');

for (const method of [
  'deepFind',
  'deepFindLast',
  'deepFindAll',
  'deepFindKey',
  'findPath',
  'deepFindEntry',
  'deepCount',
  'deepRemove',
  'deepRemoveLast',
  'deepRemoveAll',
  'deepReplace',
  'deepReplaceLast',
  'deepReplaceAll'
]) {
  test(method + ': literal matching only creates a path when the public result requires it', () => {
    const source = { a: { b: { leaf: 42 } }, other: { leaf: 42 } },
      original = traversal.toPath;
    let snapshots = 0;
    traversal.toPath = (link) => {
      snapshots++;
      return original(link);
    };
    let result;
    try {
      result = method.startsWith('deepReplace') ? O[method](source, 42, 99) : O[method](source, 42);
    } finally {
      traversal.toPath = original;
    }
    const expected = {
      deepFind: 42,
      deepFindLast: 42,
      deepFindAll: [42, 42],
      deepFindKey: 'leaf',
      findPath: ['a', 'b', 'leaf'],
      deepFindEntry: [['a', 'b', 'leaf'], 42],
      deepCount: 2,
      deepRemove: 42,
      deepRemoveLast: 42,
      deepRemoveAll: [42, 42],
      deepReplace: 42,
      deepReplaceLast: 42,
      deepReplaceAll: [42, 42]
    };
    assert.deepEqual(result, expected[method]);
    assert.equal(snapshots, method === 'findPath' || method === 'deepFindEntry' ? 1 : 0);
  });
}
for (const value of [NaN, -0, 0, undefined, null, false, 0n, '']) {
  test('literal deep matching retains SameValueZero for ' + String(value) + ' (' + typeof value + ')', () => {
    const source = { a: { x: value }, b: { y: value } };
    assert.equal(O.deepCount(source, value), 2);
    assert.deepEqual(O.deepFindAll(source, value), [value, value]);
    assert.deepEqual(O.deepFindEntry(source, value), [['a', 'x'], value]);
  });
}
test('literal object matching neither coerces values nor changes alias traversal', () => {
  const target = {
      value: 7,
      [Symbol.toPrimitive]() {
        throw new Error('Do not coerce');
      }
    },
    source = { first: target, second: target };
  assert.equal(O.deepCount(source, target), 2);
  assert.equal(O.deepFind(source, target), target);
  assert.deepEqual(O.deepFindEntry(source, target), [['first'], target]);
});
test('predicate callback paths remain independent and cannot alter traversal', () => {
  const seen = [],
    keys = [],
    source = { a: { b: 1 }, c: 2 };
  assert.equal(
    O.deepCount(source, function (value, key, parent, path) {
      assert.equal(this, parent);
      seen.push(path);
      keys.push([...path]);
      path.push('changed');
      return typeof value === 'number';
    }),
    2
  );
  assert.deepEqual(keys, [['a'], ['a', 'b'], ['c']]);
  assert.equal(new Set(seen).size, 3);
});
test('literal match still gives shouldDescend fresh paths and correct receiver', () => {
  const paths = [];
  const count = O.deepCount({ a: { leaf: 7 }, b: { leaf: 7 } }, 7, {
    shouldDescend(value, key, parent, path) {
      assert.equal(this, parent);
      paths.push(path);
      path[0] = 'changed';
      return key === 'b';
    }
  });
  assert.equal(count, 1);
  assert.equal(paths.length, 2);
  assert.notEqual(paths[0], paths[1]);
});
test('literal deep replacement gives replacement callback correct independent paths', () => {
  const source = { a: { x: 7 }, b: { x: 7 } },
    seen = [];
  assert.deepEqual(
    O.deepReplaceAll(source, 7, function (value, key, parent, path) {
      assert.equal(this, parent);
      assert.equal(key, 'x');
      seen.push([...path]);
      path[0] = 'modified';
      return value + 1;
    }),
    [7, 7]
  );
  assert.deepEqual(seen, [
    ['a', 'x'],
    ['b', 'x']
  ]);
  assert.deepEqual(source, { a: { x: 8 }, b: { x: 8 } });
});
test('repeated string lookups never cache values or terminal getter results', () => {
  let count = 0;
  const input = {
    row: {
      get value() {
        return ++count;
      }
    }
  };
  for (let i = 1; i <= 300; i++) assert.equal(O.get(input, 'row.value'), i);
  assert.equal(count, 300);
  for (let i = 0; i < 300; i++) assert.equal(O.has(input, 'row.value'), true);
  assert.equal(count, 300);
});
test('repeated path is independent of root and current ownership', () => {
  const a = { row: { value: 1 } },
    b = { row: { value: 2 } },
    inherited = Object.create({ value: 3 });
  for (let i = 0; i < 20; i++) {
    assert.equal(O.get(a, 'row.value'), 1);
    assert.equal(O.get(b, 'row.value'), 2);
    assert.equal(O.get({ row: inherited }, 'row.value'), undefined);
  }
  delete a.row.value;
  assert.equal(O.has(a, 'row.value'), false);
  a.row.value = 4;
  assert.equal(O.get(a, 'row.value'), 4);
});
test('array paths are copied before getters run and re-read on the next call', () => {
  const path = ['row', 'value'];
  const source = {
    get row() {
      path[1] = 'other';
      return { value: 1, other: 2 };
    }
  };
  assert.equal(O.get(source, path), 1);
  assert.equal(O.get(source, path), 2);
});
test('custom segment-array iterators execute on every lookup', () => {
  let i = 0;
  const path = [];
  path[Symbol.iterator] = function* () {
    yield 'row';
    yield ++i === 1 ? 'a' : 'b';
  };
  const obj = { row: { a: 1, b: 2 } };
  assert.equal(O.get(obj, path), 1);
  assert.equal(O.get(obj, path), 2);
});
test('internal parse returns independent arrays, not retained cache storage', () => {
  const a = paths.parse('row.value'),
    b = paths.parse('row.value');
  assert.notEqual(a, b);
  a[0] = 'other';
  assert.deepEqual(b, ['row', 'value']);
  assert.equal(O.get({ row: { value: 7 } }, 'row.value'), 7);
});
test('cached string reads stay correct across reentrant getters', () => {
  let calls = 0;
  const nested = { row: { value: 99 } },
    outer = {
      get row() {
        calls++;
        assert.equal(O.get(nested, 'row.value'), 99);
        return { value: 7 };
      }
    };
  for (let i = 0; i < 30; i++) assert.equal(O.get(outer, 'row.value'), 7);
  assert.equal(calls, 30);
});
test('getEach parses the complete path list before reading any values', () => {
  const list = ['a.value', 'b.value'],
    source = {
      get a() {
        list[1] = 'other';
        return { value: 1 };
      },
      b: { value: 2 },
      other: 3
    };
  assert.deepEqual(O.getEach(source, list), [1, 2]);
  assert.deepEqual(O.getEach(source, list), [1, 3]);
});
test('high cardinality path churn cannot poison hot or long paths', () => {
  const row = { hot: 7 };
  for (let i = 0; i < 3000; i++) row['k' + i] = i;
  for (let i = 0; i < 3000; i++) {
    assert.equal(O.get({ row }, 'row.k' + i), i);
    if (i % 100 === 0) assert.equal(O.get({ row }, 'row.hot'), 7);
  }
  const long = 'a'.repeat(1000);
  assert.equal(O.get({ [long]: { value: 8 } }, long + '.value'), 8);
  assert.equal(O.get({ row }, 'row.hot'), 7);
});
for (const path of ['a..b', 'a[', 'a[01]', 'a["unterminated]', 'a]', 'a.']) {
  test('malformed paths remain invalid on repeated calls: ' + path, () => {
    for (let i = 0; i < 3; i++) assert.throws(() => O.get({}, path), SyntaxError);
  });
}
for (const key of ['__proto__', 'constructor', 'prototype']) {
  test('string-path warming never bypasses mutation guard: ' + key, () => {
    const source = JSON.parse('{"' + key + '":{"value":1}}'),
      path = key + '.value';
    for (let i = 0; i < 10; i++) {
      assert.equal(O.get(source, path), 1);
      assert.equal(O.has(source, path), true);
      for (const method of ['set', 'setImmutable', 'setEach', 'update', 'updateImmutable', 'unset', 'unsetImmutable'])
        assert.throws(
          () => O[method](source, method === 'setEach' ? [path] : path, method.startsWith('update') ? () => 2 : 2),
          TypeError
        );
    }
    assert.equal(source[key].value, 1);
  });
}
test('key enumeration retains its ownKeys and descriptor trap order', () => {
  const s = Symbol('s'),
    hidden = Symbol('h'),
    target = { a: 1, b: 2, [s]: 3 };
  Object.defineProperty(target, hidden, { value: 4 });
  const trace = [];
  const proxy = new Proxy(target, {
    ownKeys(t) {
      trace.push('ownKeys');
      return Reflect.ownKeys(t);
    },
    getOwnPropertyDescriptor(t, k) {
      trace.push(k);
      return Reflect.getOwnPropertyDescriptor(t, k);
    }
  });
  assert.deepEqual(O.keys(proxy), ['a', 'b', s]);
  assert.deepEqual(trace, ['ownKeys', 'a', 'b', 'ownKeys', s, hidden]);
});
test('enumerability is rechecked after an earlier callback hides a symbol', () => {
  const symbol = Symbol('s'),
    input = { a: 1, [symbol]: 2 };
  assert.deepEqual(
    O.map(input, (value, key) => {
      if (key === 'a') Object.defineProperty(input, symbol, { enumerable: false });
      return value;
    }),
    { a: 1 }
  );
});
test('clone classification is not cached by mutable array prototype', () => {
  const proto = { constructor: Array },
    value = [{ x: 1 }];
  Object.setPrototypeOf(value, proto);
  assert.equal(O.deepClone(value), value);
  proto.constructor = function Custom() {};
  assert.equal(O.deepClone(value), value);
  proto.constructor = Array;
  assert.equal(O.deepClone(value), value);
  Object.setPrototypeOf(value, Array.prototype);
  const copy = O.deepClone(value);
  assert.notEqual(copy, value);
  assert.notEqual(copy[0], value[0]);
});
test('clone classification is not cached by mutable native-object prototype', () => {
  const proto = Object.create(Date.prototype);
  Object.defineProperty(proto, 'constructor', { value: Date, writable: true });
  const value = new Date(123);
  Object.setPrototypeOf(value, proto);
  assert.equal(O.clone(value), value);
  proto.constructor = function Custom() {};
  assert.equal(O.clone(value), value);
  proto.constructor = Date;
  assert.equal(O.clone(value), value);
  Object.setPrototypeOf(value, Date.prototype);
  const copy = O.clone(value);
  assert.notEqual(copy, value);
  assert.equal(copy.getTime(), 123);
});
for (const value of [undefined, null, false, 0, 0n, '', Symbol('x')]) {
  test('primitive clone fast path validates options: ' + String(value) + ' ' + typeof value, () => {
    assert.equal(O.clone(value), value);
    assert.equal(O.deepClone(value), value);
    assert.throws(() => O.clone(value, { unsupported: 'invalid' }), TypeError);
    assert.throws(() => O.deepClone(value, { unknown: true }), TypeError);
  });
}
test('mutable parser results cannot poison cached reads or mutation validation', () => {
  const segments = paths.mutablePath('row.value');
  segments[0] = '__proto__';
  segments.push('extra');
  const source = { row: { value: 7 } };
  assert.equal(O.get(source, 'row.value'), 7);
  assert.equal(O.set(source, 'row.value', 8), 7);
  assert.deepEqual(source, { row: { value: 8 } });
});
test('colliding short path strings are compared in full before using cached syntax', () => {
  const source = { root: { k1000: { value: 1000 }, k1001: { value: 1001 } } };
  for (let i = 0; i < 20; i++) {
    assert.equal(O.get(source, 'root.k1000.value'), 1000);
    assert.equal(O.get(source, 'root.k1001.value'), 1001);
    assert.deepEqual(O.getEach(source, ['root.k1000.value', 'root.k1001.value']), [1000, 1001]);
  }
});
