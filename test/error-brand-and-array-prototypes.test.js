'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const O = require('..');

const errorConstructors = [
  Error,
  EvalError,
  RangeError,
  ReferenceError,
  SyntaxError,
  TypeError,
  URIError,
  AggregateError
];

for (const method of ['clone', 'deepClone']) {
  test(`${method} does not upgrade prototype-spoofed Error-family objects`, () => {
    for (const NativeError of errorConstructors) {
      const fake = Object.create(NativeError.prototype);
      assert.equal(O[method](fake), fake, `${NativeError.name} spoof should remain opaque`);
      assert.throws(() => O[method](fake, { unsupported: 'throw' }), TypeError, `${NativeError.name} strict policy`);

      const taggedFake = Object.create(NativeError.prototype);
      Object.defineProperty(taggedFake, Symbol.toStringTag, { value: 'Error', configurable: true });
      assert.equal(O[method](taggedFake), taggedFake, `${NativeError.name} @@toStringTag spoof should remain opaque`);
      assert.throws(() => O[method](taggedFake, { unsupported: 'throw' }), TypeError);
    }
  });

  test(`${method} treats proxies around genuine Error-family values as unsupported`, () => {
    for (const NativeError of errorConstructors) {
      const real = NativeError === AggregateError ? new AggregateError([], 'x') : new NativeError('x');
      const proxy = new Proxy(real, {});
      assert.equal(O[method](proxy), proxy, `${NativeError.name} proxy should remain opaque`);
      assert.throws(() => O[method](proxy, { unsupported: 'throw' }), TypeError);
    }
  });
}

function unusualArray() {
  const prototype = [];
  const value = [1, { n: 2 }];
  Object.setPrototypeOf(value, prototype);
  return { value, prototype };
}

for (const method of ['setImmutable', 'updateImmutable', 'unsetImmutable']) {
  test(`${method} rejects arrays with non-native, non-null array prototypes`, () => {
    const { value, prototype } = unusualArray();
    let called = false;
    const invoke =
      method === 'setImmutable'
        ? () => O.setImmutable(value, [0], 9)
        : method === 'updateImmutable'
          ? () =>
              O.updateImmutable(value, [0], (current) => {
                called = true;
                return current + 1;
              })
          : () => O.unsetImmutable(value, [0]);
    assert.throws(invoke, TypeError);
    assert.equal(Object.getPrototypeOf(value), prototype);
    assert.equal(value[0], 1);
    if (method === 'updateImmutable') assert.equal(called, false, 'updater must not run before container validation');
  });
}

test('immutable helpers continue to accept genuine cross-realm arrays', () => {
  const value = vm.runInNewContext('[1, { n: 2 }]');
  const changed = O.setImmutable(value, [0], 9);
  assert.ok(Array.isArray(changed));
  assert.equal(changed[0], 9);
  assert.equal(value[0], 1);

  const nested = O.updateImmutable({ value }, ['value', 1, 'n'], (current) => current + 1);
  assert.equal(nested.value[1].n, 3);
  assert.equal(value[1].n, 2);
});
