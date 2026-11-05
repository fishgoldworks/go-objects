'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const O = require('..');
const readonly = () =>
  Object.defineProperty({}, 'x', { value: 1, writable: false, configurable: true, enumerable: true });
for (const method of [
  'set',
  'replace',
  'replaceLast',
  'replaceAll',
  'deepReplace',
  'deepReplaceLast',
  'deepReplaceAll'
])
  test(method + ' respects non-writable but configurable properties', () => {
    const obj = readonly();
    assert.throws(() => O[method](obj, method === 'set' ? 'x' : 1, 2), TypeError);
    assert.equal(obj.x, 1);
  });
test('set cannot create descendants through a non-writable undefined property', () => {
  const obj = Object.defineProperty({}, 'x', { value: undefined, writable: false, configurable: true });
  assert.throws(() => O.set(obj, 'x.y', 1), TypeError);
  assert.equal(obj.x, undefined);
});
for (const C of [Error, TypeError, RangeError, EvalError, ReferenceError, SyntaxError, URIError, AggregateError])
  test('clones have real ' + C.name + ' internal branding', () => {
    const error = C === AggregateError ? new C([new Error('cause')], 'many') : new C('message');
    for (const method of ['clone', 'deepClone']) {
      const copy = O[method](error);
      assert.equal(Object.prototype.toString.call(copy), '[object Error]');
      assert.equal(copy instanceof C, true);
      assert.equal(copy.message, error.message);
      assert.deepEqual(Reflect.ownKeys(copy), Reflect.ownKeys(error));
    }
  });
test('deep clones preserve identity through symbol and non-enumerable references', () => {
  const s = Symbol(),
    shared = {};
  const obj = { a: shared };
  Object.defineProperty(obj, 'hidden', { value: shared });
  obj[s] = obj;
  const copy = O.deepClone(obj);
  assert.equal(copy.a, copy.hidden);
  assert.equal(copy[s], copy);
});
test('cloning ignores overridden builtin methods and getters', () => {
  const obj = {
    map: new Map([[1, { n: 2 }]]),
    set: new Set([3]),
    date: new Date(8),
    regex: /test/gi,
    view: new Uint8Array([1, 2])
  };
  Object.defineProperty(obj.date, 'getTime', {
    get() {
      throw new Error('getter');
    }
  });
  Object.defineProperty(obj.regex, 'flags', {
    get() {
      throw new Error('getter');
    }
  });
  Object.defineProperty(obj.view, 'buffer', {
    get() {
      throw new Error('getter');
    }
  });
  obj.map[Symbol.iterator] = () => {
    throw new Error('iterator');
  };
  obj.set[Symbol.iterator] = () => {
    throw new Error('iterator');
  };
  const copy = O.deepClone(obj);
  assert.equal(Map.prototype.get.call(copy.map, 1).n, 2);
  assert.ok(Set.prototype.has.call(copy.set, 3));
  assert.equal(Date.prototype.getTime.call(copy.date), 8);
  assert.deepEqual([...copy.view], [1, 2]);
});
test('resizable and shared buffers and their views follow the unsupported policy', () => {
  for (const buffer of [new ArrayBuffer(8, { maxByteLength: 16 }), new SharedArrayBuffer(8)]) {
    for (const value of [buffer, new Uint8Array(buffer), new DataView(buffer)]) {
      assert.equal(O.deepClone(value), value);
      assert.throws(() => O.deepClone(value, { unsupported: 'throw' }), TypeError);
    }
  }
});
test('cross-realm built-ins are copied without relying on instanceof', () => {
  const values = vm.runInNewContext(
    '[new Set([1]),new Map([[1,2]]),new Date(3),/x/gi,new Number(4),new String("s"),new Boolean(true),Object(1n),Object(Symbol.for("s")),new DataView(new ArrayBuffer(4)),new TypeError("bad")]'
  );
  for (const v of values) {
    const copy = O.deepClone(v);
    assert.notEqual(copy, v);
    assert.equal(Object.prototype.toString.call(copy), Object.prototype.toString.call(v));
  }
});
test('ordinary objects can safely contain every prototype-sensitive key', () => {
  const data = JSON.parse('{"__proto__":{"n":1},"constructor":{"prototype":{"n":2}},"prototype":3}');
  const copy = O.deepClone(data);
  assert.equal(Object.hasOwn(copy, '__proto__'), true);
  assert.equal(Object.getPrototypeOf(copy), Object.prototype);
  assert.notEqual(copy.__proto__, data.__proto__);
  assert.equal({}.n, undefined);
  O.deepReplaceAll(data, 2, 4);
  assert.equal(data.constructor.prototype.n, 4);
  assert.equal({}.n, undefined);
});
test('traversal uses own enumerable symbols and skips inherited/non-enumerable values', () => {
  const s = Symbol();
  const obj = Object.assign(Object.create({ inherited: 1 }), { [s]: { n: 1 } });
  Object.defineProperty(obj, 'hidden', { value: 1 });
  assert.equal(O.deepCount(obj, 1), 1);
  assert.deepEqual(O.findPath(obj, 1), [s, 'n']);
  assert.deepEqual(
    O.deepMapKeys(obj, (v, k) => k),
    { [s]: { n: 1 } }
  );
});
test('transforms preserve null-prototype roots and nested dictionaries', () => {
  const dict = Object.assign(Object.create(null), { x: 1 }),
    root = Object.assign(Object.create(null), { dict });
  for (const fn of ['deepMap', 'deepMapKeys', 'deepFilter']) {
    const result = O[fn](root, fn === 'deepMapKeys' ? (v, k) => k : fn === 'deepFilter' ? () => true : (v) => v);
    assert.equal(Object.getPrototypeOf(result), null);
    assert.equal(Object.getPrototypeOf(result.dict), null);
  }
});
test('empty objects, undefined matches and NaN behave consistently', () => {
  for (const fn of [
    'find',
    'findLast',
    'findKey',
    'findPath',
    'deepFind',
    'deepFindLast',
    'deepFindKey',
    'remove',
    'removeLast',
    'deepRemove',
    'deepRemoveLast'
  ])
    assert.equal(O[fn]({}, 3), undefined);
  for (const fn of ['findAll', 'deepFindAll', 'removeAll', 'deepRemoveAll']) assert.deepEqual(O[fn]({}, 3), []);
  assert.deepEqual(O.findAll({ a: undefined, b: undefined }, undefined), [undefined, undefined]);
  assert.deepEqual(O.deepFindAll({ a: { b: NaN } }, NaN), [NaN]);
  assert.equal(
    O.deepCount({}, () => true),
    0
  );
});
test('deep last-match mutations select the final pre-order match including descendants', () => {
  const child = { x: 1 },
    obj = { a: child };
  assert.equal(
    O.deepRemoveLast(obj, () => true),
    1
  );
  assert.equal(obj.a, child);
  assert.deepEqual(child, {});
});
test('deep shouldDescend paths and predicate paths are isolated', () => {
  const paths = [];
  O.deepForEach({ a: { b: 1 } }, (v, k, p, path) => path.push('changed'), {
    shouldDescend: (v, k, p, path) => {
      paths.push(path);
      return true;
    }
  });
  assert.deepEqual(paths, [['a']]);
});
test('deep boundary branches are retained by reference', () => {
  const child = { x: 1 };
  const copy = O.deepMap({ child }, (v) => v, { maxDepth: 1 });
  assert.equal(copy.child, child);
  assert.deepEqual(
    O.deepMapKeys({ child }, (v, k) => k, { maxDepth: 0 }),
    {}
  );
  assert.deepEqual(
    O.deepFilter({ child }, () => true, { maxDepth: 0 }),
    {}
  );
});
test('iteration snapshots keys but does not read deleted properties from prototypes', () => {
  let inheritedReads = 0;
  const proto = {
    get b() {
      inheritedReads++;
      return 99;
    }
  };
  const obj = Object.create(proto);
  Object.defineProperties(obj, {
    a: { value: 1, enumerable: true, configurable: true },
    b: { value: 2, enumerable: true, configurable: true }
  });
  const seen = [];
  O.forEach(obj, (v, k) => {
    seen.push(k);
    delete obj.b;
    obj.new = 3;
  });
  assert.deepEqual(seen, ['a']);
  assert.equal(inheritedReads, 0);
});
test('key predicates tolerate invalid keys without invoking coercion hooks', () => {
  const invalid = {
    toString() {
      throw new Error('coercion');
    }
  };
  assert.equal(O.hasKey({ a: 1 }, invalid), false);
  assert.equal(O.hasProp({ a: 1 }, invalid), false);
  assert.throws(() => O.pick({}, [invalid]), TypeError);
});
test('mutations do not change non-configurable properties and propagate callback errors', () => {
  const obj = Object.defineProperty({}, 'a', { value: 1, enumerable: true });
  for (const method of ['remove', 'removeLast', 'removeAll', 'deepRemove', 'deepRemoveLast', 'deepRemoveAll'])
    assert.throws(() => O[method](obj, 1), TypeError);
  const error = new Error('sentinel');
  for (const name of ['deepForEach', 'deepMap', 'deepMapKeys', 'deepFilter', 'deepFind', 'deepReplaceAll'])
    assert.throws(
      () =>
        O[name](
          { x: 1 },
          () => {
            throw error;
          },
          ...(name === 'deepReplaceAll' ? [undefined] : [])
        ),
      (e) => e === error || (name === 'deepReplaceAll' && e === error)
    );
});
test('native Error stacks retain the original call site', () => {
  for (const error of [new Error('source'), vm.runInNewContext('new TypeError("cross realm")')]) {
    const copy = O.deepClone(error);
    assert.equal(copy.stack, error.stack);
  }
});
test('user-defined Error stack accessors are retained without invocation', () => {
  let calls = 0;
  const error = new Error('source');
  const get = () => {
    calls++;
    return 'custom';
  };
  Object.defineProperty(error, 'stack', { get, configurable: true });
  const copy = O.deepClone(error);
  assert.equal(calls, 0);
  assert.equal(Object.getOwnPropertyDescriptor(copy, 'stack').get, get);
});
for (const method of ['values', 'entries', 'hasValue'])
  test(method + ' does not read inherited properties exposed by earlier getters', () => {
    let inheritedReads = 0;
    const obj = Object.create({
      get b() {
        inheritedReads++;
        return 99;
      }
    });
    Object.defineProperties(obj, {
      a: {
        get() {
          delete obj.b;
          return 1;
        },
        enumerable: true
      },
      b: { value: 2, enumerable: true, configurable: true }
    });
    const result = O[method](obj, 99);
    assert.equal(inheritedReads, 0);
    if (method === 'values') assert.deepEqual(result, [1]);
    else if (method === 'entries') assert.deepEqual(result, [['a', 1]]);
    else assert.equal(result, false);
  });
test('cloned frozen Errors remain frozen after native stack materialization', () => {
  for (const method of ['clone', 'deepClone']) {
    const input = Object.freeze(new Error('frozen')),
      copy = O[method](input);
    assert.equal(copy.stack, input.stack);
    assert.equal(Object.isFrozen(copy), true);
  }
});
test('custom Error stack formatting failures propagate unchanged', () => {
  const previous = Error.prepareStackTrace;
  const expected = new Error('formatter failed');
  try {
    const source = new Error('source');
    Error.prepareStackTrace = () => {
      throw expected;
    };
    assert.throws(
      () => O.deepClone(source),
      (error) => error === expected
    );
  } finally {
    Error.prepareStackTrace = previous;
  }
});
