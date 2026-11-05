'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const O = require('..');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

for (const method of ['clone', 'deepClone']) {
  for (const owner of ['Error', 'Object']) {
    for (const tag of ['matching', 'different', 'throwing']) {
      test(method + ' rejects tags inherited through ' + owner + '.prototype without reading them: ' + tag, () => {
        const context = vm.createContext({});
        const inputs = vm.runInContext(
          `
          var reads = 0;
          const types = [TypeError, RangeError, EvalError, ReferenceError, SyntaxError, URIError, AggregateError];
          const values = types.map(Type => Type === AggregateError ? new Type([], 'source') : new Type('source'));
          values.push(Object.create(TypeError.prototype));
          Object.defineProperty(${owner}.prototype, Symbol.toStringTag, {
            configurable: true,
            ${tag === 'throwing' ? "get() { reads++; throw new Error('tag getter must not run'); }" : 'value: ' + JSON.stringify(tag === 'matching' ? 'Error' : 'Custom')}
          });
          values;
        `,
          context
        );
        for (const input of inputs) {
          assert.equal(O[method](input), input);
          assert.throws(() => O[method](input, { unsupported: 'throw' }), TypeError);
          assert.equal(context.reads, 0);
        }
      });
    }
  }
  test(method + ' still clones ordinary foreign native Error state', () => {
    const source = vm.runInNewContext('Object.freeze(new TypeError("source", { cause: { value: 1 } }))');
    const result = O[method](source, { unsupported: 'throw' });
    assert.notEqual(result, source);
    assert.equal(Object.prototype.toString.call(result), '[object Error]');
    assert.equal(result.message, 'source');
    assert.equal(result.stack, source.stack);
    assert.equal(Object.getPrototypeOf(result), Object.getPrototypeOf(source));
    assert.equal(Object.isFrozen(result), true);
    assert.equal(result.cause.value, 1);
    assert.equal(result.cause === source.cause, method === 'clone');
  });
  test(method + ' bounds the Error tag walk with Buffer absent and a cyclic reflected prototype', () => {
    const context = vm.createContext({});
    const source = vm.runInContext(
      `
      const error = new TypeError('source');
      let cycle;
      cycle = new Proxy({}, { getPrototypeOf() { return cycle; } });
      Object.setPrototypeOf(Error.prototype, cycle);
      error;
    `,
      context
    );
    // Buffer.isBuffer itself follows prototypes in Node and can throw for
    // deliberate reflected cycles. Exercise the browser/optional-Buffer path.
    const filename = path.resolve(__dirname, '../src/internal/clone.js');
    const output = { exports: {} };
    vm.runInNewContext(
      fs.readFileSync(filename, 'utf8'),
      {
        module: output,
        require: createRequire(filename),
        Buffer: undefined
      },
      { filename }
    );
    assert.equal(output.exports[method](source), source);
    assert.throws(() => output.exports[method](source, { unsupported: 'throw' }), { name: 'TypeError' });
  });
}
