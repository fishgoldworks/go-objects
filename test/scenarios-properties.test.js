'use strict';
// Contract partitions: enumeration, selection, matching, effects, and writes.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const O = require('..');

const sampleValues = [
  ['undefined', undefined],
  ['null', null],
  ['false', false],
  ['true', true],
  ['zero', 0],
  ['negative zero', -0],
  ['NaN', NaN],
  ['Infinity', Infinity],
  ['negative Infinity', -Infinity],
  ['empty string', ''],
  ['string', '1'],
  ['bigint', 1n],
  ['symbol', Symbol('value')],
  ['object identity', {}]
];
for (const [label, value] of sampleValues) {
  test('literal matching: ' + label + ' across search, count, quantifiers and membership', () => {
    const other = Symbol('not a match');
    const input = { before: other, target: value, after: other };
    assert.equal(O.hasValue(input, value), true);
    assert.equal(O.findKey(input, value), 'target');
    assert.deepEqual(O.findEntry(input, value), ['target', value]);
    assert.deepEqual(O.findAll(input, value), [value]);
    assert.equal(O.count(input, value), 1);
    assert.equal(O.some(input, value), true);
    assert.equal(O.every(input, value), false);
    assert.equal(O.every({ target: value }, value), true);
    assert.equal(O.hasValue({ target: value }, other), false);
  });
}

test('numeric/string and structurally-equal references are not loose or deep matches', () => {
  const shared = { n: 1 };
  const input = { a: 1, b: '1', c: 1n, d: shared, e: { n: 1 } };
  assert.deepEqual(O.findAll(input, 1), [1]);
  assert.deepEqual(O.findAll(input, '1'), ['1']);
  assert.equal(O.count(input, shared), 1);
  assert.equal(O.findKey(input, { n: 1 }), undefined);
  assert.equal(O.hasValue({ x: -0 }, 0), true);
});

for (const enumerable of [false, true])
  for (const writable of [false, true])
    for (const configurable of [false, true]) {
      test(`descriptor partition: enumerable=${enumerable}, writable=${writable}, configurable=${configurable}`, () => {
        const symbol = Symbol('field');
        const input = {};
        for (const key of ['field', symbol])
          Object.defineProperty(input, key, { value: 3, enumerable, writable, configurable });
        assert.deepEqual(O.keys(input), enumerable ? ['field', symbol] : []);
        assert.deepEqual(O.values(input), enumerable ? [3, 3] : []);
        assert.equal(O.count(input), enumerable ? 2 : 0);
        assert.equal(O.hasProp(input, symbol), true);
        assert.equal(O.hasKey(input, symbol), enumerable);
        const mapped = O.map(input, (n) => n * 2);
        const picked = O.pick(input, ['field', symbol]);
        assert.deepEqual(Reflect.ownKeys(mapped), enumerable ? ['field', symbol] : []);
        if (enumerable) {
          assert.deepEqual(Object.getOwnPropertyDescriptor(mapped, symbol), {
            value: 6,
            enumerable: true,
            writable: true,
            configurable: true
          });
          assert.equal(picked.field, 3);
        }
        assert.equal(Object.getOwnPropertyDescriptor(input, 'field').writable, writable);
      });
    }

test('enumeration order is numeric indices, insertion-ordered strings, then symbols', () => {
  const s1 = Symbol('first'),
    s2 = Symbol('second');
  const input = { z: 'z', 10: 10, 2: 2, '01': '01', [-1]: -1, [s1]: 's1', a: 'a', [s2]: 's2' };
  const expected = ['2', '10', 'z', '01', '-1', 'a', s1, s2];
  assert.deepEqual(O.keys(input), expected);
  assert.deepEqual(
    O.entries(input).map(([key]) => key),
    expected
  );
  assert.equal(
    O.findKey(input, () => true),
    '2'
  );
  assert.equal(
    O.findLast(input, () => true),
    's2'
  );
  assert.deepEqual(
    O.reduce(input, (keys, _, key) => keys.concat([key]), []),
    expected
  );
  assert.deepEqual(
    O.reduceRight(input, (keys, _, key) => keys.concat([key]), []),
    [...expected].reverse()
  );
});

const visits = [
  ['forEach', (fn) => fn],
  ['map', (fn) => fn],
  [
    'mapKeys',
    (fn) => (v, k, o) => {
      fn(v, k, o);
      return k;
    }
  ],
  ['filter', (fn) => fn],
  ['findAll', (fn) => fn],
  ['count', (fn) => fn],
  ['every', (fn) => fn],
  [
    'some',
    (fn) => (v, k, o) => {
      fn(v, k, o);
      return false;
    }
  ],
  [
    'find',
    (fn) => (v, k, o) => {
      fn(v, k, o);
      return false;
    }
  ],
  [
    'findKey',
    (fn) => (v, k, o) => {
      fn(v, k, o);
      return false;
    }
  ],
  [
    'findEntry',
    (fn) => (v, k, o) => {
      fn(v, k, o);
      return false;
    }
  ]
];
for (const [name, callback] of visits) {
  test(name + ' snapshots keys, skips deleted/hidden keys and ignores appended keys', () => {
    const input = Object.assign(Object.create({ later: 999 }), { first: 1, later: 2, hiddenLater: 3 });
    const seen = [];
    O[name](
      input,
      callback((value, key, source) => {
        seen.push([key, value]);
        assert.equal(source, input);
        if (key === 'first') {
          delete input.later;
          Object.defineProperty(input, 'hiddenLater', { enumerable: false });
          input.appended = 4;
        }
        return true;
      })
    );
    assert.deepEqual(seen, [['first', 1]]);
  });
}

for (const name of [
  'forEach',
  'map',
  'mapKeys',
  'filter',
  'find',
  'findLast',
  'findAll',
  'findKey',
  'findEntry',
  'count',
  'some',
  'every'
]) {
  test(name + ' propagates callback error by identity and does not read subsequent values', () => {
    const error = new Error('sentinel');
    let reads = 0;
    const input = {
      get first() {
        reads++;
        return 1;
      },
      get second() {
        reads++;
        return 2;
      }
    };
    assert.throws(
      () =>
        O[name](input, () => {
          throw error;
        }),
      (thrown) => thrown === error
    );
    assert.equal(reads, 1);
  });
}

for (const name of ['reduce', 'reduceRight']) {
  test(name + ' handles a single undefined value without calling reducer', () => {
    let calls = 0;
    assert.equal(
      O[name]({ x: undefined }, () => {
        calls++;
      }),
      undefined
    );
    assert.equal(calls, 0);
    assert.equal(
      O[name](
        { x: 7 },
        (a, b) => {
          calls++;
          assert.equal(a, undefined);
          return b;
        },
        undefined
      ),
      7
    );
    assert.equal(calls, 1);
  });
  test(name + ' seeds from the first available value and skips deleted keys', () => {
    const source = {
      get a() {
        delete source.b;
        return 2;
      },
      b: 3
    };
    // In either traversal direction, the first available value seeds the reduction.
    const expected = name === 'reduce' ? 2 : 5;
    assert.equal(
      O[name](source, (a, b) => a + b),
      expected
    );
    assert.throws(() => O[name]([], () => 0), TypeError);
    assert.equal(
      O[name](new Array(3), () => 1, 10),
      10
    );
  });
  test(name + ' binds this and passes current key and original object', () => {
    const source = { a: 1, b: 2 };
    assert.equal(
      O[name](
        source,
        function (acc, value, key, object) {
          assert.equal(this, source);
          assert.equal(object, source);
          assert.equal(source[key], value);
          return acc + value;
        },
        0
      ),
      3
    );
  });
}

for (const name of ['pick', 'omit']) {
  test(name + ' rejects an invalid key list before reading any getter', () => {
    let calls = 0;
    const input = {
      get a() {
        calls++;
        return 1;
      }
    };
    for (const list of [null, {}, 'a', [undefined], [1.5], new Array(1)]) {
      assert.throws(() => O[name](input, list), TypeError);
      assert.equal(calls, 0);
    }
  });
}

test('pick canonicalizes duplicate numeric keys; omit excludes symbols by identity', () => {
  const s1 = Symbol('same'),
    s2 = Symbol('same');
  const object = { 1: 7, [s1]: 8, [s2]: 9 };
  assert.deepEqual(O.pick(object, [1, '1', s1]), { 1: 7, [s1]: 8 });
  assert.deepEqual(O.omit(object, [s1]), { 1: 7, [s2]: 9 });
});

for (const name of ['merge', 'intersect', 'except']) {
  test(name + ' validates every source before reading source values', () => {
    let reads = 0;
    const input = {
      get x() {
        reads++;
        return 1;
      }
    };
    assert.throws(() => O[name](input, {}, null), TypeError);
    assert.equal(reads, 0);
  });
  test(name + ' treats matching key/value pairs, symbols and NaN consistently', () => {
    const symbol = Symbol('key'),
      shared = {};
    const a = { x: NaN, y: shared, z: 1, [symbol]: 4 };
    const b = { x: NaN, y: shared, z: 2, [symbol]: 4 };
    const c = { x: NaN, y: {}, [symbol]: 4 };
    const expected =
      name === 'merge' ? { ...a, ...b, ...c } : name === 'intersect' ? { x: NaN, [symbol]: 4 } : { z: 1 };
    const actual = O[name](a, b, c);
    assert.deepEqual(actual, expected);
    assert.notEqual(actual, a);
    assert.equal(a.z, 1);
    assert.equal(a.y, shared);
  });
}

for (const name of ['remove', 'removeLast', 'removeAll', 'replace', 'replaceLast', 'replaceAll']) {
  test(name + ' returns old references and changes only the selected sparse-array entries', () => {
    const match = {},
      miss = {},
      list = new Array(7);
    list[1] = match;
    list[3] = miss;
    list[5] = match;
    const before = Object.keys(list),
      result = O[name](list, match, 99);
    assert.deepEqual(result, name.endsWith('All') ? [match, match] : match);
    const changed = name.endsWith('All') ? ['1', '5'] : name.endsWith('Last') ? ['5'] : ['1'];
    for (const key of before) {
      if (!changed.includes(key)) assert.equal(list[key], key === '3' ? miss : match);
      else if (name.startsWith('remove')) assert.equal(Object.hasOwn(list, key), false);
      else assert.equal(list[key], 99);
    }
    assert.equal(list.length, 7);
    assert.equal(Object.hasOwn(list, 0), false);
  });
  test(name + ' returns its no-match sentinel without modifying input', () => {
    const object = { a: 1 };
    assert.deepEqual(O[name](object, 9, 2), name.endsWith('All') ? [] : undefined);
    assert.deepEqual(object, { a: 1 });
  });
  if (name.endsWith('All'))
    test(name + ' preserves writes already completed before a later runtime failure', () => {
      const object = { a: 1 };
      Object.defineProperty(object, 'b', { value: 1, enumerable: true, writable: false, configurable: false });
      assert.throws(() => O[name](object, 1, 2), TypeError);
      assert.equal(object.b, 1);
      assert.equal(
        name.startsWith('remove') ? Object.hasOwn(object, 'a') : object.a,
        name.startsWith('remove') ? false : 2
      );
    });
}

for (const name of ['replace', 'replaceLast', 'replaceAll']) {
  test(name + ' can return a function as replacement data without invoking it', () => {
    let calls = 0;
    const fn = () => {
      calls++;
    };
    const input = { a: 1 };
    O[name](input, 1, () => fn);
    assert.equal(input.a, fn);
    assert.equal(calls, 0);
  });
  test(name + ' rejects a writable accessor without invoking its setter or replacement callback', () => {
    let setterCalls = 0,
      replacements = 0;
    const input = {
      get a() {
        return 1;
      },
      set a(value) {
        setterCalls++;
      }
    };
    assert.throws(
      () =>
        O[name](input, 1, () => {
          replacements++;
          return 2;
        }),
      TypeError
    );
    assert.equal(setterCalls, 0);
    assert.equal(replacements, 0);
  });
}

test('empty root distinctions stay explicit: reads, transformations, matchers and reductions', () => {
  for (const input of [{}, Object.create(null), [], new Array(5)]) {
    assert.equal(O.count(input), 0);
    assert.equal(O.count(input, undefined), 0);
    assert.equal(O.find(input, undefined), undefined);
    assert.equal(O.findEntry(input, undefined), undefined);
    assert.deepEqual(O.findAll(input, undefined), []);
    assert.equal(O.some(input, undefined), false);
    assert.equal(O.every(input, undefined), true);
    assert.equal(
      O.forEach(input, () => assert.fail('no properties')),
      input
    );
    assert.equal(
      O.reduce(input, () => assert.fail('no properties'), 4),
      4
    );
  }
});
