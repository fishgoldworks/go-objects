'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const O = require('..');
const common = require('../src/internal/common');

const otherRealm = vm.runInNewContext('({ Object, record: { n: 1 } })');

// Advertising a native constructor does not make a custom prototype native.
function customRecord(NativeObject = Object, properties = { n: 1 }) {
  const proto = Object.create(null);
  Object.defineProperty(proto, 'constructor', { value: NativeObject });
  Object.defineProperty(proto, 'inherited', { value: 9, enumerable: true });
  return Object.assign(Object.create(proto), properties);
}

for (const [label, NativeObject] of [
  ['local', Object],
  ['foreign', otherRealm.Object]
]) {
  test(`plain-record recognition rejects a custom prototype advertising the ${label} Object constructor`, () => {
    const input = customRecord(NativeObject);
    assert.equal(common.isPlainRecord(input), false);
    assert.equal(common.traversable(input), false);
  });

  for (const method of ['clone', 'deepClone']) {
    test(`${method} keeps custom ${label}-constructor records opaque under both policies`, () => {
      const input = customRecord(NativeObject);
      assert.equal(O[method](input), input);
      assert.throws(() => O[method](input, { unsupported: 'throw' }), TypeError);
      assert.equal(input.n, 1);
    });
  }
}

for (const method of ['setImmutable', 'updateImmutable', 'unsetImmutable']) {
  for (const nested of [false, true]) {
    test(`${method} rejects a custom record ${nested ? 'on a nested path' : 'at the root'} before updates`, () => {
      const child = customRecord();
      const input = nested ? { child } : child;
      const path = nested ? ['child', 'n'] : ['n'];
      let calls = 0;
      const value =
        method === 'updateImmutable'
          ? () => {
              calls++;
              return 2;
            }
          : 2;
      const args = method === 'unsetImmutable' ? [input, path] : [input, path, value];
      assert.throws(() => O[method](...args), TypeError);
      assert.equal(calls, 0);
      assert.equal(child.n, 1);
      if (nested) assert.equal(input.child, child);
    });
  }
}

test('deep traversal visits a custom record edge without expanding its properties', () => {
  const child = customRecord();
  const visited = [];
  O.deepForEach({ child, tail: 2 }, (value, key, parent, path) => visited.push([key, path, value]));
  assert.deepEqual(visited, [
    ['child', ['child'], child],
    ['tail', ['tail'], 2]
  ]);
});

test('deep transformation retains a custom record leaf instead of normalising its prototype', () => {
  const child = customRecord();
  const input = { child };
  const result = O.deepMap(input, (value) => value);
  assert.notEqual(result, input);
  assert.equal(result.child, child);
  assert.equal(Object.getPrototypeOf(result.child), Object.getPrototypeOf(child));
});

for (const [name, run, options] of [
  ['clone', (config) => O.clone({ n: 1 }, config), { unsupported: 'reference' }],
  ['mapKeys', (config) => O.mapKeys({ n: 1 }, (_, key) => key, config), { onCollision: 'throw' }],
  ['deepForEach', (config) => O.deepForEach({ n: 1 }, () => {}, config), { maxDepth: 1 }],
  ['deepMapKeys', (config) => O.deepMapKeys({ n: 1 }, (_, key) => key, config), { arrays: 'preserve' }]
]) {
  test(`${name} rejects custom-prototype options but accepts supported record options`, () => {
    assert.throws(() => run(customRecord(Object, options)), TypeError);
    assert.doesNotThrow(() => run({ ...options }));
    assert.doesNotThrow(() => run(Object.assign(Object.create(null), options)));
    assert.doesNotThrow(() => run(Object.assign(new otherRealm.Object(), options)));
  });
}

test('plain-record recognition retains local, foreign and null prototypes without reading own constructors', () => {
  let reads = 0;
  for (const record of [{ n: 1 }, Object.assign(Object.create(null), { n: 1 }), otherRealm.record]) {
    Object.defineProperty(record, 'constructor', {
      configurable: true,
      get() {
        reads++;
        throw new Error('Own constructor data must not classify a record.');
      }
    });
    assert.equal(common.isPlainRecord(record), true);
    const result = O.setImmutable(record, ['n'], 2);
    assert.equal(Object.getPrototypeOf(result), Object.getPrototypeOf(record));
    assert.equal(result.n, 2);
    assert.equal(record.n, 1);
    assert.notEqual(O.deepClone(record), record);
  }
  assert.equal(reads, 0);
});

test('prototype constructor accessors and custom toString methods are not executed during recognition', () => {
  let calls = 0;
  const accessorPrototype = Object.defineProperty(Object.create(null), 'constructor', {
    get() {
      calls++;
      return Object;
    }
  });
  function Custom() {}
  Custom.toString = () => {
    calls++;
    return Function.prototype.toString.call(Object);
  };
  const customPrototype = Object.defineProperty(Object.create(null), 'constructor', { value: Custom });
  for (const proto of [accessorPrototype, customPrototype]) {
    assert.equal(common.isPlainRecord(Object.create(proto)), false);
  }
  assert.equal(calls, 0);
});

test('plain-record prototype reflection errors still propagate unchanged', () => {
  const error = new Error('prototype reflection');
  const proto = new Proxy(Object.create(null), {
    getOwnPropertyDescriptor() {
      throw error;
    }
  });
  assert.throws(
    () => common.isPlainRecord(Object.create(proto)),
    (caught) => caught === error
  );
});

test('all six property queries continue inspecting custom-prototype data without including inherited keys', () => {
  const symbol = Symbol('own');
  const input = customRecord(Object, { n: 1, [symbol]: 2 });
  assert.deepEqual(O.keys(input), ['n', symbol]);
  assert.deepEqual(O.values(input), [1, 2]);
  assert.deepEqual(O.entries(input), [
    ['n', 1],
    [symbol, 2]
  ]);
  assert.equal(O.hasKey(input, 'n'), true);
  assert.equal(O.hasProp(input, symbol), true);
  assert.equal(O.hasValue(input, 2), true);
  assert.equal(O.hasKey(input, 'inherited'), false);
  assert.equal(O.hasProp(input, 'constructor'), false);
  assert.equal(O.hasValue(input, 9), false);
});

test('hasValue treats function values as identities, not callbacks, and stops before later getters', () => {
  let calls = 0;
  const value = () => {
    calls++;
    throw new Error('This function is data.');
  };
  const input = {
    first: value,
    get later() {
      throw new Error('Membership already matched.');
    }
  };
  assert.equal(O.hasValue(input, value), true);
  assert.equal(
    O.hasValue({ first: value }, () => {}),
    false
  );
  assert.equal(calls, 0);
});

for (const method of ['hasKey', 'hasProp']) {
  test(`${method} rejects invalid keys before invoking target traps or key coercion`, () => {
    const error = new Error('Invalid keys should be rejected first.');
    const input = new Proxy(
      {},
      {
        getOwnPropertyDescriptor() {
          throw error;
        }
      }
    );
    const invalid = {
      [Symbol.toPrimitive]() {
        throw error;
      }
    };
    for (const key of [invalid, 0.5, NaN, Infinity, 9007199254740992, 1n, null, undefined]) {
      assert.equal(O[method](input, key), false);
    }
    assert.throws(
      () => O[method](input, 'valid'),
      (caught) => caught === error
    );
  });
}
