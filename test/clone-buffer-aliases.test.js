'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const O = require('..');

for (const method of ['clone', 'deepClone']) {
  for (const freeze of [false, true]) {
    test(`${method}: null-prototype arrays are copied rather than returned as unsupported references (${freeze ? 'frozen' : 'extensible'})`, () => {
      const child = { n: 1 },
        symbol = Symbol('meta');
      const source = Object.setPrototypeOf(new Array(4), null);
      source[1] = child;
      source[symbol] = child;
      Object.defineProperty(source, 'hidden', { value: child, enumerable: false, writable: false, configurable: true });
      source.self = source;
      if (freeze) Object.freeze(source);
      const result = O[method](source, { unsupported: 'throw' });
      assert.notEqual(result, source);
      assert.equal(Array.isArray(result), true);
      assert.equal(Object.getPrototypeOf(result), null);
      assert.equal(result.length, 4);
      assert.equal(Object.hasOwn(result, 0), false);
      assert.equal(result[1], result[symbol]);
      assert.equal(result[1], result.hidden);
      assert.equal(result.self, method === 'deepClone' ? result : source);
      assert.equal(result[1] === child, method === 'clone');
      assert.equal(Object.isFrozen(result), freeze);
      assert.equal(Object.getOwnPropertyDescriptor(result, 'hidden').writable, false);
    });
  }
  for (const makeView of [
    (buffer) => new Uint8Array(buffer),
    (buffer) => new DataView(buffer),
    (buffer) => Buffer.from(buffer)
  ]) {
    test(`${method}: a view over a custom ArrayBuffer is opaque, not a new object secretly sharing writable memory (${makeView.toString()})`, () => {
      let constructed = 0;
      class CustomBuffer extends ArrayBuffer {
        constructor() {
          super(8);
          constructed++;
        }
      }
      const buffer = new CustomBuffer(),
        view = makeView(buffer),
        raw = new Uint8Array(buffer);
      raw[0] = 42;
      let reads = 0;
      Object.defineProperty(view, 'secret', {
        get() {
          reads++;
          throw new Error('opaque');
        }
      });
      assert.equal(O[method](view), view);
      assert.throws(() => O[method](view, { unsupported: 'throw' }), TypeError);
      assert.equal(constructed, 1);
      assert.equal(reads, 0);
      assert.equal(raw[0], 42);
    });
  }
  test(method + ': cross-realm null-prototype arrays retain their supported graph shape', () => {
    const source = vm.runInNewContext('Object.setPrototypeOf([{n:1}],null)');
    const result = O[method](source, { unsupported: 'throw' });
    assert.equal(Array.isArray(result), true);
    assert.notEqual(result, source);
    assert.equal(Object.getPrototypeOf(result), null);
    assert.equal(result[0].n, 1);
    assert.equal(result[0] === source[0], method === 'clone');
  });
}

for (const Type of [
  Int8Array,
  Uint8Array,
  Uint8ClampedArray,
  Int16Array,
  Uint16Array,
  Int32Array,
  Uint32Array,
  Float32Array,
  Float64Array,
  BigInt64Array,
  BigUint64Array
]) {
  test('deepClone: opaque buffer/view aliases remain explicit for ' + Type.name, () => {
    class CustomBuffer extends ArrayBuffer {}
    const buffer = new CustomBuffer(32),
      view = new Type(buffer),
      source = { buffer, first: view, second: view };
    const result = O.deepClone(source);
    assert.notEqual(result, source);
    assert.equal(result.buffer, buffer);
    assert.equal(result.first, view);
    assert.equal(result.second, view);
    assert.throws(() => O.deepClone(source, { unsupported: 'throw' }), TypeError);
  });
}
test('deepClone: ordinary backing buffers still ignore an own constructor getter and retain isolated aliases', () => {
  let reads = 0;
  const buffer = new ArrayBuffer(16),
    view = new Uint8Array(buffer, 2, 4);
  Object.defineProperty(buffer, 'constructor', {
    get() {
      reads++;
      throw new Error('not a classifier');
    }
  });
  view[0] = 7;
  buffer.view = view;
  const copy = O.deepClone({ buffer, view }, { unsupported: 'throw' });
  assert.notEqual(copy.buffer, buffer);
  assert.equal(copy.view.buffer, copy.buffer);
  assert.equal(copy.buffer.view, copy.view);
  copy.view[0] = 9;
  assert.equal(view[0], 7);
  assert.equal(reads, 0);
});
test('shallow strict cloning does not inspect an opaque view stored as an ordinary child', () => {
  class CustomBuffer extends ArrayBuffer {}
  const view = new Uint8Array(new CustomBuffer(8)),
    source = { view };
  const copy = O.clone(source, { unsupported: 'throw' });
  assert.notEqual(copy, source);
  assert.equal(copy.view, view);
});
