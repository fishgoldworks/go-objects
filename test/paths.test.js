'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const O = require('..');
test('get parses dot, numeric bracket, quoted and escaped paths', () => {
  const input = { users: [{ name: 'Michael' }], 'a.b': { 'quote"key': 5 }, '': 7 };
  assert.equal(O.get(input, 'users[0].name'), 'Michael');
  assert.equal(O.get(input, '["a.b"]["quote\\"key"]'), 5);
  assert.equal(O.get(input, ['a.b', 'quote"key']), 5);
  assert.equal(O.get(input, ''), 7);
  assert.equal(O.get(input, []), input);
  assert.equal(O.get({ "it's": 3 }, "['it\\'s']"), 3);
});
test('path reads are own-only, null-safe and invoke each getter once', () => {
  assert.equal(O.get({ a: null }, 'a.b', 9), 9);
  assert.equal(O.get(null, 'a', 9), 9);
  assert.equal(O.get({ a: undefined }, 'a', 9), 9);
  assert.equal(O.get({ a: null }, 'a', 9), null);
  assert.equal(O.get({}, 'toString', 9), 9);
  assert.equal(O.get(Object.create({ a: 1 }), 'a', 9), 9);
  let reads = 0;
  assert.equal(
    O.get(
      {
        get a() {
          reads++;
          return { b: 2 };
        }
      },
      'a.b'
    ),
    2
  );
  assert.equal(reads, 1);
});
test('set creates missing arrays and returns the previous value', () => {
  const input = {};
  assert.equal(O.set(input, 'users[0].name', 'Michael'), undefined);
  assert.deepEqual(input, { users: [{ name: 'Michael' }] });
  assert.equal(O.set(input, ['users', 0, 'name'], 'Ko'), 'Michael');
  const key = Symbol();
  assert.equal(O.set(input, [key], 3), undefined);
  assert.equal(O.get(input, [key]), 3);
});
test('unset deletes without creating intermediate objects', () => {
  const input = { a: 1 };
  assert.equal(O.unset(input, 'a'), true);
  assert.equal(Object.hasOwn(input, 'a'), false);
  assert.equal(O.unset(input, 'missing.path'), true);
  assert.deepEqual(input, {});
  const arr = [1, 2];
  O.unset(arr, [0]);
  assert.equal(0 in arr, false);
  assert.equal(arr.length, 2);
});
test('getEach and setEach operate on multiple paths', () => {
  const input = { a: 1, b: { c: 2 } };
  assert.deepEqual(O.getEach(input, ['a', 'b.c', 'missing'], 0), [1, 2, 0]);
  assert.deepEqual(O.setEach(input, ['a', 'b.c'], 9), [1, 2]);
  assert.deepEqual(input, { a: 9, b: { c: 9 } });
});
for (const path of [
  '__proto__.polluted',
  'constructor.prototype.polluted',
  ['__proto__', 'polluted'],
  ['a', 'prototype', 'polluted'],
  '["__proto__"].polluted'
])
  test('unsafe mutation path rejected ' + String(path), () => {
    const input = {};
    assert.throws(() => O.set(input, path, 1), TypeError);
    assert.throws(() => O.unset(input, path), TypeError);
    assert.deepEqual(input, {});
    assert.equal({}.polluted, undefined);
  });
test('setEach validates all paths before any write', () => {
  const input = { a: 1 };
  assert.throws(() => O.setEach(input, ['a', '__proto__.x'], 9), TypeError);
  assert.equal(input.a, 1);
});
for (const path of ['a..b', 'a.', '.a', 'a[', 'a[]', 'a[nope]', 'a[1]b', 'a[1.2]', 'a["x]'])
  test('malformed path rejected ' + path, () => assert.throws(() => O.get({}, path), SyntaxError));
for (const path of [null, undefined, {}, true, [{}], [null], [NaN]])
  test('invalid path type rejected ' + String(path), () => assert.throws(() => O.get({}, path), TypeError));
test('mutation failures are explicit; setters and inherited intermediates are not followed', () => {
  assert.throws(() => O.set(Object.freeze({ a: 1 }), 'a', 2), TypeError);
  assert.throws(() => O.unset(Object.freeze({ a: 1 }), 'a'), TypeError);
  assert.throws(() => O.set({ a: null }, 'a.b', 2), TypeError);
  assert.throws(() => O.set({ a: 1 }, 'a.b', 2), TypeError);
  let invoked = 0;
  const obj = {
    get a() {
      invoked++;
      return {};
    },
    set a(v) {
      invoked++;
    }
  };
  assert.throws(() => O.set(obj, 'a.b', 1), TypeError);
  assert.throws(() => O.set(obj, 'a', 1), TypeError);
  assert.equal(invoked, 0);
  const proto = { a: { b: 1 } };
  const input = Object.create(proto);
  O.set(input, 'a.b', 2);
  assert.equal(proto.a.b, 1);
  assert.equal(input.a.b, 2);
  assert.throws(() => O.set({}, [], 1), RangeError);
  assert.throws(() => O.unset({}, []), RangeError);
});
test('quoted bracket paths decode escaped characters and unicode', () => {
  const obj = { 'a\nb': 1, '\u2603': 2, '\\': 3, '"': 4, "'": 5 };
  assert.equal(O.get(obj, '["a\\nb"]'), 1);
  assert.equal(O.get(obj, '["\\u2603"]'), 2);

  assert.equal(O.get(obj, '["\\\\"]'), 3);
  // eslint-disable-next-line no-useless-escape -- Keep the escaped delimiter visible in this parser regression.
  assert.equal(O.get(obj, '["\\\""]'), 4);
  // eslint-disable-next-line no-useless-escape -- Keep the escaped delimiter visible in this parser regression.
  assert.equal(O.get(obj, "['\\\'']"), 5);
  assert.equal(O.get({ a: [7] }, 'a[ 0 ]'), 7);
});
for (const path of ['["\\q"]', '["\\uZZZZ"]', '["unterminated\\', '["new\nline"]', '[9007199254740992]'])
  test('malformed escape or index rejected ' + path, () => assert.throws(() => O.get({}, path), SyntaxError));
test('unset handles existing nested properties and absent scalar parents', () => {
  const obj = { a: { b: 1 }, nil: null, missing: undefined, number: 1 };
  assert.equal(O.unset(obj, 'a.b'), true);
  assert.deepEqual(obj.a, {});
  for (const key of ['nil', 'missing', 'number']) assert.equal(O.unset(obj, key + '.x'), true);
});
test('direct symbol and numeric paths work', () => {
  const symbol = Symbol();
  const obj = { [symbol]: 1, 0: 2 };
  assert.equal(O.get(obj, symbol), 1);
  assert.equal(O.get(obj, 0), 2);
  assert.equal(O.set(obj, symbol, 3), 1);
  assert.equal(O.get(obj, symbol), 3);
});
test('list operations reject non-arrays and empty setEach is a no-op', () => {
  for (const fn of ['getEach', 'setEach']) assert.throws(() => O[fn]({}, 'a', 1), TypeError);
  assert.deepEqual(O.setEach({}, [], 1), []);
});
