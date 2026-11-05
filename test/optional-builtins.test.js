'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm'),
  fs = require('node:fs'),
  path = require('node:path'),
  { createRequire } = require('node:module');
test('cloning loads and preserves ordinary graphs without newer optional native constructors', () => {
  const filename = path.resolve(__dirname, '../src/internal/clone.js'),
    output = { exports: {} };
  const sandbox = {
    module: output,
    require: createRequire(filename),
    BigInt: undefined,
    BigInt64Array: undefined,
    BigUint64Array: undefined,
    AggregateError: undefined,
    Float16Array: undefined
  };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), sandbox, { filename });
  const source = { value: 42 };
  source.self = source;
  const clone = output.exports.deepClone(source);
  assert.notEqual(clone, source);
  assert.equal(clone.self, clone);
  assert.equal(clone.value, 42);
  assert.equal(typeof globalThis.BigInt, 'function');
});

const { spawnSync } = require('node:child_process');
const optionalNames = ['BigInt', 'BigInt64Array', 'BigUint64Array', 'AggregateError', 'Float16Array', 'Buffer'];
const optionalMembers = [
  'ArrayBuffer.prototype.resizable',
  'RegExp.prototype.hasIndices',
  'RegExp.prototype.dotAll',
  'RegExp.prototype.unicodeSets'
];
for (const removed of [
  [],
  ...optionalNames.map((name) => [name]),
  ['BigInt', 'BigInt64Array', 'BigUint64Array'],
  optionalNames,
  ...optionalMembers.map((name) => [name]),
  optionalMembers,
  [...optionalNames, ...optionalMembers]
]) {
  test('fresh package graphs with optional globals absent: ' + (removed.join(', ') || 'native controls'), () => {
    const child = spawnSync(
      process.execPath,
      [path.join(__dirname, 'fixtures/optional-capabilities.cjs'), JSON.stringify(removed)],
      {
        encoding: 'utf8',
        timeout: 30000
      }
    );
    assert.equal(child.status, 0, child.error?.message || child.stderr || child.stdout);
    assert.ok(child.stdout.includes('Optional capability imports completed: 9 surfaces'));
  });
}
