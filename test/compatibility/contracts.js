'use strict';
const assert = require('assert');
module.exports = function check(O) {
  assert.strictEqual(Object.keys(O).length, 60);
  const receiver = Object.freeze(O(1));
  const fresh = O.bind(receiver)(2);
  assert.notStrictEqual(fresh, receiver);
  assert.strictEqual(fresh.unwrap(), 2);
  assert.strictEqual(receiver.unwrap(), 1);
  class Derived extends O {}
  assert.ok(new Derived(3) instanceof Derived);
  function Alternate() {}
  assert.strictEqual(Object.getPrototypeOf(Reflect.construct(O, [4], Alternate)), Alternate.prototype);
  assert.strictEqual(O.get({ a: { b: 42 } }, 'a.b'), 42);
  assert.strictEqual(O.has({ a: undefined }, 'a'), true);
  assert.strictEqual(O.has(Object.create({ a: 1 }), 'a'), false);
  assert.deepStrictEqual(
    O.map({ a: 2, b: 3 }, (value) => value * 2),
    { a: 4, b: 6 }
  );
  assert.deepStrictEqual(
    O({ a: 1, b: 2 })
      .filter((value) => value > 1)
      .unwrap(),
    { b: 2 }
  );
  const original = { a: { b: 1 } },
    next = O.setImmutable(original, 'a.b', 2);
  assert.strictEqual(original.a.b, 1);
  assert.strictEqual(next.a.b, 2);
  assert.notStrictEqual(next.a, original.a);
  assert.throws(() => O.set({}, '__proto__.polluted', true), TypeError);
  assert.strictEqual({}.polluted, undefined);
  const symbol = Symbol('key'),
    source = { nested: { answer: 42 } };
  source.self = source;
  source[symbol] = source.nested;
  Object.defineProperty(source, 'hidden', { value: source.nested, enumerable: false, writable: false });
  const clone = O.deepClone(source);
  assert.notStrictEqual(clone, source);
  assert.strictEqual(clone.self, clone);
  assert.strictEqual(clone[symbol], clone.nested);
  assert.strictEqual(clone.hidden, clone.nested);
  assert.strictEqual(Object.getOwnPropertyDescriptor(clone, 'hidden').writable, false);
  const map = new Map();
  map.set(source, source);
  const copied = O.deepClone(map);
  const key = Array.from(copied.keys())[0];
  assert.notStrictEqual(key, source);
  assert.strictEqual(copied.get(key), key);
  const array = new Array(3);
  array[2] = { x: 1 };
  const arrCopy = O.deepClone(array);
  assert.strictEqual(0 in arrCopy, false);
  assert.notStrictEqual(arrCopy[2], array[2]);
  const buffer = new ArrayBuffer(8),
    bytes = new Uint8Array(buffer);
  bytes[0] = 9;
  const views = O.deepClone({ bytes: bytes, view: new DataView(buffer) });
  assert.strictEqual(views.bytes[0], 9);
  assert.strictEqual(views.bytes.buffer, views.view.buffer);
  assert.notStrictEqual(views.bytes.buffer, buffer);
  const error = new TypeError('detail');
  error.extra = source;
  const errorCopy = O.deepClone(error);
  assert.strictEqual(errorCopy.message, 'detail');
  assert.notStrictEqual(errorCopy.extra, source);
  const regexp = /ab/gi;
  regexp.lastIndex = 2;
  const regexCopy = O.deepClone(regexp);
  assert.strictEqual(regexCopy.source, regexp.source);
  assert.strictEqual(regexCopy.flags, regexp.flags);
  assert.strictEqual(regexCopy.lastIndex, 2);
  const opaque = new WeakMap();
  assert.strictEqual(O.deepClone(opaque), opaque);
  assert.throws(() => O.deepClone(opaque, { unsupported: 'throw' }), TypeError);
  if (typeof BigInt === 'function') {
    const big = Object(BigInt(42));
    assert.strictEqual(O.deepClone(big).valueOf(), big.valueOf());
  }
  if (typeof BigInt64Array === 'function') {
    const big = new BigInt64Array(1);
    big[0] = BigInt(42);
    assert.strictEqual(O.deepClone(big)[0], big[0]);
  }
  if (typeof AggregateError === 'function') {
    const aggregate = new AggregateError([source], 'failure');
    const copiedError = O.deepClone(aggregate);
    assert.strictEqual(copiedError.message, 'failure');
    assert.notStrictEqual(copiedError.errors[0], source);
  }
  const seen = [];
  O.deepForEach({ a: { b: 2 } }, (value, key) => seen.push(key));
  assert.deepStrictEqual(seen, ['a', 'b']);
  const target = { a: 1 };
  O.update(target, 'a', (value) => value + 1);
  assert.strictEqual(target.a, 2);
  O.unset(target, 'a');
  assert.strictEqual(O.has(target, 'a'), false);
};
