'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const O = require('..');

for (const method of ['clone', 'deepClone']) {
  for (const [label, offset, length, resized] of [
    ['fixed view extends beyond the buffer', 2, 6, 4],
    ['fixed view starts beyond the buffer', 4, 4, 2],
    ['length-tracking view starts beyond the buffer', 4, undefined, 2],
    ['zero-length view starts beyond an empty buffer', 4, 0, 0]
  ]) {
    test(`${method} retains attached out-of-bounds DataView: ${label}`, () => {
      const buffer = new ArrayBuffer(8, { maxByteLength: 16 });
      const view = new DataView(buffer, offset, length);
      buffer.resize(resized);
      assert.equal(buffer.detached, false);
      assert.throws(() => view.byteOffset, TypeError, 'fixture must be out of bounds');
      assert.equal(O[method](view), view);
      assert.equal(O[method](view, { unsupported: 'reference' }), view);
      assert.throws(() => O[method](view, { unsupported: 'throw' }), TypeError);
      buffer.resize(8);
      assert.equal(view.byteOffset, offset, 'cloning must not detach or replace the source');
      assert.equal(O[method](view), view, 'growing back in bounds does not make a resizable view supported');
    });
  }

  test(`${method} recognises cross-realm out-of-bounds DataViews as unsupported references`, () => {
    const view = vm.runInNewContext(`
      const buffer = new ArrayBuffer(8, { maxByteLength: 16 });
      const view = new DataView(buffer, 4, 4);
      buffer.resize(0);
      view;
    `);
    assert.equal(view instanceof DataView, false);
    assert.equal(O[method](view), view);
    assert.throws(() => O[method](view, { unsupported: 'throw' }), TypeError);
  });

  test(`${method} does not consult shadowed buffer or view state when retaining an out-of-bounds view`, () => {
    const buffer = new ArrayBuffer(8, { maxByteLength: 16 });
    const view = new DataView(buffer, 4, 4);
    buffer.resize(2);
    let reads = 0;
    const forbidden = () => {
      reads++;
      throw new Error('state getter must not run');
    };
    for (const name of ['byteLength', 'resizable', 'detached', 'constructor'])
      Object.defineProperty(buffer, name, { get: forbidden });
    for (const name of ['buffer', 'byteLength', 'byteOffset', 'constructor'])
      Object.defineProperty(view, name, { get: forbidden });
    assert.equal(O[method](view), view);
    assert.throws(() => O[method](view, { unsupported: 'throw' }), TypeError);
    assert.equal(reads, 0);
  });

  test(`${method} retains an out-of-bounds view over an unsupported buffer subclass`, () => {
    class CustomBuffer extends ArrayBuffer {}
    const buffer = new CustomBuffer(8, { maxByteLength: 16 });
    const view = new DataView(buffer, 4, 4);
    buffer.resize(2);
    assert.equal(O[method](view), view);
    assert.throws(() => O[method](view, { unsupported: 'throw' }), TypeError);
  });

  test(`${method} keeps fixed and resizable detached DataView failures distinct from unsupported policy`, () => {
    for (const resizable of [false, true]) {
      const buffer = resizable ? new ArrayBuffer(8, { maxByteLength: 16 }) : new ArrayBuffer(8);
      const view = new DataView(buffer, 4, 4);
      structuredClone(buffer, { transfer: [buffer] });
      assert.equal(buffer.detached, true);
      for (const options of [undefined, { unsupported: 'reference' }, { unsupported: 'throw' }])
        assert.throws(() => O[method](view, options), TypeError);
    }
  });

  test(`${method} retains in-bounds resizable and growable-shared DataViews`, () => {
    for (const buffer of [
      new ArrayBuffer(0, { maxByteLength: 16 }),
      new ArrayBuffer(8, { maxByteLength: 16 }),
      new SharedArrayBuffer(0, { maxByteLength: 16 }),
      new SharedArrayBuffer(8)
    ]) {
      const view = new DataView(buffer);
      assert.equal(O[method](view), view);
      assert.throws(() => O[method](view, { unsupported: 'throw' }), TypeError);
    }
  });

  test(`${method} still allocates supported zero-length DataViews`, () => {
    for (const size of [0, 4]) {
      const buffer = new ArrayBuffer(size);
      const view = new DataView(buffer, size, 0);
      const copy = O[method](view, { unsupported: 'throw' });
      assert.notEqual(copy, view);
      assert.notEqual(copy.buffer, buffer);
      assert.equal(copy.byteOffset, size);
      assert.equal(copy.byteLength, 0);
      assert.equal(copy.buffer.byteLength, size);
    }
  });

  test(`${method} retains out-of-bounds typed views without treating their zero lengths as supported copies`, () => {
    const buffer = new ArrayBuffer(8, { maxByteLength: 16 });
    const values = [new Uint8Array(buffer, 4, 4), new Uint16Array(buffer, 4)];
    buffer.resize(2);
    for (const value of values) {
      assert.equal(value.length, 0);
      assert.equal(O[method](value), value);
      assert.throws(() => O[method](value, { unsupported: 'throw' }), TypeError);
    }
  });

  test(`${method} treats custom-tagged genuine Errors as opaque without invoking their tag getters`, () => {
    let reads = 0;
    for (const Type of [Error, TypeError, RangeError, AggregateError]) {
      const value = Type === AggregateError ? new Type([], 'message') : new Type('message');
      Object.defineProperty(value, Symbol.toStringTag, {
        get() {
          reads++;
          throw new Error('tag getter');
        }
      });
      assert.equal(O[method](value), value);
      assert.throws(() => O[method](value, { unsupported: 'throw' }), TypeError);
    }
    assert.equal(reads, 0);
  });

  test(`${method} reclassifies native allocation after a custom prototype is restored`, () => {
    for (const value of [new ArrayBuffer(0), new DataView(new ArrayBuffer(0)), new Error('original')]) {
      const native = Object.getPrototypeOf(value);
      assert.notEqual(O[method](value), value);
      const custom = Object.create(native);
      Object.defineProperty(custom, 'constructor', { value: native.constructor });
      Object.setPrototypeOf(value, custom);
      assert.equal(O[method](value), value);
      assert.throws(() => O[method](value, { unsupported: 'throw' }), TypeError);
      Object.setPrototypeOf(value, native);
      assert.notEqual(O[method](value, { unsupported: 'throw' }), value);
    }
  });
}

test('deepClone retains nested out-of-bounds views without traversing their opaque children', () => {
  const buffer = new ArrayBuffer(8, { maxByteLength: 16 });
  const view = new DataView(buffer, 4, 4);
  view.child = new Proxy(
    {},
    {
      ownKeys() {
        throw new Error('opaque child visited');
      }
    }
  );
  buffer.resize(2);
  const source = { view };
  const result = O.deepClone(source);
  assert.notEqual(result, source);
  assert.equal(result.view, view);
  assert.throws(() => O.deepClone(source, { unsupported: 'throw' }), TypeError);
  assert.equal(O.clone(source, { unsupported: 'throw' }).view, view, 'shallow policy does not inspect children');
});

test('clone allocation does not require ArrayBuffer.detached or newer optional constructors', () => {
  const filename = path.resolve(__dirname, '../src/internal/clone.js');
  const output = { exports: {} };
  const context = vm.createContext({
    module: output,
    require: createRequire(filename),
    Buffer: undefined,
    BigInt: undefined,
    BigInt64Array: undefined,
    BigUint64Array: undefined,
    AggregateError: undefined,
    Float16Array: undefined
  });
  vm.runInContext('delete ArrayBuffer.prototype.detached;', context);
  vm.runInContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  const view = vm.runInContext(
    `
    const buffer = new ArrayBuffer(8, { maxByteLength: 16 });
    const view = new DataView(buffer, 4);
    buffer.resize(0);
    view;
  `,
    context
  );
  for (const method of ['clone', 'deepClone']) {
    assert.equal(output.exports[method](view), view);
    for (const value of [Object(1n), new BigInt64Array(1), new AggregateError([], 'foreign')]) {
      assert.equal(output.exports[method](value), value);
      assert.throws(() => output.exports[method](value, { unsupported: 'throw' }), { name: 'TypeError' });
    }
    const result = output.exports[method](new Date(123), { unsupported: 'throw' });
    assert.equal(Date.prototype.getTime.call(result), 123);
  }
});
