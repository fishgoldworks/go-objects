'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const O = require('../index');

// The source is an Error; only reflective constructor metadata changes. Clone
// must not promote that second, unverified value into executable user code.
function changingConstructor(Native, changed, onCall) {
  let reads = 0;
  const proto = new Proxy(Native.prototype, {
    getOwnPropertyDescriptor(target, key) {
      const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
      if (key !== 'constructor' || ++reads < 3) return descriptor;
      return changed(descriptor, onCall);
    }
  });
  const target = Native === AggregateError ? new Native([], 'source') : new Native('source');
  return new Proxy(target, { getPrototypeOf: () => proto });
}
const changes = {
  'user constructor': (descriptor, called) => ({
    ...descriptor,
    value: function UserError() {
      called();
      return new Error('wrong');
    }
  }),
  'constructor Proxy': (descriptor, called) => ({
    ...descriptor,
    value: new Proxy(Error, {
      construct() {
        called();
        return new Error('wrong');
      }
    })
  }),
  'non-function': (descriptor) => ({ ...descriptor, value: 1 }),
  'accessor descriptor': (descriptor, called) => ({
    configurable: true,
    get() {
      called();
      return Error;
    }
  }),
  'missing descriptor': () => undefined,
  'different native kind': (descriptor) => ({ ...descriptor, value: Map })
};
for (const method of ['clone', 'deepClone']) {
  for (const [name, change] of Object.entries(changes)) {
    for (const policy of ['reference', 'throw']) {
      test(`${method}: ${policy} rejects changed Error metadata (${name}) without invoking it`, () => {
        let calls = 0;
        const input = changingConstructor(Error, change, () => calls++);
        if (policy === 'reference') assert.equal(O[method](input), input);
        else assert.throws(() => O[method](input, { unsupported: policy }), TypeError);
        assert.equal(calls, 0);
      });
    }
  }
  for (const Native of [TypeError, AggregateError]) {
    test(`${method}: changing ${Native.name} metadata follows the same opaque policy`, () => {
      let calls = 0;
      const input = changingConstructor(Native, changes['user constructor'], () => calls++);
      const result = O[method]({ error: input }, { unsupported: 'reference' });
      assert.equal(result.error, input);
      assert.equal(calls, 0);
    });
  }
  test(`${method}: stable Error proxies follow the unsupported policy`, () => {
    const cause = { reason: 'source' };
    const input = new Proxy(new TypeError('source', { cause }), {});
    assert.equal(O[method](input), input);
    assert.throws(() => O[method](input, { unsupported: 'throw' }), TypeError);
  });
}

for (const method of ['clone', 'deepClone']) {
  test(`${method}: a vanished Error prototype cannot bypass the unsupported policy`, () => {
    let reads = 0;
    const proto = new Proxy(Error.prototype, {
      getOwnPropertyDescriptor(target, key) {
        if (key === 'constructor') reads++;
        return Reflect.getOwnPropertyDescriptor(target, key);
      }
    });
    const source = new Proxy(new Error('source'), { getPrototypeOf: () => (reads >= 2 ? null : proto) });
    assert.equal(O[method](source), source);
  });
  test(`${method}: constructor-metadata reflection errors propagate unchanged`, () => {
    let reads = 0;
    const error = new Error('reflection failure');
    const proto = new Proxy(Error.prototype, {
      getOwnPropertyDescriptor(target, key) {
        if (key === 'constructor' && ++reads >= 1) throw error;
        return Reflect.getOwnPropertyDescriptor(target, key);
      }
    });
    const source = new Proxy(new Error('source'), { getPrototypeOf: () => proto });
    assert.throws(
      () => O[method](source),
      (value) => value === error
    );
  });
}
for (const name of ['setImmutable', 'updateImmutable']) {
  test(`${name}: changing a dictionary field preserves other values and the input`, () => {
    const input = { n: 1 };
    const result = name === 'setImmutable' ? O[name](input, 'label', 'new') : O[name](input, 'label', () => 'new');
    assert.deepEqual(result, { n: 1, label: 'new' });
    assert.deepEqual(input, { n: 1 });
  });
  test(`${name}: no-op frozen input retains its readonly runtime state`, () => {
    const input = Object.freeze({ n: 1 });
    const result = name === 'setImmutable' ? O[name](input, 'n', 1) : O[name](input, 'n', (n) => n);
    assert.equal(result, input);
    assert.ok(Object.isFrozen(result));
  });
}
test('merge: numeric/string aliases overwrite the same property without affecting leading-zero keys', () => {
  assert.deepEqual(O.merge({ 0: 'old', '01': 3 }, { 0: 4, 1: 'new' }), { 0: 4, '01': 3, 1: 'new' });
  assert.deepEqual(O.merge({ 0: 4 }, { 0: 'new' }), { 0: 'new' });
});
test('merge: absent optional properties and present undefined have different effects', () => {
  assert.deepEqual(O.merge({ n: 1 }, {}), { n: 1 });
  const result = O.merge({ n: 1 }, { n: undefined });
  assert.equal(Object.hasOwn(result, 'n'), true);
  assert.equal(result.n, undefined);
});
test('immutable writes widen only addressed dictionary values, including nested/symbol keys', () => {
  const key = Symbol('label'),
    branch = { n: 1 },
    input = { row: branch, other: branch };
  const result = O.setImmutable(input, ['row', 'n'], 'new');
  assert.equal(result.row.n, 'new');
  assert.equal(result.other, branch);
  assert.equal(input.row, branch);
  const symbolic = O.setImmutable({ [key]: 1 }, key, 'symbol');
  assert.equal(symbolic[key], 'symbol');
});
