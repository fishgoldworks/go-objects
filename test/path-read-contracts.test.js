'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const O = require('..');
const pathTools = require('../src/internal/path');

// Contract checks cover own-property reads, parsing and observable getters.
const readers = {
  get: (object, path, fallback) => O.get(object, path, fallback),
  has: (object, path) => O.has(object, path),
  getEach: (object, path, fallback) => O.getEach(object, [path], fallback)
};

for (const key of ['*', 'a+b', 'fn()', ' a ', 'a\\b']) {
  test('path punctuation is literal, never evaluated or expanded: ' + JSON.stringify(key), () => {
    const source = { [key]: 7, unrelated: 9 };
    for (const path of [key, [key], '[' + JSON.stringify(key) + ']']) {
      assert.equal(O.get(source, path), 7);
      assert.equal(O.has(source, path), true);
      assert.deepEqual(O.getEach(source, [path, path]), [7, 7]);
    }
    assert.equal(O.get({}, key), undefined);
    assert.equal(O.has({}, key), false);
  });
}

test('unquoted bracket expressions and wildcards fail before any source observation', () => {
  const source = new Proxy(
    {},
    {
      getOwnPropertyDescriptor() {
        assert.fail('Invalid syntax must fail before probing the target');
      },
      get() {
        assert.fail('Invalid syntax must fail before reading the target');
      }
    }
  );
  for (const path of ['[*]', '[a+b]', '[fn()]', '[key]', '[1 + 2]']) {
    for (const read of Object.values(readers)) {
      assert.throws(() => read(source, path), SyntaxError);
      assert.throws(() => read(source, path), SyntaxError);
    }
  }
});

test('unquoted backslashes do not escape dot delimiters', () => {
  const source = { 'a.b': 1, 'a\\': { b: 2 } };
  assert.equal(O.get(source, 'a\\.b'), 2);
  assert.equal(O.get(source, '["a.b"]'), 1);
  assert.equal(O.get(source, ['a.b']), 1);
  assert.deepEqual(O.getEach(source, ['a\\.b', '["a.b"]', ['a.b']]), [2, 1, 1]);
});

test('literal numeric spellings stay distinct from numeric bracket normalisation', () => {
  const source = { 0: 'zero', '-0': 'negative-zero-text', '01': 'leading-zero', '1e2': 'exponent-text' };
  assert.deepEqual(O.getEach(source, [0, -0, '[0]', '[-0]', '-0', '["-0"]', '01', '["01"]', '1e2']), [
    'zero',
    'zero',
    'zero',
    'zero',
    'negative-zero-text',
    'negative-zero-text',
    'leading-zero',
    'leading-zero',
    'exponent-text'
  ]);
  for (const path of ['[01]', '[1e2]']) assert.throws(() => O.get(source, path), SyntaxError);
});

for (const length of [255, 256, 257, 1024]) {
  test('path read results do not depend on the syntax-cache length boundary: ' + length, () => {
    const key = 'k'.repeat(length);
    const fallback = { missing: true };
    const child = { answer: length };
    const source = { [key]: child };
    for (let i = 0; i < 3; i++) {
      assert.equal(O.get(source, key, fallback), child);
      assert.equal(O.has(source, key), true);
      assert.deepEqual(O.getEach(source, [key, [key], '[' + JSON.stringify(key) + ']']), [child, child, child]);
    }
    delete source[key];
    assert.equal(O.get(source, key, fallback), fallback);
    assert.equal(O.has(source, key), false);
  });
}

test('alternating equal-length syntax-cache collision candidates retain their full path identity', () => {
  // Identical sampled hash characters in the current direct cache; assertions
  // describe public results and remain useful if the cache strategy changes.
  const first = 'rootAA.leaf';
  const second = 'rootBA.leaf';
  const source = { rootAA: { leaf: 1 }, rootBA: { leaf: 2 }, third: 3 };
  for (let i = 0; i < 30; i++) {
    assert.deepEqual(O.getEach(source, [first, second, 'third', first]), [1, 2, 3, 1]);
    assert.equal(O.has(source, second), true);
    assert.equal(O.get(source, first), 1);
    assert.deepEqual(pathTools.parse(second), ['rootBA', 'leaf']);
  }
});

test('reentrant cache eviction cannot change a path already being read', () => {
  let reads = 0;
  const nested = { row: { leaf: 77 } };
  const source = {
    get row() {
      reads++;
      for (let i = 0; i < 600; i++) {
        const key = 'other' + i;
        assert.equal(O.get({ [key]: i }, key), i);
      }
      assert.equal(O.get(nested, 'row.leaf'), 77);
      const exposed = pathTools.parse('row.leaf');
      exposed[0] = 'wrong';
      return { leaf: 8 };
    }
  };
  assert.equal(O.get(source, 'row.leaf'), 8);
  assert.equal(O.has(source, 'row.leaf'), true);
  assert.deepEqual(O.getEach(source, ['row.leaf', 'row.leaf']), [8, 8]);
  assert.equal(reads, 4);
});

test('path parser copies cannot poison either cached reads or mutation-path validation', () => {
  const path = 'safe.value';
  const parsed = pathTools.parse(path);
  const writable = pathTools.mutablePath(path);
  parsed[0] = '__proto__';
  writable.splice(0, writable.length, 'wrong');
  assert.deepEqual(pathTools.parse(path), ['safe', 'value']);
  assert.equal(O.get({ safe: { value: 7 } }, path), 7);
  const forbidden = pathTools.parse('__proto__.value');
  forbidden[0] = 'safe';
  assert.throws(() => pathTools.mutablePath('__proto__.value'), TypeError);
});

test('an early batch path is snapshotted before later path getters can change it', () => {
  const first = ['row', 'value'];
  let pathReads = 0;
  let valueReads = 0;
  const requests = [first];
  Object.defineProperty(requests, 1, {
    get() {
      pathReads++;
      first[1] = 'other';
      assert.equal(valueReads, 0);
      return ['row', 'other'];
    }
  });
  const source = {
    get row() {
      valueReads++;
      return { value: 1, other: 2 };
    }
  };
  assert.deepEqual(O.getEach(source, requests), [1, 2]);
  assert.equal(pathReads, 1);
  assert.equal(valueReads, 2);
});

test('getEach snapshots a custom list iterator before reading the source', () => {
  const trace = [];
  const requests = [];
  requests[Symbol.iterator] = function* () {
    trace.push('first path');
    yield 'value';
    trace.push('second path');
    yield ['value'];
    trace.push('paths complete');
  };
  let count = 0;
  const source = {
    get value() {
      trace.push('read value');
      return ++count;
    }
  };
  assert.deepEqual(O.getEach(source, requests), [1, 2]);
  assert.deepEqual(trace, ['first path', 'second path', 'paths complete', 'read value', 'read value']);
});

for (const [name, read] of Object.entries(readers)) {
  test(name + ' closes an invalid segment iterator without reading target data', () => {
    const path = [];
    const events = [];
    path[Symbol.iterator] = function* () {
      try {
        yield 'value';
        yield null;
        events.push('unreachable');
      } finally {
        events.push('closed');
      }
    };
    const source = {
      get value() {
        return assert.fail('Invalid path must be rejected before reading the target');
      }
    };
    assert.throws(() => read(source, path), TypeError);
    assert.deepEqual(events, ['closed']);
  });
}

test('getEach closes its outer iterator on a malformed later path without reading earlier values', () => {
  const requests = [];
  const events = [];
  requests[Symbol.iterator] = function* () {
    try {
      yield 'value';
      yield 'broken[';
    } finally {
      events.push('closed');
    }
  };
  const source = {
    get value() {
      return assert.fail('Batch validation must precede all source reads');
    }
  };
  assert.throws(() => O.getEach(source, requests), SyntaxError);
  assert.deepEqual(events, ['closed']);
});

for (const [name, read] of Object.entries(readers)) {
  test(name + ' propagates input iterator exceptions unchanged', () => {
    const error = new Error('segment iterator failed');
    const path = [];
    path[Symbol.iterator] = function* () {
      yield 'row';
      throw error;
    };
    assert.throws(
      () => read({ row: { value: 7 } }, path),
      (caught) => caught === error
    );
    assert.equal(O.get({ row: { value: 7 } }, 'row.value'), 7);
  });
}

test('read and existence checks use own-property probes with the correct getter receiver', () => {
  const trace = [];
  const leaf = new Proxy(
    { value: undefined },
    {
      getOwnPropertyDescriptor(target, key) {
        trace.push('leaf own ' + key);
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
      get(target, key, receiver) {
        trace.push('leaf get ' + key);
        return Reflect.get(target, key, receiver);
      },
      has() {
        assert.fail('The inherited-property membership trap must not be used');
      }
    }
  );
  let source;
  const target = {
    get row() {
      assert.equal(this, source);
      return leaf;
    }
  };
  source = new Proxy(target, {
    getOwnPropertyDescriptor(object, key) {
      trace.push('root own ' + key);
      return Reflect.getOwnPropertyDescriptor(object, key);
    },
    get(object, key, receiver) {
      trace.push('root get ' + key);
      return Reflect.get(object, key, receiver);
    },
    has() {
      assert.fail('The inherited-property membership trap must not be used');
    }
  });
  assert.equal(O.get(source, 'row.value', 9), 9);
  assert.deepEqual(trace, ['root own row', 'root get row', 'leaf own value', 'leaf get value']);
  trace.length = 0;
  assert.equal(O.has(source, 'row.value'), true);
  assert.deepEqual(trace, ['root own row', 'root get row', 'leaf own value']);
});

test('a source getter failure stops a batch without reading later source paths', () => {
  const error = new Error('first read failed');
  const trace = [];
  const source = {
    get first() {
      trace.push('first');
      throw error;
    },
    get second() {
      trace.push('second');
      return 2;
    }
  };
  assert.throws(
    () => O.getEach(source, ['first', 'second']),
    (caught) => caught === error
  );
  assert.deepEqual(trace, ['first']);
  assert.equal(O.has(source, 'first'), true);
  assert.deepEqual(trace, ['first']);
});

test('reads accept frozen cross-realm path arrays and non-enumerable properties without mutating the path', () => {
  const path = vm.runInNewContext('Object.freeze(["row", "value"])');
  const source = vm.runInNewContext('({row: Object.defineProperty({}, "value", {value: 7})})');
  assert.equal(O.get(source, path), 7);
  assert.equal(O.has(source, path), true);
  assert.deepEqual(O.getEach(source, Object.freeze([path, path])), [7, 7]);
  assert.deepEqual(Array.from(path), ['row', 'value']);
  assert.equal(Object.isFrozen(path), true);
});

function quoted(key, unicode) {
  if (!unicode) return '[' + JSON.stringify(key) + ']';
  let result = '';
  for (let i = 0; i < key.length; i++) result += '\\u' + key.charCodeAt(i).toString(16).padStart(4, '0');
  return '["' + result + '"]';
}
for (const seed of [1, 0x12345678, 0xdeadbeef, 0xffffffff]) {
  test('constructed path trees retain independent expected keys and values; seed=' + seed, () => {
    let state = seed >>> 0;
    const random = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0);
    const alphabet = [
      'a',
      '.',
      '[',
      ']',
      '"',
      "'",
      '\\',
      '\n',
      '\u0000',
      '\ud800',
      '\udfff',
      '😀',
      '한',
      '*',
      '+',
      ' '
    ];
    const special = ['__proto__', 'constructor', 'prototype', '', '01', '-0'];
    for (let n = 0; n < 125; n++) {
      const count = 1 + (random() % 5);
      const keys = [];
      for (let i = 0; i < count; i++) {
        let key = '';
        if (random() % 3 === 0) key = special[random() % special.length];
        else for (let j = 0, length = random() % 9; j < length; j++) key += alphabet[random() % alphabet.length];
        keys.push(key);
      }
      const value = n % 3 === 0 ? undefined : n % 3 === 1 ? null : { n };
      const fallback = { missing: n };
      const root = Object.create(null);
      let node = root;
      for (let i = 0; i < keys.length; i++) {
        const next = i === keys.length - 1 ? value : Object.create(null);
        Object.defineProperty(node, keys[i], { value: next, enumerable: n % 2 === 0 });
        node = next;
      }
      const path = keys.map((key, i) => quoted(key, (n + i) % 2 === 0)).join('');
      const expected = value === undefined ? fallback : value;
      for (let pass = 0; pass < 2; pass++) {
        assert.deepEqual(pathTools.parse(path), keys, 'seed=' + seed + ', case=' + n);
        assert.equal(O.get(root, path, fallback), expected);
        assert.equal(O.has(root, path), true);
        assert.deepEqual(O.getEach(root, [path, keys, path], fallback), [expected, expected, expected]);
      }
    }
  });
}
