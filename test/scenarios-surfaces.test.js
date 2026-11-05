'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const O = require('..');
const { cases, mutations } = require('./fixtures/api-cases.js');

const esm = import('../package/index.mjs');
const browserEsm = import('../package/dist/go-objects.mjs');
const umd = require('../package/dist/go-objects.js');
const context = {};
vm.runInNewContext(fs.readFileSync(require.resolve('../package/dist/go-objects.js'), 'utf8'), context);
const canonical = (value) => {
  // Cross-realm record/array prototypes differ; convert only these small data fixtures.
  if (Array.isArray(value)) return Array.from(value, canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(Reflect.ownKeys(value).map((k) => [k, canonical(value[k])]));
  return value;
};

test('the hand-authored surface scenario table covers exactly all 60 public utilities', () => {
  assert.deepEqual(Object.keys(cases).sort(), Object.keys(O).sort());
  assert.equal(Object.keys(cases).length, 60);
});

for (const [name, make] of Object.entries(cases)) {
  test(name + ': literal contract result, mutations and persistent wrappers across module formats', async () => {
    const namespaces = [
      ['CJS', O],
      ['ESM', (await esm).default],
      ['UMD/CJS', umd],
      ['browser ESM', (await browserEsm).default],
      ['UMD global', context.Objects]
    ];
    for (const [format, api] of namespaces) {
      for (const wrapped of [false, true]) {
        const [source, args, expected, expectedMutation] = make();
        const snapshot = canonical(source);
        let output, chain;
        const first = api(source);
        if (wrapped) {
          chain = first[name](...args);
          output = chain.result();
          assert.notEqual(chain, first, format + ':' + name);
          assert.equal(first.unwrap(), source);
          assert.equal(first.result(), source);
          assert.equal(chain.unwrap(), mutations.has(name) ? source : output);
        } else output = api[name](source, ...args);
        assert.deepEqual(canonical(output), expected, format + ':' + name);
        if (expectedMutation) assert.deepEqual(canonical(source), expectedMutation, format + ':' + name + ':mutation');
        else assert.deepEqual(canonical(source), snapshot, format + ':' + name + ':unchanged');
        if (name === 'clone' || name === 'deepClone') {
          assert.notEqual(output, source);
          assert.equal(output.a === source.a, name === 'clone');
        }
      }
    }
    const direct = require('../src/' + name);
    const directEsm = (await import('../package/esm/' + name + '.mjs')).default;
    for (const fn of [direct, directEsm]) {
      const [source, args, expected] = make();
      assert.deepEqual(canonical(fn(source, ...args)), expected, 'standalone:' + name);
    }
  });
}

test('wrapper branches keep separate query results while explicit mutations share the underlying data', () => {
  const source = { a: 1, b: 2 },
    original = O(source);
  const first = original.set('a', 3),
    second = original.set('b', 4);
  assert.equal(first.result(), 1);
  assert.equal(second.result(), 2);
  assert.equal(first.unwrap(), source);
  assert.equal(second.unwrap(), source);
  const filtered = original.filter((v) => v === 3),
    entries = original.entries();
  assert.deepEqual(filtered.unwrap(), { a: 3 });
  assert.deepEqual(entries.unwrap(), [
    ['a', 3],
    ['b', 4]
  ]);
  assert.equal(original.result(), source);
});

test('wrapper exceptions never overwrite earlier bookkeeping', () => {
  const input = { a: 1 },
    first = O(input).set('a', 2),
    error = new Error('callback');
  assert.throws(
    () =>
      first.map(() => {
        throw error;
      }),
    (thrown) => thrown === error
  );
  assert.equal(first.unwrap(), input);
  assert.equal(first.result(), 1);
  assert.equal(input.a, 2);
});
