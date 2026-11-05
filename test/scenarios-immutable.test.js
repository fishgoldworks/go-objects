'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const O = require('..');

for (const [label, value] of [
  ['undefined', undefined],
  ['null', null],
  ['NaN', NaN],
  ['negative zero', -0],
  ['false', false],
  ['empty string', ''],
  ['bigint', 1n],
  ['symbol', Symbol('same')],
  ['object', {}],
  ['function', () => 1]
]) {
  test('immutable Object.is no-op: ' + label, () => {
    const inner = Object.freeze({ value }),
      root = Object.freeze({ inner });
    assert.equal(O.setImmutable(root, ['inner', 'value'], value), root);
    let calls = 0;
    assert.equal(
      O.updateImmutable(root, ['inner', 'value'], (current) => {
        calls++;
        assert.ok(Object.is(current, value));
        return current;
      }),
      root
    );
    assert.equal(calls, 1);
  });
}

for (const [from, to] of [
  [-0, 0],
  [0, -0],
  [NaN, 0],
  [undefined, null],
  [null, undefined]
]) {
  test(`immutable distinct value: ${Object.is(from, -0) ? '-0' : String(from)} to ${Object.is(to, -0) ? '-0' : String(to)}`, () => {
    const root = { a: { value: from }, offPath: {} };
    const output = O.setImmutable(root, ['a', 'value'], to);
    assert.notEqual(output, root);
    assert.notEqual(output.a, root.a);
    assert.equal(output.offPath, root.offPath);
    assert.ok(Object.is(output.a.value, to));
    assert.ok(Object.is(root.a.value, from));
  });
}

for (const enumerable of [false, true])
  for (const writable of [false, true])
    for (const configurable of [false, true]) {
      test(`immutable copied data descriptor: ${enumerable}/${writable}/${configurable}`, () => {
        const symbol = Symbol('extra'),
          child = {},
          input = { stable: child };
        Object.defineProperty(input, 'value', { value: 1, enumerable, writable, configurable });
        Object.defineProperty(input, symbol, { value: child, enumerable, writable, configurable });
        Object.preventExtensions(input);
        const output = O.setImmutable(input, 'value', 2);
        assert.deepEqual(Object.getOwnPropertyDescriptor(output, 'value'), {
          value: 2,
          enumerable,
          writable: true,
          configurable: true
        });
        assert.deepEqual(Object.getOwnPropertyDescriptor(output, symbol), {
          value: child,
          enumerable,
          writable: true,
          configurable: true
        });
        assert.equal(Object.isExtensible(output), true);
        assert.equal(Object.getOwnPropertyDescriptor(input, 'value').writable, writable);
        assert.equal(Object.getOwnPropertyDescriptor(input, 'value').configurable, configurable);
        assert.equal(output.stable, child);
        const removed = O.unsetImmutable(input, 'value');
        assert.equal(Object.hasOwn(removed, 'value'), false);
        assert.equal(input.value, 1);
      });
    }

test('immutable copies preserve non-configurable off-path accessors without executing them', () => {
  let reads = 0,
    writes = 0;
  const source = { n: 1 };
  Object.defineProperty(source, 'lazy', {
    get() {
      reads++;
      return 7;
    },
    set(_) {
      writes++;
    },
    enumerable: false,
    configurable: false
  });
  const descriptor = Object.getOwnPropertyDescriptor(source, 'lazy');
  for (const output of [
    O.setImmutable(source, 'n', 2),
    O.updateImmutable(source, 'n', (n) => n + 1),
    O.unsetImmutable(source, 'n')
  ]) {
    assert.deepEqual(Object.getOwnPropertyDescriptor(output, 'lazy'), descriptor);
  }
  assert.equal(reads, 0);
  assert.equal(writes, 0);
});

for (const method of ['setImmutable', 'updateImmutable', 'unsetImmutable']) {
  test(method + ' leaves source unchanged when reflection itself throws', () => {
    const error = new Error('reflection');
    const target = { n: 1 };
    const proxy = new Proxy(target, {
      ownKeys() {
        throw error;
      }
    });
    assert.throws(
      () => O[method](proxy, 'n', method === 'updateImmutable' ? () => 2 : 2),
      (thrown) => thrown === error
    );
    assert.deepEqual(target, { n: 1 });
  });
  test(method + ' rejects array subclasses without constructing a replacement instance', () => {
    let constructors = 0;
    class CustomArray extends Array {
      constructor() {
        super();
        constructors++;
        this.push({ n: 1 });
      }
    }
    const source = new CustomArray();
    assert.throws(() => O[method](source, [0, 'n'], method === 'updateImmutable' ? () => 2 : 2), TypeError);
    assert.equal(constructors, 1);
    assert.equal(source[0].n, 1);
  });
}

test('immutable array updates preserve non-index numeric-looking extras and holes', () => {
  const input = new Array(6);
  input[2] = { n: 1 };
  input['01'] = 8;
  input[-1] = 9;
  input[4294967295] = 10;
  const output = O.setImmutable(input, [2, 'n'], 3);
  assert.equal(output.length, 6);
  assert.deepEqual(Object.keys(output), ['2', '01', '-1', '4294967295']);
  assert.equal(output['01'], 8);
  assert.equal(output[-1], 9);
  assert.equal(output[4294967295], 10);
  assert.equal(output[2].n, 3);
  assert.equal(input[2].n, 1);
  const extended = O.setImmutable(input, [8], 1);
  assert.equal(extended.length, 9);
  assert.equal(input.length, 6);
  assert.equal(7 in extended, false);
});

test('immutable deletion of an explicit undefined differs from deletion of a hole', () => {
  const input = new Array(4);
  input[1] = undefined;
  assert.equal(O.unsetImmutable(input, [0]), input);
  const removed = O.unsetImmutable(input, [1]);
  assert.notEqual(removed, input);
  assert.equal(removed.length, 4);
  assert.equal(1 in removed, false);
  assert.equal(1 in input, true);
});

test('immutable updating can fill a missing branch with undefined without collapsing it', () => {
  const source = { a: undefined };
  const output = O.updateImmutable(source, ['a', 'b', 0, 'c'], () => undefined);
  assert.equal(source.a, undefined);
  assert.ok(Array.isArray(output.a.b));
  assert.equal(Object.hasOwn(output.a.b[0], 'c'), true);
  assert.equal(output.a.b[0].c, undefined);
});

test('immutable result stores replacement graphs and promises by reference', () => {
  const replacement = {};
  replacement.self = replacement;
  const source = { a: 1 };
  assert.equal(O.setImmutable(source, 'a', replacement).a, replacement);
  assert.equal(O.updateImmutable(source, 'a', () => replacement).a, replacement);
  const promise = Promise.resolve(8);
  assert.equal(O.updateImmutable(source, 'a', () => promise).a, promise);
  assert.equal(source.a, 1);
});

test('immutable no-op does not enumerate off-path properties or execute a throwing ownKeys trap', () => {
  const target = { n: NaN };
  let calls = 0;
  const proxy = new Proxy(target, {
    ownKeys() {
      calls++;
      throw new Error('unexpected copy');
    }
  });
  assert.equal(O.setImmutable(proxy, 'n', NaN), proxy);
  assert.equal(O.unsetImmutable(proxy, 'absent'), proxy);
  assert.equal(calls, 0);
});

test('immutable finite cycle paths create one copy per edited occurrence and preserve all other edges', () => {
  const a = { n: 1 },
    b = { n: 2 };
  a.next = b;
  b.next = a;
  const output = O.setImmutable(a, ['next', 'next', 'next', 'n'], 9);
  assert.notEqual(output, a);
  assert.notEqual(output.next, b);
  assert.notEqual(output.next.next, a);
  assert.notEqual(output.next.next.next, b);
  assert.equal(output.next.next.next.n, 9);
  assert.equal(output.next.next.next.next, a);
  assert.equal(a.n, 1);
  assert.equal(b.n, 2);
  assert.equal(b.next, a);
});

test('null-prototype arrays can be updated without requiring an inherited constructor', () => {
  const input = [1, 2];
  Object.setPrototypeOf(input, null);
  const output = O.setImmutable(input, [0], 7);
  assert.ok(Array.isArray(output));
  assert.equal(output[0], 7);
  assert.equal(output[1], 2);
  assert.equal(input[0], 1);
  assert.equal(Object.getPrototypeOf(input), null);
});
