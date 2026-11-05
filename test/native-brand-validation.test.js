'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const O = require('..');

test('immutable path copies preserve null-prototype arrays at every copied level', () => {
  const root = Object.setPrototypeOf([1, { n: 2 }], null);
  const changedRoot = O.setImmutable(root, [0], 7);
  assert.ok(Array.isArray(changedRoot));
  assert.equal(Object.getPrototypeOf(changedRoot), null);
  assert.equal(changedRoot[0], 7);
  assert.equal(root[0], 1);

  const nestedArray = Object.setPrototypeOf([{ n: 1 }, { n: 2 }], null);
  const source = { nested: nestedArray };
  const updated = O.updateImmutable(source, ['nested', 1, 'n'], (value) => value + 1);
  assert.notEqual(updated, source);
  assert.notEqual(updated.nested, nestedArray);
  assert.equal(Object.getPrototypeOf(updated.nested), null);
  assert.equal(updated.nested[1].n, 3);
  assert.equal(nestedArray[1].n, 2);

  const removed = O.unsetImmutable(source, ['nested', 0]);
  assert.equal(Object.getPrototypeOf(removed.nested), null);
  assert.equal(0 in removed.nested, false);
  assert.equal(removed.nested.length, 2);
});

const prototypeSpoofs = [
  ['Date', () => Object.create(Date.prototype)],
  ['RegExp', () => Object.create(RegExp.prototype)],
  ['Map', () => Object.create(Map.prototype)],
  ['Set', () => Object.create(Set.prototype)],
  ['Boolean', () => Object.create(Boolean.prototype)],
  ['Number', () => Object.create(Number.prototype)],
  ['String', () => Object.create(String.prototype)],
  ['BigInt', () => Object.create(BigInt.prototype)],
  ['Symbol', () => Object.create(Symbol.prototype)],
  ['DataView', () => Object.create(DataView.prototype)],
  ['Uint8Array', () => Object.create(Uint8Array.prototype)]
];

for (const method of ['clone', 'deepClone']) {
  test(`${method} applies the unsupported policy to prototype-spoofed built-ins`, () => {
    for (const [name, make] of prototypeSpoofs) {
      const value = make();
      assert.equal(O[method](value), value, `${name} should remain an opaque reference`);
      assert.throws(() => O[method](value, { unsupported: 'throw' }), TypeError, `${name} strict mode`);
    }
  });

  test(`${method} applies the unsupported policy to proxies around slot-backed built-ins`, () => {
    const values = [
      new Date(),
      /x/g,
      new Map([[1, 2]]),
      new Set([1]),
      new Boolean(true),
      new Number(1),
      new String('x'),
      Object(1n),
      Object(Symbol('x')),
      new DataView(new ArrayBuffer(4)),
      new Uint8Array(4)
    ];
    if (typeof Buffer !== 'undefined') values.push(Buffer.from([1, 2]));
    for (const value of values) {
      const proxy = new Proxy(value, {});
      assert.equal(O[method](proxy), proxy, `${Object.prototype.toString.call(value)} proxy should remain opaque`);
      assert.throws(() => O[method](proxy, { unsupported: 'throw' }), TypeError);
    }
  });
}
