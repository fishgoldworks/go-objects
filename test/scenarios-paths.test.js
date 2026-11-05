'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const O = require('..');

const operations = {
  get: (o, p) => O.get(o, p, 'fallback'),
  has: (o, p) => O.has(o, p),
  getEach: (o, p) => O.getEach(o, [p], 'fallback'),
  set: (o, p) => O.set(o, p, 8),
  update: (o, p, fn = () => 8) => O.update(o, p, fn),
  unset: (o, p) => O.unset(o, p),
  setEach: (o, p) => O.setEach(o, [p], 8),
  setImmutable: (o, p) => O.setImmutable(o, p, 8),
  updateImmutable: (o, p, fn = () => 8) => O.updateImmutable(o, p, fn),
  unsetImmutable: (o, p) => O.unsetImmutable(o, p)
};
const valid = [
  ['literal empty key', '', ''],
  ['quoted empty key', '[""]', ''],
  ['dot in quoted key', '["a.b"]', 'a.b'],
  ['brackets in quoted key', '["a[b]"]', 'a[b]'],
  // eslint-disable-next-line no-useless-escape -- Keep the escaped delimiter visible in this parser regression.
  ['escaped double quote', '["a\\\"b"]', 'a"b'],
  ['escaped single quote', "['it\\'s']", "it's"],
  ['escaped backslash', '["a\\\\b"]', 'a\\b'],
  ['escaped newline', '["a\\nb"]', 'a\nb'],
  ['escaped carriage return', '["a\\rb"]', 'a\rb'],
  ['escaped tab', '["a\\tb"]', 'a\tb'],
  ['escaped backspace', '["a\\bb"]', 'a\bb'],
  ['escaped form feed', '["a\\fb"]', 'a\fb'],
  ['escaped vertical tab', '["a\\vb"]', 'a\vb'],
  ['Unicode escape', '["\\u0061"]', 'a'],
  ['surrogate pair', '["\\uD83D\\uDE00"]', '😀'],
  ['literal Unicode', '["한글"]', '한글'],
  ['bracket whitespace', '[ \n "a" \t ]', 'a'],
  ['leading-zero quoted string', '["01"]', '01'],
  ['negative integer', '[-2]', '-2'],
  ['negative zero', '[-0]', '0'],
  ['maximum safe integer', '[9007199254740991]', '9007199254740991'],
  ['minimum safe integer', '[-9007199254740991]', '-9007199254740991'],
  ['numeric key argument', -2, '-2'],
  ['whitespace literal key', ' a ', ' a ']
];
const token = Symbol('path');
valid.push(['symbol argument', token, token], ['symbol segment', [token], token]);
for (const [label, path, key] of valid) {
  test('path grammar round-trip: ' + label, () => {
    const source = Object.create(null);
    Object.defineProperty(source, key, { value: 7, writable: true, enumerable: true, configurable: true });
    assert.equal(O.get(source, path), 7);
    assert.equal(O.has(source, path), true);
    assert.deepEqual(O.getEach(source, [path]), [7]);
    assert.equal(O.set(source, path, 8), 7);
    assert.equal(source[key], 8);
    assert.equal(
      O.update(source, path, (n) => n + 1),
      8
    );
    assert.equal(source[key], 9);
    assert.deepEqual(O.setEach(source, [path], 10), [9]);
    assert.equal(source[key], 10);
    const copy = O.setImmutable(source, path, 11);
    assert.equal(copy[key], 11);
    assert.equal(source[key], 10);
    const updated = O.updateImmutable(source, path, (n) => n + 2);
    assert.equal(updated[key], 12);
    const removed = O.unsetImmutable(source, path);
    assert.equal(Object.hasOwn(removed, key), false);
    assert.equal(source[key], 10);
    assert.equal(O.unset(source, path), true);
    assert.equal(Object.hasOwn(source, key), false);
  });
}

const malformed = [
  '.',
  '.x',
  'x.',
  'x..y',
  'x.[0]',
  'x[0].',
  'x[0]z',
  'x]',
  '[',
  '[]',
  '[ ]',
  '[+1]',
  '[01]',
  '[-01]',
  '[1.0]',
  '[1e2]',
  '[0x10]',
  '[Infinity]',
  '[NaN]',
  '[9007199254740992]',
  '[-9007199254740992]',
  '[foo]',
  '["a"',
  '["a"x]',
  '["a\\q"]',
  '["a\\x61"]',
  '["a\\u1"]',
  '["a\\uZZZZ"]',
  '["raw\nnewline"]',
  "['unterminated]",
  '["escaped\\',
  'a[0]]',
  '[0][',
  'a[0]..x'
];
for (const [name, operation] of Object.entries(operations)) {
  test(name + ' rejects every malformed grammar partition without invoking accessors/updaters', () => {
    let calls = 0;
    const source = {
      get x() {
        calls++;
        return {};
      }
    };
    for (const path of malformed) {
      assert.throws(
        () =>
          operation(source, path, () => {
            calls++;
            return 1;
          }),
        SyntaxError,
        `${name}: ${JSON.stringify(path)}`
      );
    }
    assert.equal(calls, 0);
    assert.deepEqual(Reflect.ownKeys(source), ['x']);
  });
  test(name + ' rejects invalid path types and sparse segments without coercion', () => {
    let calls = 0;
    const coercible = {
      [Symbol.toPrimitive]() {
        calls++;
        return 'x';
      }
    };
    const paths = [
      null,
      undefined,
      false,
      true,
      {},
      coercible,
      () => 1,
      NaN,
      Infinity,
      1.5,
      1n,
      Number.MAX_SAFE_INTEGER + 1,
      [undefined],
      [null],
      [coercible],
      new Array(1)
    ];
    for (const path of paths) assert.throws(() => operation({}, path), TypeError);
    assert.equal(calls, 0);
  });
}

const mutations = Object.entries(operations).filter(([name]) => !['get', 'getEach', 'has'].includes(name));
for (const [name, operation] of mutations) {
  test(name + ' blocks all prototype-sensitive segments in literal, bracket, encoded and array paths', () => {
    let calls = 0;
    const source = { safe: {} };
    for (const segment of ['__proto__', 'constructor', 'prototype']) {
      const escaped = [...segment].map((ch) => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0')).join('');
      for (const path of [
        segment,
        [segment],
        `safe.${segment}.marker`,
        ['safe', segment, 'marker'],
        `["${segment}"].marker`,
        `["${escaped}"].marker`,
        `safe["${escaped}"].marker`
      ]) {
        assert.throws(
          () =>
            operation(source, path, () => {
              calls++;
              return 1;
            }),
          TypeError
        );
      }
    }
    assert.equal(calls, 0);
    assert.deepEqual(source, { safe: {} });
    assert.equal(Object.hasOwn(Object.prototype, 'marker'), false);
  });
}

test('read helpers can inspect prototype-sensitive own data without following prototypes', () => {
  const input = JSON.parse('{"__proto__":{"constructor":{"prototype":3}}}');
  assert.equal(O.get(input, ['__proto__', 'constructor', 'prototype']), 3);
  assert.equal(O.has(input, ['__proto__', 'constructor', 'prototype']), true);
  assert.equal(O.get({}, 'constructor.prototype', 'fallback'), 'fallback');
  assert.equal(O.has({}, '__proto__'), false);
});

for (const [label, value] of [
  ['undefined', undefined],
  ['null', null],
  ['false', false],
  ['zero', 0],
  ['empty string', ''],
  ['NaN', NaN]
]) {
  test('read fallback differs from an own value: ' + label, () => {
    const object = { x: value };
    assert.equal(O.get(object, 'x', 99), value === undefined ? 99 : value);
    assert.equal(O.has(object, 'x'), true);
    assert.equal(O.get(object, ['x', 'y'], 99), 99);
    assert.equal(O.has(object, ['x', 'y']), false);
    assert.deepEqual(O.getEach(object, ['x', ['x', 'y']], 99), [value === undefined ? 99 : value, 99]);
  });
}

test('empty segment arrays mean root reads but are invalid mutation targets', () => {
  for (const input of [undefined, null, 0, false, '', { a: 1 }, () => 1]) {
    assert.equal(O.get(input, [], 'fallback'), input);
    assert.deepEqual(O.getEach(input, [[]], 'fallback'), [input]);
    assert.equal(O.has(input, []), input !== null && (typeof input === 'object' || typeof input === 'function'));
  }
  for (const [, mutate] of mutations) assert.throws(() => mutate({}, []), RangeError);
});

test('path arrays are copied before getters and updaters can change them', () => {
  const path = ['a', 'b'];
  const input = {
    get a() {
      path[1] = 'wrong';
      return { b: 1, wrong: 2 };
    }
  };
  assert.equal(O.get(input, path), 1);
  const updatePath = ['a', 'b'],
    source = { a: { b: 1 } };
  O.update(source, updatePath, (n) => {
    updatePath[1] = 'wrong';
    return n + 1;
  });
  assert.deepEqual(source, { a: { b: 2 } });
});

for (const writable of [false, true])
  for (const configurable of [false, true]) {
    test(`path write descriptor: writable=${writable}, configurable=${configurable}`, () => {
      for (const name of ['set', 'update', 'setEach']) {
        let calls = 0;
        const object = {};
        Object.defineProperty(object, 'x', { value: 1, writable, configurable, enumerable: false });
        if (writable) {
          operations[name](object, 'x', (n) => {
            calls++;
            return n + 1;
          });
          assert.equal(object.x, name === 'update' ? 2 : 8);
          assert.equal(Object.getOwnPropertyDescriptor(object, 'x').enumerable, false);
          assert.equal(Object.getOwnPropertyDescriptor(object, 'x').configurable, configurable);
        } else {
          assert.throws(
            () =>
              operations[name](object, 'x', () => {
                calls++;
                return 2;
              }),
            TypeError
          );
          assert.equal(object.x, 1);
          assert.equal(calls, 0);
        }
      }
    });
  }

test('nested mutation can traverse a readonly pointer while respecting the child slot', () => {
  const child = { n: 1 },
    root = Object.freeze({ child });
  assert.equal(O.set(root, 'child.n', 2), 1);
  assert.equal(
    O.update(root, 'child.n', (n) => n + 1),
    2
  );
  assert.equal(root.child, child);
  assert.equal(child.n, 3);
  assert.equal(O.unset(root, 'child.n'), true);
  assert.equal(Object.hasOwn(child, 'n'), false);
});

test('unset deletes a configurable accessor without evaluating it', () => {
  let calls = 0;
  const object = {};
  Object.defineProperty(object, 'x', {
    get() {
      calls++;
      throw new Error('read');
    },
    configurable: true
  });
  assert.equal(O.unset(object, 'x'), true);
  assert.equal(calls, 0);
  assert.equal(Object.hasOwn(object, 'x'), false);
});

test('unset non-configurable terminal accessor throws without calling its getter', () => {
  let calls = 0;
  const object = {};
  Object.defineProperty(object, 'x', {
    get() {
      calls++;
      return 1;
    },
    configurable: false
  });
  assert.throws(() => O.unset(object, 'x'), TypeError);
  assert.equal(calls, 0);
});

for (const [label, key, arrayExpected] of [
  ['zero', '0', true],
  ['leading zero', '01', false],
  ['negative', '-1', false],
  ['maximum index', '4294967294', true],
  ['length limit', '4294967295', false],
  ['decimal', '1.5', false]
]) {
  test('created container boundary: ' + label, () => {
    const source = {};
    O.set(source, ['values', key, 'n'], 1);
    assert.equal(Array.isArray(source.values), arrayExpected);
    assert.equal(source.values[key].n, 1);
    if (arrayExpected) assert.equal(source.values.length, Number(key) + 1);
  });
}

test('batch paths are parsed before reads and writes; readonly failures are not rolled back', () => {
  let reads = 0;
  const source = {
    get a() {
      reads++;
      return 1;
    }
  };
  assert.throws(() => O.getEach(source, ['a', 'bad[']), SyntaxError);
  assert.equal(reads, 0);
  const target = { a: 1 };
  Object.defineProperty(target, 'b', { value: 2, writable: false });
  assert.throws(() => O.setEach(target, ['a', 'b'], 9), TypeError);
  assert.equal(target.a, 9);
  assert.equal(target.b, 2);
});

test('batch duplicates observe earlier writes and empty batches do not read data', () => {
  const source = { a: 1 };
  assert.deepEqual(O.setEach(source, ['a', 'a', ['a']], 2), [1, 2, 2]);
  assert.deepEqual(O.setEach(source, [], 3), []);
  assert.equal(source.a, 2);
  assert.deepEqual(O.getEach(source, []), []);
  for (const paths of [null, 'a', {}, new Array(1)]) {
    assert.throws(() => O.getEach(source, paths), TypeError);
    assert.throws(() => O.setEach(source, paths, 3), TypeError);
  }
});

test('update checks target changes made by the updater instead of silently losing writes', () => {
  const object = { a: { n: 1 } };
  assert.throws(
    () =>
      O.update(object, 'a.n', () => {
        Object.freeze(object.a);
        return 2;
      }),
    TypeError
  );
  assert.equal(object.a.n, 1);
  const removed = { a: { n: 4 } };
  assert.equal(
    O.update(removed, 'a.n', (n) => {
      delete removed.a;
      return n + 1;
    }),
    4
  );
  assert.deepEqual(removed, { a: { n: 5 } });
});
