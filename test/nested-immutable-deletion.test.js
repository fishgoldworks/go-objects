'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const O = require('..');

// Runtime counterparts of test/types/nested-immutable-deletion.*: the result declaration
// must account for only the selected child losing its required property.
for (const [label, key] of [
  ['string', 'selected'],
  ['number', 0],
  ['symbol', Symbol('selected')],
  ['pattern', 'user_selected']
]) {
  test('nested immutable deletion changes the selected ' + label + ' dictionary member only', () => {
    const child = { name: 'Michael', age: 42 };
    const untouched = { name: 'Other', age: 30 };
    const input = { [key]: child, untouched };
    const result = O.unsetImmutable(input, [key, 'name']);
    assert.notEqual(result, input);
    assert.notEqual(result[key], child);
    assert.equal(Object.hasOwn(result[key], 'name'), false);
    assert.equal(result[key].age, 42);
    assert.equal(result.untouched, untouched);
    assert.equal(input[key], child);
    assert.equal(child.name, 'Michael');
  });
}
for (const key of [0, '0']) {
  test('nested array deletion honours index ' + JSON.stringify(key) + ' without deleting the element', () => {
    const input = [
      { name: 'Michael', age: 42 },
      { name: 'Other', age: 30 }
    ];
    const result = O.unsetImmutable(input, [key, 'name']);
    assert.equal(Array.isArray(result), true);
    assert.equal(result.length, 2);
    assert.equal(Object.hasOwn(result, '0'), true);
    assert.deepEqual(result[0], { age: 42 });
    assert.equal(result[1], input[1]);
    assert.equal(input[0].name, 'Michael');
  });
}
test('nested dictionary-array deletion crosses every container without changing unrelated branches', () => {
  const input = { groups: { a: [{ name: 'Michael', age: 42 }] }, stable: { name: 'untouched' } };
  const result = O.unsetImmutable(input, ['groups', 'a', 0, 'name']);
  assert.deepEqual(result.groups.a[0], { age: 42 });
  for (const path of [[], ['groups'], ['groups', 'a'], ['groups', 'a', 0]]) {
    assert.notEqual(O.get(result, path), O.get(input, path));
  }
  assert.equal(result.stable, input.stable);
});
test('nested deletion through a missing dictionary entry retains the root', () => {
  const input = { rows: {} };
  assert.equal(O.unsetImmutable(input, ['rows', 'missing', 'name']), input);
});
test('immutable deletion wrapper result and current value describe the changed data', () => {
  const original = O([{ name: 'Michael', age: 42 }]);
  const result = original.unsetImmutable([0, 'name']);
  assert.deepEqual(result.unwrap(), [{ age: 42 }]);
  assert.equal(result.result(), result.unwrap());
  assert.equal(original.unwrap()[0].name, 'Michael');
});
for (const method of ['updateImmutable', 'unsetImmutable']) {
  test(method + ' retains cross-realm prototypes at every copied container', () => {
    const input = vm.runInNewContext('({rows:[{name:"Michael", age:42}]})');
    const result =
      method === 'updateImmutable'
        ? O[method](input, ['rows', 0, 'name'], () => 'Changed')
        : O[method](input, ['rows', 0, 'name']);
    for (const path of [[], ['rows'], ['rows', 0]]) {
      const original = O.get(input, path),
        copy = O.get(result, path);
      assert.notEqual(copy, original);
      assert.equal(Object.getPrototypeOf(copy), Object.getPrototypeOf(original));
    }
    assert.equal(input.rows[0].name, 'Michael');
  });
}
