'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
test('package checking refuses a supplied missing tarball before building or packing', () => {
  const result = spawnSync(
    process.execPath,
    ['scripts/test-package.js', '--tarball', path.join(root, 'does-not-exist.tgz')],
    { cwd: root, encoding: 'utf8', timeout: 60000 }
  );
  assert.notEqual(result.status, 0, 'A missing supplied tarball must not silently verify a freshly packed revision');
  assert.match(result.stderr + result.stdout, /ENOENT|tarball.*file/i);
});

for (const script of ['test-types.js', 'test-runtime.js'])
  test(script + ' refuses an explicitly missing tarball', () => {
    const result = spawnSync(
      process.execPath,
      ['scripts/' + script, '--tarball', path.join(root, 'does-not-exist.tgz')],
      { cwd: root, encoding: 'utf8', timeout: 10000 }
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr + result.stdout, /ENOENT|tarball.*file/i);
  });
test('root packaging guard directs users to the candidate verifier', () => {
  const result = spawnSync(process.execPath, ['scripts/reject-root-package.js'], { cwd: root, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /verify:all/);
});
