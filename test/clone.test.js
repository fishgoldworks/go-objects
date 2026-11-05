'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const O = require('..');
for (const method of ['clone', 'deepClone']) {
  for (const value of [null, undefined, 1, -0, NaN, true, 'abc', Symbol('x'), 1n])
    test(method + ' passes primitives through: ' + String(value), () => assert.ok(Object.is(O[method](value), value)));
  test(method + ' preserves descriptors and symbols without invoking accessors', () => {
    const s = Symbol('hidden');
    let reads = 0;
    const input = Object.create(null);
    Object.defineProperties(input, {
      hidden: { value: { n: 1 }, enumerable: false },
      computed: {
        get() {
          reads++;
          return 3;
        },
        configurable: true
      }
    });
    Object.defineProperty(input, s, { value: 4 });
    const copy = O[method](input);
    assert.notEqual(copy, input);
    assert.equal(Object.getPrototypeOf(copy), null);
    assert.equal(reads, 0);
    assert.deepEqual(Reflect.ownKeys(copy), ['hidden', 'computed', s]);
    for (const key of ['computed', s])
      assert.deepEqual(Object.getOwnPropertyDescriptor(copy, key), Object.getOwnPropertyDescriptor(input, key));
    assert.equal(Object.getOwnPropertyDescriptor(copy, 'hidden').writable, false);
    assert.equal(copy.hidden === input.hidden, method === 'clone');
  });
  test(method + ' preserves array holes and non-extensibility', () => {
    const input = [];
    input[3] = { x: 1 };
    Object.freeze(input);
    const copy = O[method](input);
    assert.equal(copy.length, 4);
    assert.equal(0 in copy, false);
    assert.equal(Object.isFrozen(copy), true);
    assert.notEqual(copy, input);
  });
  test(method + ' ignores shadowed constructor and toStringTag getter', () => {
    let calls = 0;
    const input = { constructor: 7, a: 1 };
    Object.defineProperty(input, Symbol.toStringTag, {
      get() {
        calls++;
        return 'Map';
      }
    });
    const copy = O[method](input);
    assert.equal(copy.a, 1);
    assert.equal(copy.constructor, 7);
    assert.equal(calls, 0);
  });
  test(method + ' clones cross-realm plain records and built-ins', () => {
    const input = vm.runInNewContext(
      '({data:{n:1}, date:new Date(123), map:new Map([[1,2]]), view:new Uint16Array([3,4])})'
    );
    const copy = O[method](input);
    assert.notEqual(copy, input);
    assert.equal(copy.data.n, 1);
    if (method === 'deepClone') {
      assert.notEqual(copy.data, input.data);
      assert.equal(copy.date.getTime(), 123);
      assert.equal(copy.map.get(1), 2);
      assert.equal(copy.view[1], 4);
    }
  });
  test(method + ' explicitly preserves unsupported references or throws in strict mode', () => {
    class Secret {
      #value = 1;
      get() {
        return this.#value;
      }
    }
    for (const value of [
      () => 1,
      Promise.resolve(1),
      new WeakMap(),
      new WeakSet(),
      new Secret(),
      new URL('https://example.test'),
      new SharedArrayBuffer(2)
    ]) {
      assert.equal(O[method](value), value);
      assert.throws(() => O[method](value, { unsupported: 'throw' }), TypeError);
    }
    assert.throws(() => O[method]({}, { unsupported: 'ignore' }), TypeError);
    assert.throws(() => O[method]({}, null), TypeError);
  });
  for (const [name, input, check] of [
    ['Date', new Date(123), (v) => assert.equal(v.getTime(), 123)],
    [
      'RegExp',
      Object.assign(/a+/gi, { lastIndex: 2 }),
      (v) => {
        assert.equal(v.source, 'a+');
        assert.equal(v.flags, 'gi');
        assert.equal(v.lastIndex, 2);
      }
    ],
    ['Boolean', new Boolean(true), (v) => assert.equal(v.valueOf(), true)],
    ['Number', new Number(42), (v) => assert.equal(v.valueOf(), 42)],
    ['String', new String('abc'), (v) => assert.equal(v.valueOf(), 'abc')],
    ['BigInt', Object(4n), (v) => assert.equal(v.valueOf(), 4n)],
    ['Symbol', Object(Symbol.for('test')), (v) => assert.equal(v.valueOf(), Symbol.for('test'))],
    ['ArrayBuffer', new Uint8Array([1, 2, 3]).buffer, (v) => assert.deepEqual([...new Uint8Array(v)], [1, 2, 3])],
    [
      'DataView',
      new DataView(new Uint8Array([1, 2, 3, 4]).buffer, 1, 2),
      (v) => {
        assert.equal(v.byteLength, 2);
        assert.equal(v.byteOffset, 1);
        assert.equal(v.getUint8(0), 2);
      }
    ]
  ])
    test(method + ' copies ' + name + ' internal state', () => {
      const result = O[method](input);
      assert.notEqual(result, input);
      check(result);
    });
  for (const C of [
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
  ])
    test(method + ' supports ' + C.name, () => {
      const input = new C(C === BigInt64Array || C === BigUint64Array ? [1n, 2n] : [1, 2]);
      const copy = O[method](input);
      assert.notEqual(copy, input);
      assert.deepEqual([...copy], [...input]);
      assert.notEqual(copy.buffer, input.buffer);
    });
  test(method + ' clones Error data including non-enumerable cause', () => {
    const input = new TypeError('oops', { cause: { why: 1 } });
    const copy = O[method](input);
    assert.notEqual(copy, input);
    assert.equal(copy.message, 'oops');
    assert.equal(copy.name, 'TypeError');
    assert.equal(copy instanceof TypeError, true);
    assert.equal(copy.cause === input.cause, method === 'clone');
  });
  test(method + ' clones Node Buffers without sharing memory', () => {
    const input = Buffer.from([1, 2, 3]);
    const copy = O[method](input);
    assert.equal(Buffer.isBuffer(copy), true);
    assert.deepEqual([...copy], [1, 2, 3]);
    copy[0] = 9;
    assert.equal(input[0], 1);
  });
}
test('deepClone isolates all descendant records', () => {
  const input = { a: { b: { n: 1 } } },
    copy = O.deepClone(input);
  copy.a.b.n = 2;
  assert.equal(input.a.b.n, 1);
});
test('deepClone preserves cycles, aliases and property-order independence', () => {
  const child = { n: 1 };
  const input = {};
  input.self = input;
  input.a = child;
  input.b = child;
  child.parent = input;
  const copy = O.deepClone(input);
  assert.equal(copy.self, copy);
  assert.equal(copy.a, copy.b);
  assert.equal(copy.a.parent, copy);
  assert.notEqual(copy.a, child);
});
test('deepClone preserves graph identity across Map keys, Set values and normal properties', () => {
  const shared = { n: 1 };
  const map = new Map();
  const set = new Set();
  const input = { shared, map, set };
  map.set(shared, input);
  map.set(map, set);
  set.add(shared);
  set.add(set);
  const copy = O.deepClone(input);
  assert.equal(copy.map.get(copy.shared), copy);
  assert.equal(copy.map.get(copy.map), copy.set);
  assert.ok(copy.set.has(copy.shared));
  assert.ok(copy.set.has(copy.set));
  assert.equal(copy.map.has(shared), false);
});
test('shallow clone copies containers but retains their members', () => {
  const child = { n: 1 };
  const map = new Map([[child, child]]);
  const set = new Set([child]);
  assert.equal(O.clone(map).get(child), child);
  assert.ok(O.clone(set).has(child));
  assert.equal(O.clone({ child }).child, child);
});
test('deepClone reconnects multiple views and buffer back references', () => {
  const buffer = new ArrayBuffer(16);
  const a = new Uint8Array(buffer, 2, 4);
  const b = new DataView(buffer, 4, 4);
  buffer.view = a;
  const input = { a, b, buffer };
  const copy = O.deepClone(input);
  assert.equal(copy.a.buffer, copy.buffer);
  assert.equal(copy.b.buffer, copy.buffer);
  assert.equal(copy.buffer.view, copy.a);
  assert.notEqual(copy.buffer, buffer);
  copy.a[2] = 99;
  assert.equal(copy.b.getUint8(0), 99);
});
test('strict deep cloning rejects nested unsupported values rather than silently sharing', () => {
  const f = () => 1;
  assert.throws(() => O.deepClone({ f }, { unsupported: 'throw' }), TypeError);
  assert.equal(O.deepClone({ f }).f, f);
});
test('deepClone handles 20,000 nested records without call-stack overflow', () => {
  const input = {};
  let n = input;
  for (let i = 0; i < 20000; i++) n = n.next = {};
  const copy = O.deepClone(input);
  let a = input,
    b = copy;
  for (let i = 0; i < 20000; i++) {
    assert.notEqual(a, b);
    a = a.next;
    b = b.next;
  }
});
test('clone does not call user constructors', () => {
  let calls = 0;
  class User {
    constructor() {
      calls++;
    }
  }
  const value = new User();
  assert.equal(O.deepClone(value), value);
  assert.equal(calls, 1);
});
test('Array subclasses follow the explicit custom-instance policy', () => {
  class CustomArray extends Array {
    #secret = 1;
    read() {
      return this.#secret;
    }
  }
  const input = new CustomArray(1, 2);
  assert.equal(O.deepClone(input), input);
  assert.throws(() => O.deepClone(input, { unsupported: 'throw' }), TypeError);
});
