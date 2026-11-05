'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const O = require('..');

const containers = [
  ['record', () => ({ n: 1 })],
  ['null-prototype record', () => Object.assign(Object.create(null), { n: 1 })],
  [
    'sparse array',
    () => {
      const a = new Array(5);
      a[2] = 1;
      return a;
    }
  ],
  ['Map', () => new Map([['n', 1]])],
  ['Set', () => new Set([1])],
  ['Date', () => new Date(123)]
];
for (const method of ['clone', 'deepClone']) {
  for (const [label, factory] of containers)
    for (const [state, changeState] of [
      ['extensible', (value) => value],
      ['preventExtensions', Object.preventExtensions],
      ['sealed', Object.seal],
      ['frozen', Object.freeze]
    ]) {
      test(`${method} preserves ${label} integrity state: ${state}`, () => {
        const input = factory(),
          symbol = Symbol('alias'),
          child = { n: 1 };
        Object.defineProperty(input, 'hidden', { value: child, enumerable: false, configurable: true, writable: true });
        Object.defineProperty(input, symbol, { value: child, enumerable: true, configurable: true, writable: true });
        changeState(input);
        const copy = O[method](input);
        assert.notEqual(copy, input);
        assert.equal(Object.isExtensible(copy), Object.isExtensible(input));
        assert.equal(Object.isSealed(copy), Object.isSealed(input));
        assert.equal(Object.isFrozen(copy), Object.isFrozen(input));
        assert.deepEqual(Reflect.ownKeys(copy), Reflect.ownKeys(input));
        const expected = Object.getOwnPropertyDescriptor(input, 'hidden');
        assert.deepEqual(Object.getOwnPropertyDescriptor(copy, 'hidden'), { ...expected, value: copy.hidden });
        assert.equal(copy.hidden, copy[symbol]);
        assert.equal(copy.hidden === child, method === 'clone');
        if (method === 'deepClone') {
          copy.hidden.n = 2;
          assert.equal(child.n, 1);
        }
        if (label === 'sparse array') {
          assert.equal(copy.length, 5);
          assert.equal(0 in copy, false);
        }
        if (label === 'null-prototype record') assert.equal(Object.getPrototypeOf(copy), null);
        if (label === 'Map') assert.deepEqual([...Map.prototype.entries.call(copy)], [['n', 1]]);
        if (label === 'Set') assert.deepEqual([...Set.prototype.values.call(copy)], [1]);
      });
    }

  test(method + ' preserves invalid dates, NaN boxes and signed zero boxes', () => {
    assert.equal(Number.isNaN(O[method](new Date(NaN)).getTime()), true);
    assert.equal(Number.isNaN(O[method](new Number(NaN)).valueOf()), true);
    assert.ok(Object.is(O[method](new Number(-0)).valueOf(), -0));
    assert.equal(O[method](new String('')).valueOf(), '');
    assert.equal(O[method](new Boolean(false)).valueOf(), false);
  });

  for (const flags of ['', 'd', 'gims', 'uy', 'v', 'dgimsy']) {
    test(method + ' preserves RegExp native flags and frozen lastIndex: ' + (flags || '(none)'), () => {
      const input = new RegExp('a+', flags);
      input.lastIndex = 4;
      Object.freeze(input);
      const copy = O[method](input);
      assert.equal(copy.flags, input.flags);
      assert.equal(copy.source, 'a+');
      assert.equal(copy.lastIndex, 4);
      assert.equal(Object.isFrozen(copy), true);
    });
  }

  test(method + ' keeps unsupported subclasses opaque and never enumerates their properties', () => {
    let reads = 0;
    class CustomMap extends Map {
      constructor() {
        super([['n', 1]]);
      }
      get visible() {
        reads++;
        return 1;
      }
    }
    class CustomDate extends Date {}
    class CustomTyped extends Uint8Array {}
    for (const input of [new CustomMap(), new CustomDate(1), new CustomTyped(2)]) {
      assert.equal(O[method](input), input);
      assert.throws(() => O[method](input, { unsupported: 'throw' }), TypeError);
    }
    assert.equal(reads, 0);
  });

  test(method + ' validates options before looking at the input graph', () => {
    let reflections = 0;
    const input = new Proxy(
      {},
      {
        getPrototypeOf() {
          reflections++;
          return Object.prototype;
        }
      }
    );
    for (const options of [
      null,
      [],
      () => 1,
      { extra: 1 },
      { [Symbol('x')]: 1 },
      { unsupported: undefined },
      { unsupported: false },
      { unsupported: 'copy' }
    ]) {
      assert.throws(() => O[method](input, options), TypeError);
    }
    assert.equal(reflections, 0);
    const ordinary = { n: 1 };
    const copy = O[method](ordinary, Object.create(null));
    assert.notEqual(copy, ordinary);
    assert.deepEqual(copy, ordinary);
  });

  test(method + ' propagates revoked proxies and reflective exceptions', () => {
    const error = new Error('descriptor');
    const proxy = new Proxy(
      { a: 1 },
      {
        ownKeys() {
          throw error;
        }
      }
    );
    assert.throws(
      () => O[method](proxy),
      (thrown) => thrown === error
    );
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    assert.throws(() => O[method](revoked.proxy), TypeError);
  });

  test(method + ' cannot copy a detached buffer and does not hide the failure', () => {
    const input = new ArrayBuffer(8);
    const view = new DataView(input);
    structuredClone(input, { transfer: [input] });
    assert.equal(input.byteLength, 0);
    assert.throws(() => O[method](input), TypeError);
    assert.throws(() => O[method](view), TypeError);
  });
}

const typedArrays = [
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
];
if (typeof Float16Array !== 'undefined') typedArrays.push(Float16Array);
for (const Type of typedArrays)
  for (const method of ['clone', 'deepClone']) {
    test(`${method} preserves ${Type.name} subview bounds and independent backing memory`, () => {
      const big = Type === BigInt64Array || Type === BigUint64Array;
      const buffer = new ArrayBuffer(Type.BYTES_PER_ELEMENT * 5);
      const input = new Type(buffer, Type.BYTES_PER_ELEMENT, 3);
      input[0] = big ? 7n : 7;
      input[2] = big ? 9n : 9;
      const symbol = Symbol('meta'),
        child = { n: 1 };
      input[symbol] = child;
      const output = O[method](input);
      assert.notEqual(output.buffer, buffer);
      assert.equal(output.buffer.byteLength, buffer.byteLength);
      assert.equal(output.byteOffset, input.byteOffset);
      assert.equal(output.length, 3);
      assert.deepEqual([...output], [...input]);
      output[0] = big ? 1n : 1;
      assert.equal(input[0], big ? 7n : 7);
      assert.equal(output[symbol] === child, method === 'clone');
    });
  }

test('deepClone preserves zero-length views and end-of-buffer offsets', () => {
  const buffer = new ArrayBuffer(4),
    input = { buffer, bytes: new Uint8Array(buffer, 4, 0), view: new DataView(buffer, 4, 0) };
  const output = O.deepClone(input);
  assert.equal(output.bytes.buffer, output.buffer);
  assert.equal(output.view.buffer, output.buffer);
  assert.equal(output.bytes.byteOffset, 4);
  assert.equal(output.view.byteOffset, 4);
  assert.equal(output.bytes.length, 0);
  assert.equal(output.view.byteLength, 0);
  assert.notEqual(output.buffer, buffer);
});

test('deepClone ignores shadowed view buffer, offset and length accessors', () => {
  const input = new Uint8Array([1, 2, 3]);
  let reads = 0;
  for (const key of ['buffer', 'byteOffset', 'length'])
    Object.defineProperty(input, key, {
      get() {
        reads++;
        throw new Error(key);
      }
    });
  const output = O.deepClone(input);
  assert.equal(output[0], 1);
  assert.equal(output[2], 3);
  assert.equal(reads, 0);
  for (const key of ['buffer', 'byteOffset', 'length'])
    assert.equal(Object.getOwnPropertyDescriptor(output, key).get, Object.getOwnPropertyDescriptor(input, key).get);
});

test('deepClone preserves mixed Buffer/typed-array/DataView aliases in any root property order', () => {
  for (const order of [
    ['buffer', 'bytes', 'view', 'node'],
    ['node', 'view', 'bytes', 'buffer']
  ]) {
    const buffer = new ArrayBuffer(16);
    const values = {
      buffer,
      bytes: new Uint16Array(buffer, 2, 4),
      view: new DataView(buffer, 4, 4),
      node: Buffer.from(buffer, 4, 3)
    };
    const input = Object.fromEntries(order.map((key) => [key, values[key]]));
    buffer.owner = input;
    const output = O.deepClone(input);
    assert.equal(output.node.buffer, output.buffer);
    assert.equal(output.bytes.buffer, output.buffer);
    assert.equal(output.view.buffer, output.buffer);
    assert.equal(output.buffer.owner, output);
    assert.equal(Buffer.isBuffer(output.node), true);
    output.node[0] = 99;
    assert.equal(output.view.getUint8(0), 99);
    assert.equal(values.node[0], 0);
  }
});

test('deepClone preserves Error and AggregateError cause/error-list cycles', () => {
  const root = {};
  const error = new AggregateError([], 'problem', { cause: root });
  error.errors.push(error, root);
  root.error = error;
  const output = O.deepClone(root);
  assert.equal(output.error instanceof AggregateError, true);
  assert.equal(output.error.cause, output);
  assert.equal(output.error.errors[0], output.error);
  assert.equal(output.error.errors[1], output);
  assert.notEqual(output.error.errors, error.errors);
  assert.equal(error.cause, root);
});

test('strict clone policies distinguish shared children from traversed descriptor values and entries', () => {
  const fn = () => 1;
  for (const make of [
    () => ({ fn }),
    () => {
      const x = {};
      Object.defineProperty(x, 'fn', { value: fn });
      return x;
    },
    () => new Map([[fn, 1]]),
    () => new Map([[1, fn]]),
    () => new Set([fn])
  ]) {
    const input = make();
    assert.notEqual(O.clone(input, { unsupported: 'throw' }), input);
    assert.throws(() => O.deepClone(input, { unsupported: 'throw' }), TypeError);
  }
  const input = {
    get fn() {
      return fn;
    }
  };
  assert.equal(
    Object.getOwnPropertyDescriptor(O.deepClone(input, { unsupported: 'throw' }), 'fn').get,
    Object.getOwnPropertyDescriptor(input, 'fn').get
  );
});

test('shallow cloning self-references retains original targets rather than reconnecting copies', () => {
  const array = [];
  array.push(array);
  const map = new Map();
  map.set(map, map);
  const set = new Set();
  set.add(set);
  assert.equal(O.clone(array)[0], array);
  const mapCopy = O.clone(map);
  assert.equal(mapCopy.get(map), map);
  assert.equal(mapCopy.has(mapCopy), false);
  const setCopy = O.clone(set);
  assert.equal(setCopy.has(set), true);
  assert.equal(setCopy.has(setCopy), false);
});

test('cross-realm aliases between records, Map keys, boxed values and views remain coherent', () => {
  const input = vm.runInNewContext(
    `(() => { const key={n:1}, buffer=new ArrayBuffer(8); return {key, boxed:new Number(-0), map:new Map([[key,key]]), a:new Uint8Array(buffer), b:new DataView(buffer)}; })()`
  );
  const output = O.deepClone(input);
  assert.equal(output.map.get(output.key), output.key);
  assert.notEqual(output.key, input.key);
  assert.equal(output.a.buffer, output.b.buffer);
  assert.notEqual(output.a.buffer, input.a.buffer);
  assert.ok(Object.is(output.boxed.valueOf(), -0));
});
