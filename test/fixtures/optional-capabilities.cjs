'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '../..');
const removed = JSON.parse(process.argv[2]);
const values = new Map();
for (const name of ['BigInt', 'BigInt64Array', 'BigUint64Array', 'AggregateError', 'Float16Array', 'Buffer']) {
  const Native = globalThis[name];
  if (typeof Native !== 'function') continue;
  const value =
    name === 'BigInt'
      ? Object(Native(3))
      : name === 'AggregateError'
        ? new Native([{ n: 1 }], 'many')
        : name === 'Buffer'
          ? Native.from([1, 2])
          : name.startsWith('Big')
            ? new Native([3n])
            : new Native([1, 2]);
  values.set(name, value);
}
const foreignDate = vm.runInNewContext('new Date(4)');
const foreignBigInt = vm.runInNewContext('Object(3n)');
function removeCapability(name, scope) {
  const parts = name.split('.');
  if (parts.length === 1) scope[name] = undefined;
  else {
    const owner = parts.slice(0, -1).reduce((value, key) => value[key], scope);
    Reflect.deleteProperty(owner, parts[parts.length - 1]);
  }
}
for (const name of removed) removeCapability(name, globalThis);

function check(api, label) {
  assert.equal(api.get({ a: { b: 42 } }, 'a.b'), 42, label);
  const original = { n: 1 };
  original.self = original;
  const copy = api.deepClone(original);
  assert.notEqual(copy, original, label);
  assert.equal(copy.self, copy, label);
  assert.equal(copy.n, 1, label);
  const date = api.deepClone(foreignDate);
  assert.notEqual(date, foreignDate, label);
  assert.equal(Date.prototype.getTime.call(date), 4, label);
  for (const [name, value] of values) {
    if (removed.includes(name)) {
      assert.equal(api.deepClone(value), value, label + ':' + name);
      assert.throws(() => api.deepClone(value, { unsupported: 'throw' }), { name: 'TypeError' });
    } else {
      assert.notEqual(api.deepClone(value), value, label + ':' + name);
    }
  }
  if (removed.includes('BigInt')) {
    assert.equal(api.deepClone(foreignBigInt), foreignBigInt);
    assert.throws(() => api.deepClone(foreignBigInt, { unsupported: 'throw' }), { name: 'TypeError' });
  } else assert.notEqual(api.deepClone(foreignBigInt), foreignBigInt);
  const regex = /legacy/gimy;
  const regexCopy = api.deepClone(regex);
  assert.notEqual(regexCopy, regex);
  assert.equal(regexCopy.source, regex.source);
  assert.equal(regexCopy.flags, regex.flags);
  let reads = 0;
  const fake = Object.create(Date.prototype);
  Object.defineProperty(fake, Symbol.toStringTag, {
    get() {
      reads++;
      throw Error('tag');
    }
  });
  assert.equal(api.deepClone(fake), fake);
  assert.throws(() => api.deepClone(fake, { unsupported: 'throw' }), { name: 'TypeError' });
  const record = Object.defineProperty({}, Symbol.toStringTag, {
    get() {
      reads++;
      throw Error('tag');
    }
  });
  assert.notEqual(api.deepClone(record), record);
  assert.equal(reads, 0);
}

async function main() {
  const importFile = async (file) => (await import(pathToFileURL(path.join(root, file)).href)).default;
  // Focused imports precede root imports so their own transitive graph is exercised.
  check({ get: require('../../src/get'), deepClone: require('../../src/deepClone') }, 'source focused');
  check(require('../..'), 'source root');
  check({ get: require('../../package/get'), deepClone: require('../../package/deepClone') }, 'CJS focused');
  check(require('../../package/index.js'), 'CJS root');
  check(
    {
      get: await importFile('package/esm/get.mjs'),
      deepClone: await importFile('package/esm/deepClone.mjs')
    },
    'ESM focused'
  );
  check(await importFile('package/index.mjs'), 'ESM root');
  check(await importFile('package/dist/go-objects.mjs'), 'ESM bundle');
  check(require('../../package/dist/go-objects.js'), 'UMD CommonJS');
  const sandbox = { Buffer: globalThis.Buffer };
  vm.createContext(sandbox);
  sandbox.removedCapabilities = removed;
  vm.runInContext(
    'const remove = ' +
      removeCapability.toString() +
      '; for (const name of removedCapabilities) remove(name, globalThis);',
    sandbox
  );
  vm.runInContext(fs.readFileSync(path.join(root, 'package/dist/go-objects.js'), 'utf8'), sandbox);
  check(sandbox.Objects, 'UMD global');
  console.log('Optional capability imports completed: 9 surfaces');
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
