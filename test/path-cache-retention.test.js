'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const O = require('..');
const paths = require('../src/internal/path');

for (const method of ['control', 'get', 'has', 'getEach']) {
  test('short ' + method + ' paths do not retain their large source strings', () => {
    const child = spawnSync(
      process.execPath,
      ['--expose-gc', path.join(__dirname, 'fixtures/cache-retention.cjs'), path.join(__dirname, '..'), method],
      { encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024 }
    );
    assert.ifError(child.error);
    assert.equal(child.status, 0, child.stderr);
    assert.equal(child.signal, null);
    const result = JSON.parse(child.stdout.trim());
    assert.equal(result.method, method);
    assert.equal(result.sourceCount, 32);
    // Broad headroom above the small cache/module bookkeeping; the reproduced
    // defect retained about 64 MiB. No nanosecond or exact GC-size assertion.
    assert.ok(result.retainedBytes < 8 * 1024 * 1024, JSON.stringify(result));
  });
}

test('cached copied paths preserve all UTF-16 data including unpaired surrogates', () => {
  for (const key of ['plain', '한글😀', '\ud800', '\udfff', '\u0000\n', 'a.b["x"]', '__proto__']) {
    const source = Object.create(null);
    Object.defineProperty(source, key, { value: { leaf: 7 }, enumerable: true });
    const spelling = '[' + JSON.stringify(key) + '].leaf';
    const large = ' ' + spelling + 'tail'.repeat(1000);
    const sliced = large.slice(1, spelling.length + 1);
    assert.deepEqual(paths.parse(sliced), [key, 'leaf']);
    for (let i = 0; i < 3; i++) {
      assert.equal(O.get(source, sliced), 7);
      assert.equal(O.has(source, sliced), true);
      assert.deepEqual(O.getEach(source, [sliced, sliced]), [7, 7]);
    }
  }
});

test('a hot sliced path still reads live getters with the correct receiver', () => {
  let calls = 0;
  const child = {
    get leaf() {
      assert.equal(this, child);
      return ++calls;
    }
  };
  const root = { branch: child };
  const spelling = (' ' + 'branch.leaf' + 'x'.repeat(1000)).slice(1, 12);
  assert.equal(O.get(root, spelling), 1);
  assert.equal(O.has(root, spelling), true);
  assert.deepEqual(O.getEach(root, [spelling, spelling]), [2, 3]);
  assert.equal(calls, 3);
});

test('cached materialisation neither exposes segments nor bypasses write guards', () => {
  const spelling = (' ' + '__proto__.value' + 'x'.repeat(1000)).slice(1, 16);
  const source = JSON.parse('{"__proto__":{"value":1}}');
  assert.equal(O.get(source, spelling), 1);
  const parsed = paths.parse(spelling);
  parsed[0] = 'other';
  assert.deepEqual(paths.parse(spelling), ['__proto__', 'value']);
  assert.throws(() => O.set(source, spelling, 2), TypeError);
  assert.equal(source.__proto__.value, 1);
});

test('malformed sliced paths retain their syntax error after repeated lookups', () => {
  for (const spelling of ['a..b', 'a[01]', 'a["x"', 'a.']) {
    const sliced = (' ' + spelling + 'x'.repeat(1000)).slice(1, spelling.length + 1);
    for (let i = 0; i < 2; i++) assert.throws(() => O.get({}, sliced), SyntaxError);
  }
});
