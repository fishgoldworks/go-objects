'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const O = require('..');
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    timeout: 30000,
    env: { ...process.env, NODE_PATH: path.join(root, 'node_modules') }
  });
  assert.equal(result.status, 0, result.error?.message || result.stderr || result.stdout);
  return result.stdout;
}
test('native ESM exposes default and all named utilities', async () => {
  const esm = await import('../package/index.mjs');
  assert.equal(typeof esm.default, 'function');
  for (const name of Object.keys(O)) {
    assert.equal(typeof esm[name], 'function', name);
    assert.equal(esm[name], esm.default[name], name);
  }
  assert.deepEqual(esm.get({ a: 1 }, 'a'), O.get({ a: 1 }, 'a'));
  assert.notEqual(esm.default, O); // Separate CJS/ESM implementation instances are deliberate.
});
test('standalone ESM browser bundle exposes the complete API', async () => {
  const esm = await import('../package/dist/go-objects.mjs');
  assert.equal(typeof esm.default, 'function');
  assert.equal(Object.keys(esm).length, 61);
  assert.deepEqual(
    esm.map({ a: 2 }, (v) => v * 3),
    { a: 6 }
  );
  const copy = esm.deepClone({ a: { b: 1 } });
  assert.equal(copy.a.b, 1);
});
test('UMD bundle works under CommonJS', () => {
  const bundled = require('../package/dist/go-objects.js');
  assert.equal(typeof bundled, 'function');
  assert.equal(Object.keys(bundled).length, 60);
  assert.deepEqual(
    bundled({ a: 1, b: 2 })
      .filter((v) => v > 1)
      .unwrap(),
    { b: 2 }
  );
});
test('UMD bundle works as a browser global without require or Buffer', () => {
  const context = {};
  vm.runInNewContext(fs.readFileSync(path.join(root, 'package/dist/go-objects.js'), 'utf8'), context);
  assert.equal(typeof context.Objects, 'function');
  assert.equal(context.Objects.get({ a: { b: 2 } }, 'a.b'), 2);
  const value = vm.runInNewContext('new Uint8Array([1,2,3])');
  assert.deepEqual([...context.Objects.deepClone(value)], [1, 2, 3]);
});
test('UMD bundle supports AMD without leaking a global', () => {
  let api;
  const context = {
    define: (deps, factory) => {
      assert.equal(deps.length, 0);
      api = factory();
    }
  };
  context.define.amd = {};
  vm.runInNewContext(fs.readFileSync(path.join(root, 'package/dist/go-objects.js'), 'utf8'), context);
  assert.equal(typeof api, 'function');
  assert.equal(context.Objects, undefined);
});

test('UMD bundle tolerates a null module global', () => {
  const context = { module: null };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'package/dist/go-objects.js'), 'utf8'), context);
  assert.equal(context.Objects.get({ answer: 42 }, 'answer'), 42);
});
test('all generated files are current and deterministic without modifying the checkout', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'go-objects-artifacts-'));
  function snapshot(directory) {
    const names = [];
    for (const folder of ['package'])
      for (const file of fs.readdirSync(path.join(directory, folder), { recursive: true })) {
        if (require('./package-layout').isTemporaryPath(file)) continue;
        if (fs.statSync(path.join(directory, folder, file)).isFile()) names.push(path.join(folder, file));
      }
    return Object.fromEntries(names.sort().map((file) => [file, fs.readFileSync(path.join(directory, file), 'utf8')]));
  }
  try {
    for (const name of [
      'src',
      'scripts',
      'package.json',
      'types',
      'index.js',
      'index.d.ts',
      'index.d.mts',
      'README.md',
      'docs',
      'CHANGELOG.md',
      'LICENSE.md'
    ])
      fs.cpSync(path.join(root, name), path.join(temp, name), { recursive: true });
    run(process.execPath, ['scripts/build.js'], temp);
    for (const relative of ['dist', 'esm', 'index.mjs'])
      assert.equal(fs.existsSync(path.join(temp, relative)), false, relative + ' must be owned by package/');
    assert.deepEqual(
      fs.readdirSync(path.join(temp, 'src')).filter((name) => name.endsWith('.d.ts')),
      []
    );
    const metadata = JSON.parse(fs.readFileSync(path.join(temp, 'package.json'), 'utf8'));
    for (const key of ['exports', 'typesVersions', 'files', 'module'])
      assert.equal(Object.hasOwn(metadata, key), false, 'Source manifest must not own ' + key);
    const expected = snapshot(temp);
    const actual = snapshot(root);
    assert.deepEqual(Object.keys(actual), Object.keys(expected), 'Generated file inventory differs; run npm run build');
    for (const file of Object.keys(expected))
      assert.equal(actual[file], expected[file], file + ' is stale; run npm run build');
    run(process.execPath, ['scripts/build.js'], temp);
    assert.deepEqual(snapshot(temp), expected);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
test('review regressions agree in CommonJS, static ESM, bundled ESM and UMD browser globals', async () => {
  const esm = await import('../package/index.mjs'),
    bundle = await import('../package/dist/go-objects.mjs'),
    context = {};
  vm.runInNewContext(fs.readFileSync(path.join(root, 'package/dist/go-objects.js'), 'utf8'), context);
  for (const [name, api] of [
    ['CommonJS', O],
    ['Static ESM', esm.default],
    ['Bundled ESM', bundle.default],
    ['UMD', context.Objects]
  ]) {
    const source = Object.setPrototypeOf([{ n: 1 }], null);
    source.self = source;
    const clone = api.deepClone(source, { unsupported: 'throw' });
    assert.equal(Array.isArray(clone), true, name);
    assert.notEqual(clone, source, name);
    assert.equal(Object.getPrototypeOf(clone), null, name);
    assert.equal(clone.self, clone, name);
    assert.notEqual(clone[0], source[0], name);
    class CustomBuffer extends ArrayBuffer {}
    const view = new Uint8Array(new CustomBuffer(8));
    assert.equal(api.deepClone(view), view, name);
    assert.throws(
      () => api.deepClone(view, { unsupported: 'throw' }),
      (error) => error.name === 'TypeError',
      name
    );
  }
});

require('./test-browser-bundles');

test('function subpaths expose named and default bindings identical to the ESM root', async () => {
  const api = await import('../package/index.mjs');
  for (const name of Object.keys(O)) {
    const subpath = await import('../package/esm/' + name + '.mjs');
    assert.equal(subpath.default, api[name], name + ' default');
    assert.equal(subpath[name], api[name], name + ' named');
  }
});
