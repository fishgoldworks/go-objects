'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../package');
test('root ESM named exports do not load any package CommonJS implementation', () => {
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
 import assert from 'node:assert/strict'; import {createRequire} from 'node:module'; import {fileURLToPath} from 'node:url';
 import {get,setImmutable} from './index.mjs';
 assert.equal(get({a:1},'a'),1);assert.equal(setImmutable({a:1},'a',2).a,2);
 const require=createRequire(import.meta.url);
 const packageRoot=fileURLToPath(new URL('.',import.meta.url));
 const loaded=Object.keys(require.cache).filter(x=>x.startsWith(packageRoot));
 assert.deepEqual(loaded,[]);
 `
    ],
    { cwd: root, encoding: 'utf8' }
  );
  assert.equal(result.status, 0, result.stderr);
});
test('generated ESM is a static implementation graph without require or CommonJS export objects', () => {
  assert.ok(fs.existsSync(path.join(root, 'esm/internal/path.mjs')));
  for (const file of fs
    .readdirSync(path.join(root, 'esm'), { recursive: true })
    .filter((n) => n.endsWith('.mjs') && !require('../scripts/package-layout').isTemporaryPath(n))) {
    const text = fs.readFileSync(path.join(root, 'esm', file), 'utf8');
    assert.ok(!/\brequire\s*\(|module\.exports/.test(text), file);
  }
  const index = fs.readFileSync(path.join(root, 'index.mjs'), 'utf8');
  assert.ok(!/Objects\.get|from ['"]\.\/index\.js/.test(index));
});
test('standalone ESM browser build no longer embeds a CommonJS module loader', () => {
  const text = fs.readFileSync(path.join(root, 'dist/go-objects.mjs'), 'utf8');
  assert.ok(!/module\.exports|function load\(|require\(/.test(text));
});
