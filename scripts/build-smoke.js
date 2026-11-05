'use strict';
// Run in a fresh process so imports cannot reuse a previous build's module cache.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');

async function smoke(root) {
  for (const filename of ['go-objects.js', 'go-objects.min.js']) {
    const umd = fs.readFileSync(path.join(root, 'dist', filename), 'utf8');
    const context = { module: null };
    vm.runInNewContext(umd, context);
    let amd;
    const loader = {
      define: (dependencies, factory) => {
        assert.equal(dependencies.length, 0);
        amd = factory();
      }
    };
    loader.define.amd = {};
    vm.runInNewContext(umd, loader);
    const graph = await import(pathToFileURL(path.join(root, 'index.mjs')).href);
    const bundle = await import(pathToFileURL(path.join(root, 'dist/go-objects.mjs')).href);
    const names = fs
      .readdirSync(path.join(root, 'src'))
      .filter((file) => file.endsWith('.d.ts'))
      .map((file) => file.slice(0, -5))
      .sort();
    for (const api of [
      require(root),
      context.Objects,
      amd,
      require(path.join(root, 'dist', filename)),
      graph.default,
      bundle.default
    ]) {
      assert.deepEqual(Object.keys(api).sort(), names);
      for (const name of names) assert.equal(typeof api[name], 'function', name);
      assert.equal(api.get({ a: { b: 42 } }, 'a.b'), 42);
      const original = { a: { b: 1 } };
      const changed = api.setImmutable(original, 'a.b', 2);
      assert.equal(changed.a.b, 2);
      assert.equal(original.a.b, 1);
      const cycle = {};
      cycle.self = cycle;
      const cloned = api.deepClone(cycle);
      assert.notEqual(cloned, cycle);
      assert.equal(cloned.self, cloned);
    }
    for (const module of [graph, bundle])
      for (const name of names) assert.equal(module[name], module.default[name], name);
  }
}
module.exports = smoke;
if (require.main === module)
  smoke(path.resolve(process.argv[2]))
    .then(() => {
      console.log('go-objects generated format checks completed');
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
