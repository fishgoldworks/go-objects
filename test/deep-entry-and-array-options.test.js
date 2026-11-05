'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const O = require('..');
test('deepFindEntry is available on every API surface', () => {
  assert.equal(typeof O.deepFindEntry, 'function');
});
test('deepFindEntry returns a fresh path and the observed getter value', () => {
  let reads = 0,
    seen;
  const obj = {
    a: {
      get n() {
        return ++reads;
      }
    }
  };
  const found = O.deepFindEntry(obj, (value, key, parent, path) => {
    if (key === 'n') {
      seen = path;
      return true;
    }
    return false;
  });
  assert.deepEqual(found, [['a', 'n'], 1]);
  assert.equal(reads, 1);
  assert.notEqual(found[0], seen);
  seen.push('changed');
  assert.deepEqual(found[0], ['a', 'n']);
});
test('deepFindEntry handles undefined, symbols, cycles and misses', () => {
  const s = Symbol('field');
  const obj = { a: { [s]: undefined } };
  obj.self = obj;
  assert.deepEqual(O.deepFindEntry(obj, undefined), [['a', s], undefined]);
  assert.equal(O.deepFindEntry(obj, 99), undefined);
  assert.throws(() => O.deepFindEntry(obj), TypeError);
  assert.equal(O.deepFindEntry(obj, undefined, { maxDepth: 1 }), undefined);
  assert.equal(O.deepFindEntry(obj, undefined, { shouldDescend: () => false }), undefined);
  assert.equal(O.deepFindEntry(obj, undefined, { maxDepth: 0 }), undefined);
});
test('deepFindEntry stops before later getters and supports wrappers', () => {
  const obj = {
    a: 1,
    get b() {
      throw Error('late getter');
    }
  };
  assert.deepEqual(O(obj).deepFindEntry(1).unwrap(), [['a'], 1]);
});
test('deepMapKeys can preserve nested arrays without mapping structural keys', () => {
  const seen = [];
  const source = { users: [{ first_name: 'Michael' }, { first_name: 'Jess' }] };
  const actual = O.deepMapKeys(
    source,
    (v, k) => {
      seen.push(k);
      return k === 'first_name' ? 'firstName' : k;
    },
    { arrays: 'preserve' }
  );
  assert.deepEqual(actual, { users: [{ firstName: 'Michael' }, { firstName: 'Jess' }] });
  assert.deepEqual(seen, ['users', 'first_name', 'first_name']);
  assert.notEqual(actual.users, source.users);
});
test('deepMapKeys array preservation retains holes, length, symbols and extras', () => {
  const s = Symbol('extra');
  const input = new Array(4);
  input[2] = { a_b: 1 };
  input.foo_bar = 2;
  input[s] = 3;
  const output = O.deepMapKeys(input, (_, k) => (typeof k === 'string' ? k.replace('_', '') : k), {
    arrays: 'preserve'
  });
  assert.equal(output.length, 4);
  assert.ok(!(0 in output));
  assert.deepEqual(output[2], { ab: 1 });
  assert.equal(output.foobar, 2);
  assert.equal(output[s], 3);
  assert.equal(input.foo_bar, 2);
});
test('deepMapKeys preserved arrays keep cycles and shared output aliases', () => {
  const shared = [{ x_y: 1 }];
  const obj = { a: shared, b: shared };
  shared.push(obj);
  const out = O.deepMapKeys(obj, (_, k) => String(k).replace('_', ''), { arrays: 'preserve' });
  assert.equal(out.a, out.b);
  assert.equal(out.a[1], out);
  assert.deepEqual(out.a[0], { xy: 1 });
});
test('preserved array structure is protected from renamed extra properties', () => {
  for (const key of ['length', '0', '100'])
    for (const onCollision of ['throw', 'overwrite']) {
      const a = [];
      a.extra = 1;
      assert.throws(() => O.deepMapKeys(a, () => key, { arrays: 'preserve', onCollision }), TypeError);
    }
  const a = [];
  a.A = 1;
  a.a = 2;
  assert.throws(
    () => O.deepMapKeys(a, (_, k) => String(k).toLowerCase(), { arrays: 'preserve', onCollision: 'throw' }),
    TypeError
  );
});
test('array mode validates before any user callbacks', () => {
  let calls = 0;
  assert.throws(
    () =>
      O.deepMapKeys(
        {},
        () => {
          calls++;
          return 'x';
        },
        { arrays: 'wrong' }
      ),
    TypeError
  );
  assert.equal(calls, 0);
  assert.throws(() => O.deepMap({}, (x) => x, { arrays: 'preserve' }), TypeError);
});
test('legacy record mode and traversal cutoffs stay explicit', () => {
  assert.deepEqual(
    O.deepMapKeys([1], (_, k) => k),
    { 0: 1 }
  );
  assert.deepEqual(
    O.deepMapKeys([1], (_, k) => k, { arrays: 'record' }),
    { 0: 1 }
  );
  const obj = { a: [{ x: 1 }] };
  assert.equal(O.deepMapKeys(obj, (_, k) => k, { arrays: 'preserve', maxDepth: 1 }).a, obj.a);
  const empty = O.deepMapKeys(new Array(4), (_, k) => k, { arrays: 'preserve', maxDepth: 0 });
  assert.equal(empty.length, 4);
});
