'use strict';
// Differential validation against an explicit baseline checkout. This is not
// substituted for unit tests: independent assertions remain in test/.
const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  crypto = require('node:crypto');
if (!process.argv[2])
  throw new Error('Usage: node scripts/test-performance-equivalence.js BASELINE_ROOT [OUTPUT_JSON]');
const baseline = path.resolve(process.argv[2]);
const before = require(path.join(baseline, 'src/internal/path.js'));
const after = require('../src/internal/path.js');
let seed = 0x52c41e9d;
const random = () => {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return (seed >>> 0) / 4294967296;
};
const integer = (n) => Math.floor(random() * n);
const alphabet = ['a', 'b', '0', '1', '.', '[', ']', '"', "'", '\\', ' ', '\n', '\t', '한', '😀'];
const names = [
  'name',
  'a.b',
  'constructor',
  '__proto__',
  'prototype',
  '',
  String.fromCharCode(0),
  'a[b]',
  '한글',
  '😀',
  'x'.repeat(300)
];
function result(fn) {
  try {
    return { value: fn() };
  } catch (error) {
    return { error: error.name, message: error.message };
  }
}
let valid = 0,
  invalid = 0,
  lookups = 0;
for (let i = 0; i < 40000; i++) {
  let input;
  if (i % 2 === 0) {
    input = '';
    for (let j = 0, n = 1 + integer(5); j < n; j++) {
      const key = names[integer(names.length)];
      input += '[' + JSON.stringify(key) + ']';
    }
  } else {
    input = '';
    for (let j = 0, n = integer(24); j < n; j++) input += alphabet[integer(alphabet.length)];
  }
  const expected = result(() => before.parse(input));
  for (let retry = 0; retry < 2; retry++)
    assert.deepEqual(
      result(() => after.parse(input)),
      expected,
      'parser: ' + JSON.stringify(input)
    );
  if (expected.error) {
    invalid++;
    continue;
  }
  valid++;
  const root = Object.create(null);
  let node = root;
  for (let j = 0; j < expected.value.length; j++) {
    const key = expected.value[j];
    Object.defineProperty(node, key, {
      value: j === expected.value.length - 1 ? i : Object.create(null),
      writable: true,
      configurable: true,
      enumerable: true
    });
    node = node[key];
  }
  assert.deepEqual(
    result(() => after.get(root, input)),
    result(() => before.get(root, input))
  );
  assert.deepEqual(
    result(() => after.has(root, input)),
    result(() => before.has(root, input))
  );
  assert.deepEqual(
    result(() => after.getEach(root, [input, input])),
    result(() => before.getEach(root, [input, input]))
  );
  lookups += 3;
}
const identify = (root) => ({
  root,
  version: JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version,
  pathSha256: crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.join(root, 'src/internal/path.js')))
    .digest('hex'),
  commonSha256: crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.join(root, 'src/internal/common.js')))
    .digest('hex')
});
const report = {
  baseline: identify(baseline),
  candidate: identify(path.resolve(__dirname, '..')),
  node: process.version,
  seed: '0x52c41e9d',
  generatedPaths: 40000,
  parserComparisons: 80000,
  valid,
  invalid,
  readApiComparisons: lookups,
  passed: true,
  scope:
    'Deterministic differential grammar/error-position and read-API equivalence versus the explicitly identified source baseline. Not proof for every possible JavaScript input.'
};
if (process.argv[3]) fs.writeFileSync(path.resolve(process.argv[3]), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
