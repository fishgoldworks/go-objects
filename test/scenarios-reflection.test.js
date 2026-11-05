'use strict';
// Reflection and callback effects are observable, not transactional.
// These cases test that they fail transparently or skip vanished properties safely.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const O = require('..');

for (const method of ['clone', 'deepClone']) {
  test(method + ' handles unsupported prototype constructors without invoking them', () => {
    let calls = 0;
    for (const proto of [
      Object.create(null),
      { constructor: 7 },
      Object.defineProperty({}, 'constructor', {
        get() {
          calls++;
          return Object;
        }
      })
    ]) {
      const source = Object.assign(Object.create(proto), { n: 1 });
      assert.equal(O[method](source), source);
      assert.throws(() => O[method](source, { unsupported: 'throw' }), TypeError);
    }
    assert.equal(calls, 0);
  });
  test(method + ' skips a descriptor removed by an earlier reflection trap', () => {
    const target = { first: 1, vanished: 2 };
    const source = new Proxy(target, {
      getOwnPropertyDescriptor(object, key) {
        if (key === 'first') delete object.vanished;
        return Reflect.getOwnPropertyDescriptor(object, key);
      }
    });
    const result = O[method](source);
    assert.deepEqual(result, { first: 1 });
    assert.notEqual(result, source);
    assert.equal(Object.hasOwn(target, 'vanished'), false); // Proxy effects are not rolled back.
  });
}

test('immutable copy skips descriptors removed after its key snapshot', () => {
  const target = { first: 1, vanished: 2 };
  let reads = 0;
  const source = new Proxy(target, {
    getOwnPropertyDescriptor(object, key) {
      if (key === 'first' && ++reads === 2) delete object.vanished;
      return Reflect.getOwnPropertyDescriptor(object, key);
    }
  });
  const result = O.setImmutable(source, 'first', 9);
  assert.deepEqual(result, { first: 9 });
  assert.deepEqual(target, { first: 1 });
});

test('immutable deletion reports a slot changed to a non-configurable accessor during copying', () => {
  const target = { field: 1 };
  let inspections = 0,
    getterCalls = 0;
  const source = new Proxy(target, {
    getOwnPropertyDescriptor(object, key) {
      if (key === 'field' && ++inspections === 2) {
        Object.defineProperty(object, key, {
          get() {
            getterCalls++;
            return 1;
          },
          enumerable: true,
          configurable: false
        });
      }
      return Reflect.getOwnPropertyDescriptor(object, key);
    }
  });
  assert.throws(() => O.unsetImmutable(source, 'field'), TypeError);
  assert.equal(getterCalls, 0);
  assert.equal(Object.hasOwn(target, 'field'), true);
  assert.equal(Object.getOwnPropertyDescriptor(target, 'field').configurable, false);
});

for (const method of ['remove', 'removeLast', 'removeAll', 'replace', 'replaceLast', 'replaceAll']) {
  test(method + ' skips later keys removed by its matcher without reading inherited replacements', () => {
    let inheritedReads = 0;
    const proto = {
      get later() {
        inheritedReads++;
        throw new Error('prototype read');
      }
    };
    const source = Object.create(proto);
    const order = method.endsWith('Last') ? ['later', 'first'] : ['first', 'later'];
    for (const key of order)
      Object.defineProperty(source, key, {
        value: key === 'first' ? 1 : 2,
        enumerable: true,
        configurable: true,
        writable: true
      });
    const seen = [];
    const result = O[method](
      source,
      (_, key) => {
        seen.push(key);
        if (key === 'first') delete source.later;
        return false;
      },
      9
    );
    assert.deepEqual(seen, ['first']);
    assert.equal(inheritedReads, 0);
    assert.deepEqual(result, method.endsWith('All') ? [] : undefined);
    assert.equal(source.first, 1);
  });
}

for (const method of ['deepReplace', 'deepReplaceLast', 'deepReplaceAll']) {
  test(method + ' rechecks descriptors after a predicate deletes the matched slot', () => {
    let replacements = 0;
    const source = { child: { n: 1 } };
    assert.throws(
      () =>
        O[method](
          source,
          (value, key, parent) => {
            if (key !== 'n') return false;
            delete parent[key];
            return true;
          },
          () => {
            replacements++;
            return 2;
          }
        ),
      TypeError
    );
    assert.equal(replacements, 0);
    assert.deepEqual(source, { child: {} });
  });
}
