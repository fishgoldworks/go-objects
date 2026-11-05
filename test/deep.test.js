'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const O = require('..');
const input = () => ({ a: { x: 1, y: 2 }, b: [3, { z: 1 }] });
test('deepForEach visits property edges in pre-order with stable paths', () => {
  const obj = input(),
    seen = [];
  assert.equal(
    O.deepForEach(obj, function (v, k, node, path) {
      assert.equal(this, node);
      assert.equal(node[k], v);
      seen.push(path);
    }),
    obj
  );
  assert.deepEqual(seen, [['a'], ['a', 'x'], ['a', 'y'], ['b'], ['b', '0'], ['b', '1'], ['b', '1', 'z']]);
});
test('deep traversal expands each container once and reports alias/cycle edges', () => {
  const shared = { x: 1 },
    obj = { a: shared, b: shared };
  obj.self = obj;
  const paths = [];
  O.deepForEach(obj, (v, k, p, path) => paths.push(path));
  assert.deepEqual(paths, [['a'], ['a', 'x'], ['b'], ['self']]);
});
test('deep callback path mutation cannot corrupt later paths', () => {
  const paths = [];
  O.deepForEach({ a: { b: 1 } }, (v, k, o, p) => {
    paths.push([...p]);
    p.push('bad');
  });
  assert.deepEqual(paths, [['a'], ['a', 'b']]);
});
test('deep searches and counts are recursive, not shallow placeholders', () => {
  const obj = input();
  assert.equal(O.deepFind(obj, 2), 2);
  assert.equal(O.deepFindLast(obj, 1), 1);
  assert.deepEqual(O.deepFindAll(obj, 1), [1, 1]);
  assert.equal(O.deepCount(obj, 1), 2);
  assert.equal(O.deepFindKey(obj, 2), 'y');
  assert.deepEqual(O.findPath(obj, 1), ['a', 'x']);
  assert.deepEqual(O.findPath(obj, 3), ['b', '0']);
  assert.equal(O.findPath(obj, 9), undefined);
  assert.equal(O.deepFindKey(obj, 9), undefined);
  assert.equal(O.deepFindLast(obj, 9), undefined);
});
test('deep options limit depth and prune descent without skipping the parent edge', () => {
  const obj = input();
  const one = [];
  O.deepForEach(obj, (v, k, p, path) => one.push(path), { maxDepth: 1 });
  assert.deepEqual(one, [['a'], ['b']]);
  let calls = 0;
  O.deepForEach(obj, () => calls++, { maxDepth: 0 });
  assert.equal(calls, 0);
  const paths = [];
  O.deepForEach(obj, (v, k, p, path) => paths.push(path), { shouldDescend: (v, k) => k !== 'a' });
  assert.deepEqual(paths, [['a'], ['b'], ['b', '0'], ['b', '1'], ['b', '1', 'z']]);
});
test('built-in collections and class instances are deep traversal leaves', () => {
  class X {
    constructor() {
      this.n = 1;
    }
  }
  const obj = { m: new Map([['x', 1]]), s: new Set([1]), date: new Date(), x: new X() };
  assert.equal(O.deepCount(obj, 1), 0);
  const visited = [];
  O.deepForEach(obj, (v, k) => visited.push(k));
  assert.deepEqual(visited, ['m', 's', 'date', 'x']);
});
test('deepMap recursively maps unchanged containers and isolates result records', () => {
  const obj = input();
  const result = O.deepMap(obj, (v) => (typeof v === 'number' ? v * 10 : v));
  assert.deepEqual(result, { a: { x: 10, y: 20 }, b: [30, { z: 10 }] });
  assert.deepEqual(obj, input());
  assert.notEqual(result.a, obj.a);
});
test('deepMap does not recurse into callback replacements', () => {
  let calls = 0;
  const replacement = { x: 9 };
  const result = O.deepMap({ a: { x: 1 } }, () => {
    calls++;
    return replacement;
  });
  assert.equal(calls, 1);
  assert.equal(result.a, replacement);
});
test('deepMap and deepMapKeys preserve cycles and aliases', () => {
  const child = { n: 1 },
    obj = { a: child, b: child };
  obj.self = obj;
  const mapped = O.deepMap(obj, (v) => v);
  assert.equal(mapped.self, mapped);
  assert.equal(mapped.a, mapped.b);
  const keyed = O.deepMapKeys(obj, (v, k) => k.toUpperCase());
  assert.equal(keyed.SELF, keyed);
  assert.equal(keyed.A, keyed.B);
  assert.equal(keyed.A.N, 1);
});
test('deepMapKeys renames keys throughout the graph and converts arrays to records', () => {
  const result = O.deepMapKeys({ user: { first: 1 }, list: [2] }, (v, k) => '_' + k);
  assert.deepEqual(result, { _user: { _first: 1 }, _list: { _0: 2 } });
});
test('deepFilter prunes rejected branches and compacts retained array indices', () => {
  const obj = input(),
    paths = [];
  const result = O.deepFilter(obj, (v, k, p, path) => {
    paths.push(path);
    return k !== 'a' && (typeof v !== 'number' || v > 1);
  });
  assert.deepEqual(result, { b: [3, {}] });
  assert.equal(
    paths.some((p) => p.join('.') === 'a.x'),
    false
  );
});
test('deepFilter preserves retained cycle edges', () => {
  const obj = { n: 1 };
  obj.self = obj;
  const copy = O.deepFilter(obj, () => true);
  assert.notEqual(copy, obj);
  assert.equal(copy.self, copy);
});
for (const name of [
  'deepRemove',
  'deepRemoveLast',
  'deepRemoveAll',
  'deepReplace',
  'deepReplaceLast',
  'deepReplaceAll'
])
  test(name + ' applies correct first/last/all mutation', () => {
    const obj = input(),
      result = name.startsWith('deepRemove') ? O[name](obj, 1) : O[name](obj, 1, 9);
    assert.deepEqual(result, name.endsWith('All') ? [1, 1] : 1);
    const first = name.endsWith('All') || !name.endsWith('Last'),
      last = name.endsWith('All') || name.endsWith('Last');
    if (first) {
      if (name.startsWith('deepRemove')) assert.equal(Object.hasOwn(obj.a, 'x'), false);
      else assert.equal(obj.a.x, 9);
    }
    if (last) {
      if (name.startsWith('deepRemove')) assert.equal(Object.hasOwn(obj.b[1], 'z'), false);
      else assert.equal(obj.b[1].z, 9);
    }
  });
test('deep all-mutations prune matched branches instead of mutating removed descendants', () => {
  const branch = { x: 1 },
    obj = { a: branch, b: 2 };
  const old = O.deepRemoveAll(obj, () => true);
  assert.deepEqual(old, [branch, 2]);
  assert.equal(branch.x, 1);
  assert.deepEqual(obj, {});
});
test('deep mutation replacement callbacks receive original paths', () => {
  const obj = { a: { x: 1 } };
  assert.deepEqual(
    O.deepReplaceAll(obj, 1, (v, k, p, path) => path.join('.')),
    [1]
  );
  assert.equal(obj.a.x, 'a.x');
});
test('deep mutations preserve array property indices', () => {
  const obj = { a: [1, 2, 1] };
  assert.deepEqual(O.deepRemoveAll(obj, 1), [1, 1]);
  assert.equal(obj.a.length, 3);
  assert.equal(0 in obj.a, false);
  assert.equal(obj.a[1], 2);
});
test('deep transformations safely preserve dangerous-looking data keys', () => {
  const obj = JSON.parse('{"__proto__":{"safe":1}}');
  for (const result of [O.deepMap(obj, (v) => v), O.deepMapKeys(obj, (v, k) => k), O.deepFilter(obj, () => true)]) {
    assert.equal(Object.getPrototypeOf(result), Object.prototype);
    assert.equal(Object.hasOwn(result, '__proto__'), true);
  }
  assert.equal({}.safe, undefined);
});
test('invalid traversal options throw', () => {
  for (const options of [null, 1, { maxDepth: -1 }, { maxDepth: 1.2 }, { shouldDescend: 3 }, { unknown: true }])
    assert.throws(() => O.deepForEach({}, () => {}, options), TypeError);
});
test('deep traversal of 12,000 nested records does not overflow the stack', () => {
  const obj = {};
  let n = obj;
  for (let i = 0; i < 12000; i++) n = n.next = {};
  assert.equal(
    O.deepCount(obj, () => true),
    12000
  );
});
