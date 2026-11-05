'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const O = require('..');
const { cases } = require('./fixtures/api-cases.js');
const required = {
  clone: 1,
  deepClone: 1,
  count: 1,
  keys: 1,
  values: 1,
  entries: 1,
  hasKey: 2,
  hasProp: 2,
  hasValue: 2,
  has: 2,
  get: 2,
  getEach: 2,
  set: 3,
  setEach: 3,
  update: 3,
  unset: 2,
  setImmutable: 3,
  updateImmutable: 3,
  unsetImmutable: 2,
  forEach: 2,
  map: 2,
  mapKeys: 2,
  filter: 2,
  reduce: 2,
  reduceRight: 2,
  pick: 2,
  omit: 2,
  merge: 1,
  intersect: 1,
  except: 1,
  some: 2,
  every: 2,
  find: 2,
  findLast: 2,
  findAll: 2,
  findKey: 2,
  findEntry: 2,
  remove: 2,
  removeLast: 2,
  removeAll: 2,
  replace: 3,
  replaceLast: 3,
  replaceAll: 3,
  deepForEach: 2,
  deepCount: 2,
  deepFind: 2,
  deepFindLast: 2,
  deepFindAll: 2,
  deepFindKey: 2,
  findPath: 2,
  deepFindEntry: 2,
  deepMap: 2,
  deepMapKeys: 2,
  deepFilter: 2,
  deepRemove: 2,
  deepRemoveLast: 2,
  deepRemoveAll: 2,
  deepReplace: 3,
  deepReplaceLast: 3,
  deepReplaceAll: 3
};
const tolerant = new Set([
  'clone',
  'deepClone',
  'keys',
  'values',
  'entries',
  'hasKey',
  'hasProp',
  'hasValue',
  'get',
  'has',
  'getEach'
]);
test('required-argument matrix includes every public utility', () =>
  assert.deepEqual(Object.keys(required).sort(), Object.keys(O).sort()));
for (const [name, minimum] of Object.entries(required)) {
  test(name + ' rejects every omitted required-argument position through standalone and wrapper calls', () => {
    for (let supplied = 0; supplied < minimum; supplied++) {
      const [input, args] = cases[name]();
      assert.throws(() => O[name](...[input, ...args].slice(0, supplied)), TypeError, `${name}: supplied=${supplied}`);
      if (supplied > 0) assert.throws(() => O(input)[name](...args.slice(0, supplied - 1)), TypeError);
    }
  });
  if (!tolerant.has(name))
    test(name + ' rejects nullish and scalar collection roots', () => {
      for (const root of [undefined, null, false, 0, NaN, '', 'abc', 1n, Symbol('input')]) {
        const [, args] = cases[name]();
        assert.throws(() => O[name](root, ...args), TypeError, `${name}: ${String(root)}`);
      }
    });
}
