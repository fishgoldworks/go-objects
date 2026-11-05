'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const O = require('..');

const matchers = [
  'find',
  'findLast',
  'findAll',
  'findKey',
  'findEntry',
  'some',
  'every',
  'remove',
  'removeLast',
  'removeAll',
  'deepFind',
  'deepFindLast',
  'deepFindAll',
  'deepFindKey',
  'findPath',
  'deepCount',
  'deepRemove',
  'deepRemoveLast',
  'deepRemoveAll'
];
for (const name of matchers)
  test(name + ' rejects a missing matcher before reading properties', () => {
    let reads = 0;
    const value = {
      get x() {
        reads++;
        return undefined;
      }
    };
    assert.throws(() => O[name](value), TypeError);
    assert.equal(reads, 0);
    assert.throws(() => O(value)[name](), TypeError);
    assert.equal(reads, 0);
  });
for (const name of ['replace', 'replaceLast', 'replaceAll', 'deepReplace', 'deepReplaceLast', 'deepReplaceAll']) {
  test(name + ' requires an explicit replacement before callbacks or mutation', () => {
    let calls = 0;
    const value = { a: 1 };
    assert.throws(
      () =>
        O[name](value, () => {
          calls++;
          return true;
        }),
      TypeError
    );
    assert.equal(calls, 0);
    assert.deepEqual(value, { a: 1 });
    O[name](value, 1, undefined);
    assert.ok(Object.hasOwn(value, 'a'));
    assert.equal(value.a, undefined);
  });
}
for (const name of ['set', 'setEach'])
  test(name + ' requires an explicit value', () => {
    const value = {};
    assert.throws(() => O[name](value, name === 'set' ? 'a' : ['a']), TypeError);
    assert.deepEqual(value, {});
    O[name](value, name === 'set' ? 'a' : ['a'], undefined);
    assert.ok(Object.hasOwn(value, 'a'));
  });
test('hasValue distinguishes omitted from explicit undefined', () => {
  assert.throws(() => O.hasValue({ a: undefined }), TypeError);
  assert.equal(O.hasValue({ a: undefined }, undefined), true);
});
test('wrapper transformations preserve earlier references', () => {
  const input = { a: 1, b: 2 },
    original = O(input),
    names = original.keys(),
    count = names.count();
  assert.notEqual(original, names);
  assert.notEqual(names, count);
  assert.equal(original.unwrap(), input);
  assert.equal(original.result(), input);
  assert.deepEqual(names.unwrap(), ['a', 'b']);
  assert.equal(count.unwrap(), 2);
});
test('wrapper mutations return independent bookkeeping without cloning data', () => {
  const obj = { n: 1 };
  const first = O(obj),
    second = first.set('n', 2),
    third = second.update('n', (x) => x + 1);
  assert.notEqual(first, second);
  assert.equal(first.unwrap(), obj);
  assert.equal(first.result(), obj);
  assert.equal(second.unwrap(), obj);
  assert.equal(second.result(), 1);
  assert.equal(third.result(), 2);
  assert.equal(obj.n, 3);
});
test('wrapper callbacks can branch without changing a running chain', () => {
  const original = O({ a: 1, b: 2 });
  const mapped = original.map((v) => {
    original.keys();
    return v * 2;
  });
  assert.deepEqual(original.unwrap(), { a: 1, b: 2 });
  assert.deepEqual(mapped.unwrap(), { a: 2, b: 4 });
});
