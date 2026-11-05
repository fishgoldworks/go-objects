'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const O = require('..');
const names = require('node:fs')
  .readdirSync(require('node:path').join(__dirname, '../src'))
  .filter((n) => n.endsWith('.js') && n !== 'ObjectWrapper.js')
  .map((n) => n.slice(0, -3));

test('public namespace is callable and exports every standalone utility', () => {
  assert.equal(typeof O, 'function');
  assert.equal(names.length, 60);
  for (const name of names) assert.equal(O[name], require('../src/' + name), name);
});
test('wrapper factories are isolated', () => {
  const first = O({ a: 1 }),
    second = O({ b: 2 });
  assert.notEqual(first, second);
  assert.deepEqual(first.unwrap(), { a: 1 });
  assert.deepEqual(new O({ c: 3 }).unwrap(), { c: 3 });
});
test('wrapper pipelines transform intermediate results', () => {
  assert.deepEqual(
    O({ a: 1, b: 2 })
      .filter((v) => v > 1)
      .map((v) => v * 10)
      .result(),
    { b: 20 }
  );
});
test('wrapper mutations keep current input and expose operation result', () => {
  const input = { a: 1 };
  const wrapper = O(input).set('a', 2);
  assert.equal(wrapper.result(), 1);
  assert.equal(wrapper.unwrap(), input);
  assert.equal(wrapper.get('a').result(), 2);
});
test('wrapper nesting does not corrupt the outer chain', () => {
  assert.deepEqual(
    O({ a: 2 })
      .map((v) => O({ n: v }).get('n').result() * 3)
      .unwrap(),
    { a: 6 }
  );
});
test('property enumeration is own-only with strings and symbols', () => {
  const s = Symbol('key'),
    input = Object.assign(Object.create({ inherited: 9 }), { a: 1, [s]: 2 });
  Object.defineProperty(input, 'hidden', { value: 3 });
  assert.deepEqual(O.keys(input), ['a', s]);
  assert.deepEqual(O.values(input), [1, 2]);
  assert.deepEqual(O.entries(input), [
    ['a', 1],
    [s, 2]
  ]);
  assert.equal(O.hasKey(input, 'hidden'), false);
  assert.equal(O.hasProp(input, 'hidden'), true);
  assert.equal(O.hasProp(input, 'inherited'), false);
  assert.equal(O.hasKey(input, s), true);
  assert.equal(O.hasValue(input, 9), false);
  assert.equal(O.hasValue({ x: NaN }, NaN), true);
});
test('null-prototype, cross-realm and shadowed-method objects work', () => {
  const dict = Object.assign(Object.create(null), { a: 1, hasOwnProperty: 0 });
  assert.equal(O.hasProp(dict, 'a'), true);
  assert.deepEqual(O.keys(dict), ['a', 'hasOwnProperty']);
  assert.deepEqual(O.keys(vm.runInNewContext('({a:1})')), ['a']);
  assert.equal(Object.getPrototypeOf(O.map(dict, (v) => v)), null);
});
for (const value of [null, undefined, 0, 'abc', true, Symbol('x'), 1n])
  test('read helpers tolerate ' + String(value), () => {
    assert.deepEqual(O.keys(value), []);
    assert.deepEqual(O.values(value), []);
    assert.deepEqual(O.entries(value), []);
    assert.equal(O.hasProp(value, 'x'), false);
    assert.equal(O.hasKey(value, 'x'), false);
    assert.equal(O.hasValue(value, 1), false);
  });
test('forEach and map use a consistent callback signature and read getters once', () => {
  let reads = 0;
  const input = {
    get a() {
      reads++;
      return 3;
    }
  };
  const seen = [];
  assert.equal(
    O.forEach(input, function (v, k, o) {
      seen.push([v, k, this === o, o === input]);
    }),
    input
  );
  assert.deepEqual(seen, [[3, 'a', true, true]]);
  assert.equal(reads, 1);
  assert.deepEqual(
    O.map({ a: 2 }, (v, k, o) => k + v + o.a),
    { a: 'a22' }
  );
});
test('mapKeys renames keys instead of mapping values', () => {
  assert.deepEqual(
    O.mapKeys({ a: 1, b: 2 }, (v, k) => k.toUpperCase()),
    { A: 1, B: 2 }
  );
  assert.deepEqual(
    O.mapKeys({ a: 1, b: 2 }, () => 'same'),
    { same: 2 }
  );
  assert.throws(() => O.mapKeys({ a: 1 }, () => ({})), TypeError);
});
test('search operations support predicates and SameValueZero values', () => {
  const input = { a: 2, b: 3, c: 2, d: NaN };
  assert.equal(
    O.find(input, (v) => v > 2),
    3
  );
  assert.equal(
    O.findLast(input, (v) => v === 2),
    2
  );
  assert.equal(O.findKey(input, 3), 'b');
  assert.deepEqual(O.findAll(input, 2), [2, 2]);
  assert.equal(O.count(input, 2), 2);
  assert.equal(O.findKey(input, NaN), 'd');
  assert.equal(O.find(input, 8), undefined);
  assert.equal(O.count(input, 8), 0);
  assert.deepEqual(O.findAll(input, 8), []);
  const f = () => 0;
  assert.equal(
    O.find({ f }, (v) => v === f),
    f
  );
});
test('reduce and reduceRight use the correct order and accumulator', () => {
  const input = { a: 1, b: 2, c: 3 };
  assert.equal(
    O.reduce(input, (a, v) => a + v, 0),
    6
  );
  assert.equal(
    O.reduce(input, (a, v) => a + v),
    6
  );
  assert.equal(
    O.reduceRight(input, (a, v) => a + v, ''),
    '321'
  );
  assert.equal(
    O.reduce({}, (a, v) => a + v, undefined),
    undefined
  );
  assert.throws(() => O.reduce({}, (a, v) => a + v), TypeError);
});
test('pick, omit, merge, intersect and except construct independent records', () => {
  const input = { a: 1, b: 2, c: NaN };
  assert.deepEqual(O.pick(input, ['b', 'missing']), { b: 2 });
  assert.deepEqual(O.omit(input, ['b', 'c']), { a: 1 });
  assert.deepEqual(O.merge(input, { a: 5 }), { a: 5, b: 2, c: NaN });
  assert.equal(input.a, 1);
  assert.deepEqual(O.intersect(input, { b: 2, c: NaN }), { b: 2, c: NaN });
  assert.deepEqual(O.except(input, { b: 2, c: NaN }), { a: 1 });
  assert.notEqual(O.intersect(input), input);
  assert.notEqual(O.except(input), input);
});
test('array mapping preserves holes while filtering compacts matched indices', () => {
  const input = [];
  input[2] = 3;
  input[4] = 5;
  input.extra = 9;
  const mapped = O.map(input, (v) => v * 2);
  assert.equal(mapped.length, 5);
  assert.equal(0 in mapped, false);
  assert.equal(mapped[2], 6);
  const filtered = O.filter(input, (v) => v > 3);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0], 5);
  assert.equal(filtered.extra, 9);
});
for (const name of ['remove', 'removeLast', 'removeAll', 'replace', 'replaceLast', 'replaceAll'])
  test(name + ' mutates matches and returns old values', () => {
    const input = { a: 1, b: 2, c: 1 };
    const result = O[name](input, 1, 9);
    assert.deepEqual(result, name.endsWith('All') ? [1, 1] : 1);
    const affected = name.endsWith('All') ? ['a', 'c'] : [name.endsWith('Last') ? 'c' : 'a'];
    for (const key of affected) {
      if (name.startsWith('remove')) assert.equal(Object.hasOwn(input, key), false);
      else assert.equal(input[key], 9);
    }
  });
test('replacement callbacks receive old values', () => {
  const input = { a: 1, b: 2 };
  assert.deepEqual(
    O.replaceAll(
      input,
      () => true,
      (v, k) => k + v
    ),
    [1, 2]
  );
  assert.deepEqual(input, { a: 'a1', b: 'b2' });
});
test('unsafe-looking keys remain ordinary own data in transformations', () => {
  const input = JSON.parse('{"__proto__":{"polluted":true},"constructor":1,"a":2}');
  for (const result of [
    O.map(input, (v) => v),
    O.filter(input, () => true),
    O.merge(input),
    O.pick(input, ['__proto__']),
    O.mapKeys({ a: 1 }, () => '__proto__')
  ]) {
    assert.equal(Object.getPrototypeOf(result), Object.prototype);
    assert.equal(Object.hasOwn(result, '__proto__'), true);
  }
  assert.equal({}.polluted, undefined);
});
test('callback errors and invalid configuration are not swallowed', () => {
  const err = new Error('callback');
  assert.throws(
    () =>
      O.map({ a: 1 }, () => {
        throw err;
      }),
    (e) => e === err
  );
  for (const fn of ['map', 'filter', 'forEach', 'mapKeys', 'reduce', 'reduceRight']) {
    assert.throws(() => O[fn]({ a: 1 }, null), TypeError);
    assert.throws(() => O[fn](null, () => true), TypeError);
  }
});
