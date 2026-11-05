'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const O = require('..');
for (const name of ['setImmutable', 'updateImmutable', 'unsetImmutable'])
  test(name + ' is exported', () => assert.equal(typeof O[name], 'function'));
test('immutable writes copy only the spine and preserve untouched identity', () => {
  const obj = { a: { b: 1 }, other: { n: 2 } };
  const next = O.setImmutable(obj, ['a', 'b'], 3);
  assert.deepEqual(obj, { a: { b: 1 }, other: { n: 2 } });
  assert.deepEqual(next, { a: { b: 3 }, other: { n: 2 } });
  assert.notEqual(next, obj);
  assert.notEqual(next.a, obj.a);
  assert.equal(next.other, obj.other);
});
test('immutable updates support deeply frozen ordinary state', () => {
  const obj = Object.freeze({ a: Object.freeze({ n: 1 }), other: Object.freeze({ x: 2 }) });
  const next = O.updateImmutable(obj, 'a.n', (x) => x + 1);
  assert.equal(next.a.n, 2);
  assert.equal(obj.a.n, 1);
  assert.equal(next.other, obj.other);
  assert.equal(Object.getOwnPropertyDescriptor(next, 'a').writable, true);
  assert.equal(Object.getOwnPropertyDescriptor(next.a, 'n').writable, true);
});
test('immutable deletion returns a new root and leaves the old field intact', () => {
  const obj = Object.freeze({ a: Object.freeze({ n: 1, m: 2 }), b: 3 });
  const next = O.unsetImmutable(obj, 'a.n');
  assert.deepEqual(next, { a: { m: 2 }, b: 3 });
  assert.equal(obj.a.n, 1);
});
test('Object.is no-ops preserve identity, but adding undefined is a change', () => {
  const obj = { a: { n: NaN }, zero: -0, u: undefined };
  assert.equal(O.setImmutable(obj, 'a.n', NaN), obj);
  assert.equal(
    O.updateImmutable(obj, 'zero', (v) => v),
    obj
  );
  assert.equal(O.setImmutable(obj, 'u', undefined), obj);
  const added = O.setImmutable(obj, 'missing', undefined);
  assert.notEqual(added, obj);
  assert.ok(Object.hasOwn(added, 'missing'));
  assert.notEqual(O.setImmutable(obj, 'zero', 0), obj);
  assert.equal(O.unsetImmutable(obj, 'missing.deep'), obj);
});
test('immutable setters create missing arrays and records from the path', () => {
  const obj = {};
  const next = O.setImmutable(obj, 'users[1].name', 'Michael');
  assert.deepEqual(obj, {});
  assert.equal(next.users.length, 2);
  assert.ok(!(0 in next.users));
  assert.deepEqual(next.users[1], { name: 'Michael' });
  const u = O.updateImmutable({}, ['settings', 'retries'], (v) => (v ?? 0) + 1);
  assert.deepEqual(u, { settings: { retries: 1 } });
});
test('array copies preserve holes, extras, symbols and index deletion length', () => {
  const s = Symbol('extra');
  const list = new Array(4);
  list[1] = { x: 1 };
  list.extra = 2;
  list[s] = 3;
  Object.freeze(list);
  const changed = O.setImmutable(list, [1, 'x'], 2);
  assert.equal(changed.length, 4);
  assert.ok(!(0 in changed));
  assert.equal(changed.extra, 2);
  assert.equal(changed[s], 3);
  assert.equal(list[1].x, 1);
  const removed = O.unsetImmutable(list, 1);
  assert.equal(removed.length, 4);
  assert.ok(!(1 in removed));
  assert.equal(list[1].x, 1);
  assert.equal(O.unsetImmutable(list, 3), list);
});
test('null-prototype records and non-enumerable data are preserved', () => {
  const s = Symbol('n');
  const obj = Object.create(null);
  Object.defineProperty(obj, 'hidden', { value: { [s]: 1 }, enumerable: false });
  const next = O.setImmutable(obj, ['hidden', s], 2);
  assert.equal(Object.getPrototypeOf(next), null);
  assert.equal(next.hidden[s], 2);
  assert.equal(Object.getOwnPropertyDescriptor(next, 'hidden').enumerable, false);
  assert.equal(obj.hidden[s], 1);
});
test('cross-realm arrays and records can be updated without invoking constructors', () => {
  const obj = vm.runInNewContext('({a:[{n:1}]})');
  const rootProto = Object.getPrototypeOf(obj),
    arrayProto = Object.getPrototypeOf(obj.a),
    itemProto = Object.getPrototypeOf(obj.a[0]);
  const next = O.setImmutable(obj, 'a[0].n', 2);
  assert.equal(next.a[0].n, 2);
  assert.equal(obj.a[0].n, 1);
  assert.ok(Array.isArray(next.a));
  assert.equal(Object.getPrototypeOf(next), rootProto);
  assert.equal(Object.getPrototypeOf(next.a), arrayProto);
  assert.equal(Object.getPrototypeOf(next.a[0]), itemProto);
});
test('off-path accessors are copied without evaluating them', () => {
  let reads = 0;
  const obj = {
    x: 1,
    get lazy() {
      reads++;
      return 2;
    }
  };
  const next = O.setImmutable(obj, 'x', 2);
  assert.equal(reads, 0);
  assert.equal(Object.getOwnPropertyDescriptor(next, 'lazy').get, Object.getOwnPropertyDescriptor(obj, 'lazy').get);
});
for (const name of ['setImmutable', 'updateImmutable', 'unsetImmutable']) {
  test(name + ' rejects unsafe, accessor, empty and array-length paths', () => {
    let calls = 0,
      reads = 0;
    const obj = {
      get a() {
        reads++;
        return {};
      }
    };
    const invoke = (o, p) => O[name](o, p, name === 'updateImmutable' ? () => ++calls : 2);
    for (const p of ['__proto__.x', 'constructor.prototype.x', ['safe', 'prototype', 'x'], []])
      assert.throws(() => invoke({}, p), Error);
    assert.throws(() => invoke(obj, 'a'), TypeError);
    assert.throws(() => invoke(obj, 'a.b'), TypeError);
    assert.throws(() => invoke([], 'length'), TypeError);
    assert.equal(calls, 0);
    assert.equal(reads, 0);
    assert.equal({}.x, undefined);
  });
  test(name + ' rejects unsupported path containers instead of creating invalid copies', () => {
    const args = name === 'updateImmutable' ? [() => 1] : [1];
    for (const root of [
      null,
      1,
      () => {},
      new Date(),
      new Map(),
      new (class X {
        constructor() {
          this.x = 1;
        }
      })()
    ])
      assert.throws(() => O[name](root, 'x', ...args), TypeError);
    for (const nested of [null, 1, new Date()]) assert.throws(() => O[name]({ a: nested }, 'a.x', ...args), TypeError);
  });
}
test('updater is called exactly once after validation and throwing leaves input unchanged', () => {
  let calls = 0;
  const obj = {};
  const error = Error('sentinel');
  assert.throws(
    () =>
      O.updateImmutable(obj, 'a[0].n', (value) => {
        calls++;
        assert.equal(value, undefined);
        throw error;
      }),
    (e) => e === error
  );
  assert.equal(calls, 1);
  assert.deepEqual(obj, {});
  assert.throws(() => O.updateImmutable({}, 'x', null), TypeError);
  assert.throws(() => O.setImmutable({}, 'x'), TypeError);
});
test('path-local copying does not clone or retarget off-path aliases and cycles', () => {
  const shared = { n: 1 };
  const obj = { a: shared, b: shared };
  obj.self = obj;
  const next = O.setImmutable(obj, 'a.n', 2);
  assert.notEqual(next.a, shared);
  assert.equal(next.b, shared);
  assert.equal(next.self, obj);
  assert.equal(shared.n, 1);
  const cyclic = O.setImmutable(obj, 'self.a.n', 3);
  assert.equal(cyclic.self.a.n, 3);
  assert.equal(obj.a.n, 1);
  assert.equal(cyclic.self.self, obj);
});
test('immutable operations retain literal functions and use own properties only', () => {
  const fn = () => 1;
  const obj = {};
  const next = O.setImmutable(obj, 'handler', fn);
  assert.equal(next.handler, fn);
  const withProto = JSON.parse('{"__proto__":{"marker":1}}');
  const copy = O.setImmutable(withProto, 'safe', true);
  assert.equal(Object.getPrototypeOf(copy), Object.prototype);
  assert.ok(Object.hasOwn(copy, '__proto__'));
  const inherited = O.setImmutable({}, 'toString.x', 1);
  assert.deepEqual(inherited.toString, { x: 1 });
  assert.equal({}.x, undefined);
});
test('immutable wrapper operations advance the pipeline without modifying the original wrapper', () => {
  const data = { n: 1 };
  const first = O(data),
    next = first
      .updateImmutable('n', (x) => x + 1)
      .setImmutable('a', 3)
      .unsetImmutable('a');
  assert.deepEqual(next.unwrap(), { n: 2 });
  assert.equal(next.result(), next.unwrap());
  assert.equal(first.unwrap(), data);
  assert.equal(data.n, 1);
});
test('immutable paths are stack-safe at 20000 segments', () => {
  const path = Array(20000).fill('next');
  const source = {};
  const next = O.setImmutable(source, path, 7);
  assert.equal(O.get(next, path), 7);
  assert.deepEqual(source, {});
  const removed = O.unsetImmutable(next, path);
  assert.equal(O.has(removed, path), false);
  assert.equal(O.get(next, path), 7);
});
