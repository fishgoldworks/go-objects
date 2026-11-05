'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const O = require('..');

function withAlteredPrototype(value, nativePrototype, Native) {
  const prototype = Object.create(nativePrototype);
  Object.defineProperty(prototype, 'constructor', { value: Native, configurable: true, writable: true });
  Object.setPrototypeOf(value, prototype);
  return { value, prototype };
}

const alteredBuiltins = [
  ['Array', () => withAlteredPrototype([1, { n: 2 }], Array.prototype, Array)],
  ['Date', () => withAlteredPrototype(new Date(123), Date.prototype, Date)],
  ['RegExp', () => withAlteredPrototype(/x/gi, RegExp.prototype, RegExp)],
  ['Map', () => withAlteredPrototype(new Map([[1, { n: 2 }]]), Map.prototype, Map)],
  ['Set', () => withAlteredPrototype(new Set([{ n: 2 }]), Set.prototype, Set)],
  ['Boolean', () => withAlteredPrototype(new Boolean(true), Boolean.prototype, Boolean)],
  ['Number', () => withAlteredPrototype(new Number(1), Number.prototype, Number)],
  ['String', () => withAlteredPrototype(new String('x'), String.prototype, String)],
  ['BigInt', () => withAlteredPrototype(Object(1n), BigInt.prototype, BigInt)],
  ['Symbol', () => withAlteredPrototype(Object(Symbol('x')), Symbol.prototype, Symbol)],
  ['DataView', () => withAlteredPrototype(new DataView(new ArrayBuffer(4)), DataView.prototype, DataView)],
  ['Uint8Array', () => withAlteredPrototype(new Uint8Array([1, 2]), Uint8Array.prototype, Uint8Array)],
  ['Error', () => withAlteredPrototype(new Error('x'), Error.prototype, Error)]
];
if (typeof Buffer !== 'undefined')
  alteredBuiltins.push(['Buffer', () => withAlteredPrototype(Buffer.from([1, 2]), Buffer.prototype, Buffer)]);

for (const method of ['clone', 'deepClone']) {
  test(`${method} treats altered native prototype chains as unsupported`, () => {
    for (const [name, make] of alteredBuiltins) {
      const { value, prototype } = make();
      const result = O[method](value);
      assert.equal(result, value, `${name} should remain an opaque reference`);
      assert.equal(Object.getPrototypeOf(result), prototype, `${name} prototype should not be silently replaced`);
      assert.throws(() => O[method](value, { unsupported: 'throw' }), TypeError, `${name} strict policy`);
    }
  });
}

test('consumer self-reference does not expose implementation modules', () => {
  const { spawnSync } = require('node:child_process'),
    path = require('node:path');
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    import assert from 'node:assert/strict'; import {createRequire} from 'node:module';
    const require=createRequire(import.meta.url);
    for(const suffix of ['internal/path','internal/clone','src/internal/path','src/internal/path.js','ObjectWrapper','src/ObjectWrapper','src/ObjectWrapper.js'])
      assert.throws(()=>require('go-objects/'+suffix),error=>error.code==='ERR_PACKAGE_PATH_NOT_EXPORTED',suffix);
    for(const suffix of ['esm/internal/path.mjs','esm/ObjectWrapper.mjs'])
      await assert.rejects(import('go-objects/'+suffix),error=>error.code==='ERR_PACKAGE_PATH_NOT_EXPORTED',suffix);
    for(const suffix of ['get','src/get','src/get.js']) assert.equal(typeof require('go-objects/'+suffix),'function');
  `
    ],
    { cwd: path.resolve(__dirname, '../package'), encoding: 'utf8' }
  );
  assert.equal(result.status, 0, result.stderr);
});

for (const method of ['clone', 'deepClone']) {
  test(`${method} revalidates Error prototype metadata after classification`, () => {
    for (const policy of ['reference', 'throw']) {
      let reads = 0;
      const source = new Proxy(new Error('source'), {
        getPrototypeOf() {
          return ++reads <= 3 ? Error.prototype : TypeError.prototype;
        }
      });
      if (policy === 'reference') assert.equal(O[method](source), source);
      else assert.throws(() => O[method](source, { unsupported: policy }), TypeError);
    }
  });
}
