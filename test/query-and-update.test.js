'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const O = require('..');

for (const name of ['has', 'update', 'some', 'every', 'findEntry']) {
  test(name + ' is exported through namespace, standalone and wrapper', () => {
    assert.equal(typeof O[name], 'function');
    assert.equal(require('../src/' + name), O[name]);
    assert.equal(typeof O({})[name], 'function');
  });
}
test('has distinguishes present undefined, null, missing and inherited values', () => {
  const value = Object.assign(Object.create({ inherited: { x: 1 } }), { x: { u: undefined, n: null } });
  assert.equal(O.has(value, 'x.u'), true);
  assert.equal(O.has(value, 'x.n'), true);
  assert.equal(O.has(value, 'x.missing'), false);
  assert.equal(O.has(value, 'inherited.x'), false);
  assert.equal(O.has(value, 'x.u.missing'), false);
  assert.equal(O.has(value, 'x.n.missing'), false);
});
test('has supports exact keys, escaped keys, symbol segments, non-enumerables and sparse arrays', () => {
  const s = Symbol('value');
  // eslint-disable-next-line no-sparse-arrays -- Missing array slots are the behavior under test.
  const value = { 'a.b': { [s]: undefined }, rows: [, undefined] };
  Object.defineProperty(value, 'hidden', { value: 3 });
  assert.equal(O.has(value, ['a.b', s]), true);
  assert.equal(O.has(value, '["a.b"]'), true);
  assert.equal(O.has(value, 'rows[0]'), false);
  assert.equal(O.has(value, 'rows[1]'), true);
  assert.equal(O.has(value, 'rows.length'), true);
  assert.equal(O.has(value, 'hidden'), true);
  assert.equal(O.has({ '': 0 }, ''), true);
  assert.equal(O.has({ 2: undefined }, 2), true);
});
test('has does not evaluate terminal getters and evaluates intermediate getters once', () => {
  let reads = 0;
  const obj = {
    get first() {
      reads++;
      return {
        get last() {
          throw new Error('terminal');
        }
      };
    }
  };
  assert.equal(O.has(obj, 'first.last'), true);
  assert.equal(reads, 1);
  assert.equal(O.has(obj, 'first'), true);
  assert.equal(reads, 1);
});
test('has supports root paths, functions and null-prototype/cross-realm objects', () => {
  for (const obj of [{}, [], () => {}, Object.create(null), vm.runInNewContext('({a:1})')])
    assert.equal(O.has(obj, []), true);
  for (const obj of [null, undefined, 0, 'text', true, 1n, Symbol()]) {
    assert.equal(O.has(obj, []), false);
    assert.equal(O.has(obj, 'x'), false);
  }
});
test('has rejects malformed paths and propagates intermediate accessor errors', () => {
  for (const path of ['a[', 'a..b', null, {}, [{}]]) assert.throws(() => O.has({}, path));
  const error = new Error('read');
  assert.throws(
    () =>
      O.has(
        {
          get a() {
            throw error;
          }
        },
        'a.b'
      ),
    (e) => e === error
  );
  assert.equal(O.has(JSON.parse('{"__proto__":{"x":1}}'), '__proto__.x'), true);
});
test('update computes once, returns observed previous value and keeps wrapper root', () => {
  const value = { retry: { attempts: 2 } };
  let calls = 0;
  assert.equal(
    O.update(value, 'retry.attempts', (old) => {
      calls++;
      return old + 1;
    }),
    2
  );
  assert.equal(value.retry.attempts, 3);
  assert.equal(calls, 1);
  const chain = O(value).update('retry.attempts', (old) => old + 1);
  assert.equal(chain.result(), 3);
  assert.equal(chain.unwrap(), value);
  assert.equal(value.retry.attempts, 4);
});
test('update creates missing and undefined paths with arrays and symbol keys', () => {
  const obj = { items: undefined };
  const s = Symbol('x');
  assert.equal(
    O.update(obj, 'items[0].attempts', (v) => (v ?? 0) + 1),
    undefined
  );
  assert.deepEqual(obj, { items: [{ attempts: 1 }] });
  O.update(obj, [s], () => undefined);
  assert.equal(Object.hasOwn(obj, s), true);
});
test('update does not attach intermediates when its updater throws', () => {
  const obj = {};
  const error = new Error('updater');
  assert.throws(
    () =>
      O.update(obj, 'a[0].b', () => {
        throw error;
      }),
    (e) => e === error
  );
  assert.deepEqual(obj, {});
  const second = { a: undefined };
  assert.throws(() =>
    O.update(second, 'a.b', () => {
      throw error;
    })
  );
  assert.deepEqual(second, { a: undefined });
});
test('update rejects unsafe paths and invalid callbacks before invoking user code', () => {
  let calls = 0;
  const obj = {};
  for (const path of ['__proto__.polluted', 'constructor.prototype.x', ['safe', 'prototype', 'x'], 'a[', []]) {
    assert.throws(() =>
      O.update(obj, path, () => {
        calls++;
        return true;
      })
    );
  }
  assert.throws(() => O.update(obj, 'a.b', null), TypeError);
  assert.equal(calls, 0);
  assert.deepEqual(obj, {});
  assert.equal({}.polluted, undefined);
});
test('update rejects accessors without evaluating getters or invoking updater', () => {
  let calls = 0;
  const obj = {
    get a() {
      calls++;
      return {};
    }
  };
  for (const path of ['a', 'a.b'])
    assert.throws(
      () =>
        O.update(obj, path, () => {
          calls++;
          return 1;
        }),
      TypeError
    );
  assert.equal(calls, 0);
});
test('update checks readonly, non-extensible and scalar destinations before updater', () => {
  let calls = 0;
  const callback = () => {
    calls++;
    return 2;
  };
  for (const [obj, path] of [
    [Object.freeze({ a: 1 }), 'a'],
    [Object.preventExtensions({}), 'a'],
    [{ a: null }, 'a.b'],
    [{ a: 2 }, 'a.b'],
    [{ a: () => {} }, 'a.b'],
    [null, 'a'],
    [() => {}, 'a']
  ]) {
    assert.throws(() => O.update(obj, path, callback), TypeError);
  }
  const missing = {};
  Object.defineProperty(missing, 'a', { value: undefined, writable: false });
  assert.throws(() => O.update(missing, 'a.b', callback), TypeError);
  assert.equal(calls, 0);
});
test('update respects readonly array length before calling updater', () => {
  const array = [1];
  Object.defineProperty(array, 'length', { writable: false });
  let calls = 0;
  assert.throws(
    () =>
      O.update(array, [1], () => {
        calls++;
        return 2;
      }),
    TypeError
  );
  assert.throws(
    () =>
      O.update(array, [2, 'a'], () => {
        calls++;
        return 2;
      }),
    TypeError
  );
  assert.equal(calls, 0);
  assert.equal(
    O.update(array, [0], (v) => v + 1),
    1
  );
  assert.equal(array[0], 2);
});
test('update does not follow inherited containers and preserves literal set functions', () => {
  const proto = { branch: { x: 10 } },
    obj = Object.create(proto);
  const fn = () => 1;
  O.update(obj, 'branch.x', (v) => (v ?? 0) + 1);
  assert.equal(obj.branch.x, 1);
  assert.equal(proto.branch.x, 10);
  O.set(obj, 'handler', fn);
  assert.equal(obj.handler, fn);
  O.update(obj, 'handler', (old) => () => old() + 1);
  assert.equal(obj.handler(), 2);
});
test('update rechecks write restrictions after callback side effects', () => {
  const obj = { a: 1 };
  assert.throws(
    () =>
      O.update(obj, 'a', () => {
        Object.freeze(obj);
        return 2;
      }),
    TypeError
  );
  assert.equal(obj.a, 1);
  const other = { a: 1 };
  assert.equal(
    O.update(other, 'a', (old) => {
      other.a = 100;
      return old + 1;
    }),
    1
  );
  assert.equal(other.a, 2);
});
for (const name of ['some', 'every', 'findEntry']) {
  test(name + ' requires a matcher, accepts explicit undefined and validates collection', () => {
    assert.throws(() => O[name]({}), TypeError);
    assert.throws(() => O({})[name](), TypeError);
    assert.throws(() => O[name](null, undefined), TypeError);
    const actual = O[name]({ x: undefined }, undefined);
    assert.deepEqual(actual, name === 'findEntry' ? ['x', undefined] : true);
  });
  test(name + ' supports symbols, SameValueZero and function identity predicates', () => {
    const s = Symbol();
    const obj = { [s]: NaN };
    const fn = () => {};
    assert.deepEqual(O[name](obj, NaN), name === 'findEntry' ? [s, NaN] : true);
    assert.deepEqual(O[name]({ x: -0 }, 0), name === 'findEntry' ? ['x', -0] : true);
    assert.deepEqual(
      O[name]({ fn }, (v) => v === fn),
      name === 'findEntry' ? ['fn', fn] : true
    );
  });
  test(name + ' uses callback context and own enumerable snapshot', () => {
    const obj = Object.assign(Object.create({ inherited: 1 }), { a: 1, b: 2 });
    const visited = [];
    Object.defineProperty(obj, 'hidden', { value: 10 });
    const predicate = function (value, key, parent) {
      assert.equal(this, obj);
      assert.equal(parent, obj);
      visited.push([key, value]);
      delete obj.b;
      obj.c = 3;
      return name === 'every';
    };
    O[name](obj, predicate);
    assert.deepEqual(visited, [['a', 1]]);
  });
  test(name + ' propagates callback errors', () => {
    const err = new Error('callback');
    assert.throws(
      () =>
        O[name]({ a: 1 }, () => {
          throw err;
        }),
      (e) => e === err
    );
  });
}
test('some and every have empty quantifier identities', () => {
  assert.equal(
    O.some({}, () => true),
    false
  );
  assert.equal(
    O.every({}, () => false),
    true
  );
  assert.equal(O.some(new Array(4), undefined), false);
  assert.equal(O.every(new Array(4), undefined), true);
});
test('some can match every falsy value and every rejects one failing value', () => {
  for (const value of [false, 0, null, undefined, NaN, '']) assert.equal(O.some({ x: value }, value), true);
  assert.equal(O.every({ a: 1, b: 2 }, 1), false);
  assert.equal(O.some({ a: 1, b: 2 }, 3), false);
});
test('boolean queries and findEntry do not read values after short-circuiting', () => {
  const obj = {
    first: 1,
    get later() {
      throw new Error('must not read');
    }
  };
  assert.equal(O.some(obj, 1), true);
  assert.equal(O.every(obj, 0), false);
  assert.deepEqual(O.findEntry(obj, 1), ['first', 1]);
});
test('findEntry returns observed value even when predicate rewrites its property', () => {
  let reads = 0;
  const obj = {
    get value() {
      return ++reads;
    }
  };
  assert.deepEqual(
    O.findEntry(obj, () => true),
    ['value', 1]
  );
  assert.equal(reads, 1);
  const data = { x: 1 };
  assert.deepEqual(
    O.findEntry(data, (v) => {
      data.x = 10;
      return v === 1;
    }),
    ['x', 1]
  );
  assert.equal(
    O.findEntry({}, () => true),
    undefined
  );
  assert.equal(O.findEntry({ x: 1 }, 2), undefined);
});
test('query wrappers advance to their boolean or entry result', () => {
  assert.equal(O({ a: 1 }).has('a').unwrap(), true);
  assert.equal(O({ a: 1 }).some(1).unwrap(), true);
  assert.equal(O({ a: 1 }).every(1).result(), true);
  assert.deepEqual(O({ a: 1 }).findEntry(1).unwrap(), ['a', 1]);
});
test('count without matcher counts keys without reading values', () => {
  let reads = 0;
  const s = Symbol();
  const obj = {
    a: undefined,
    [s]: 1,
    get b() {
      reads++;
      throw new Error('getter');
    }
  };
  Object.defineProperty(obj, 'hidden', { value: 1 });
  assert.equal(O.count(obj), 3);
  assert.equal(O(obj).count().unwrap(), 3);
  assert.equal(reads, 0);
  assert.equal(O.count({ x: 1, u: undefined }, undefined), 1);
  assert.equal(O({ x: 1, u: undefined }).count(undefined).result(), 1);
  assert.equal(O.count(new Array(3)), 0);
  assert.throws(() => O.count(null), TypeError);
});
test('omit never reads excluded getters and reads retained getters once', () => {
  let excluded = 0,
    retained = 0;
  const s = Symbol();
  const obj = {
    get secret() {
      excluded++;
      throw new Error('excluded');
    },
    get visible() {
      retained++;
      return 1;
    },
    get [s]() {
      excluded++;
      throw new Error('symbol');
    }
  };
  assert.deepEqual(O.omit(obj, ['secret', s]), { visible: 1 });
  assert.equal(excluded, 0);
  assert.equal(retained, 1);
  assert.throws(() => O.omit(obj, []), /excluded/);
});
test('omit skips properties deleted by earlier getters without inherited fallthrough', () => {
  const obj = Object.create({ later: 9 });
  Object.defineProperties(obj, {
    first: {
      enumerable: true,
      get() {
        delete obj.later;
        obj.added = 1;
        return 2;
      }
    },
    later: { enumerable: true, configurable: true, value: 3 }
  });
  assert.deepEqual(O.omit(obj, []), { first: 2 });
});
for (const name of ['mapKeys', 'deepMapKeys']) {
  test(name + ' keeps overwrite default and optionally rejects normalised collisions', () => {
    const obj = { UserID: 10, userid: 20 };
    const fn = (v, k) => k.toLowerCase();
    assert.deepEqual(O[name](obj, fn), { userid: 20 });
    assert.deepEqual(O[name](obj, fn, { onCollision: 'overwrite' }), { userid: 20 });
    assert.throws(() => O[name](obj, fn, { onCollision: 'throw' }), /collision/i);
    assert.deepEqual(obj, { UserID: 10, userid: 20 });
    assert.throws(
      () => O[name]({ a: 1, b: 2 }, (v, k) => (k === 'a' ? 1 : '1'), { onCollision: 'throw' }),
      /collision/i
    );
  });
  test(name + ' handles symbol identity and unsafe-looking output keys safely', () => {
    const one = Symbol('same'),
      two = Symbol('same');
    assert.equal(
      Reflect.ownKeys(O[name]({ a: 1, b: 2 }, (v, k) => (k === 'a' ? one : two), { onCollision: 'throw' })).length,
      2
    );
    assert.throws(() => O[name]({ a: 1, b: 2 }, () => one, { onCollision: 'throw' }), /collision/i);
    const value = O[name]({ a: 1 }, () => '__proto__', { onCollision: 'throw' });
    assert.equal(Object.getPrototypeOf(value), Object.prototype);
    assert.equal(Object.hasOwn(value, '__proto__'), true);
    assert.throws(() => O[name]({ a: 1, b: 2 }, () => '__proto__', { onCollision: 'throw' }), /collision/i);
  });
  test(name + ' rejects invalid options before callbacks', () => {
    let calls = 0;
    for (const options of [
      null,
      1,
      [],
      () => {},
      { unknown: true },
      { onCollision: 'ignore' },
      { onCollision: undefined },
      { [Symbol()]: 1 }
    ]) {
      assert.throws(
        () =>
          O[name](
            { a: 1 },
            () => {
              calls++;
              return 'a';
            },
            options
          ),
        TypeError
      );
    }
    assert.equal(calls, 0);
    assert.deepEqual(
      O[name]({ a: 1 }, (v, k) => k, {}),
      { a: 1 }
    );
  });
}
test('deepMapKeys checks collisions per output container and composes traversal options', () => {
  const obj = { left: { A: 1, a: 2 }, right: { a: 3 } };
  assert.throws(() => O.deepMapKeys(obj, (v, k) => k.toLowerCase(), { onCollision: 'throw' }), /collision/i);
  const shallow = O.deepMapKeys(obj, (v, k) => k.toLowerCase(), { onCollision: 'throw', maxDepth: 1 });
  assert.equal(shallow.left, obj.left);
  assert.deepEqual(
    O.deepMapKeys({ left: { A: 1 }, right: { A: 2 } }, (v, k) => k.toLowerCase(), { onCollision: 'throw' }),
    { left: { a: 1 }, right: { a: 2 } }
  );
  const skipped = O.deepMapKeys(obj, (v, k) => k, { onCollision: 'throw', shouldDescend: () => false });
  assert.equal(skipped.left, obj.left);
  assert.deepEqual(
    O.deepMapKeys(obj, (v, k) => k, { onCollision: 'throw', maxDepth: 0 }),
    {}
  );
  for (const name of ['deepMap', 'deepFilter', 'deepForEach'])
    assert.throws(() => O[name]({}, () => true, { onCollision: 'throw' }), TypeError);
});
test('strict deepMapKeys retains cycle and alias identity without false collisions', () => {
  const child = { x: 1 };
  const obj = { left: child, right: child };
  obj.self = obj;
  const result = O.deepMapKeys(obj, (v, k) => k.toUpperCase(), { onCollision: 'throw' });
  assert.equal(result.SELF, result);
  assert.equal(result.LEFT, result.RIGHT);
  assert.deepEqual(result.LEFT, { X: 1 });
});

test('update supports sealed existing slots, null-prototype roots and sparse arrays', () => {
  const sealed = Object.seal({ a: undefined });
  assert.equal(
    O.update(sealed, 'a.x', () => 3),
    undefined
  );
  assert.equal(sealed.a.x, 3);
  const dict = Object.create(null);
  O.update(dict, 'x.y', () => 4);
  assert.equal(dict.x.y, 4);
  const array = new Array(3);
  Object.defineProperty(array, 'length', { writable: false });
  O.update(array, [1], () => 5);
  assert.equal(array.length, 3);
  assert.equal(array[1], 5);
  assert.equal(0 in array, false);
});
test('update can store promises and functions literally without awaiting callbacks', () => {
  const promise = Promise.resolve(1),
    fn = () => 2,
    obj = {};
  O.update(obj, 'promise', () => promise);
  O.update(obj, 'fn', () => fn);
  assert.equal(obj.promise, promise);
  assert.equal(obj.fn, fn);
});
test('new queries and omission support cross-realm and null-prototype records', () => {
  for (const obj of [
    Object.assign(Object.create(null), { a: 1, b: undefined }),
    vm.runInNewContext('({a:1,b:undefined})')
  ]) {
    assert.equal(O.has(obj, 'b'), true);
    assert.equal(O.some(obj, undefined), true);
    assert.equal(
      O.every(obj, (v) => v === 1 || v === undefined),
      true
    );
    assert.deepEqual(O.findEntry(obj, 1), ['a', 1]);
    assert.equal(O.count(obj), 2);
    assert.equal(O.omit(obj, ['b']).a, 1);
  }
});
test('strict key options accept null-prototype and cross-realm option records', () => {
  for (const options of [
    Object.assign(Object.create(null), { onCollision: 'throw' }),
    vm.runInNewContext('({onCollision:"throw"})')
  ]) {
    for (const name of ['mapKeys', 'deepMapKeys']) {
      assert.deepEqual(
        O[name]({ a: 1 }, (v, k) => k, options),
        { a: 1 }
      );
      assert.throws(() => O[name]({ a: 1, b: 2 }, () => 0, options), /collision/);
    }
  }
});
test('strict key collisions compare canonical property names rather than numeric lookalikes', () => {
  for (const name of ['mapKeys', 'deepMapKeys']) {
    assert.deepEqual(
      O[name]({ a: 1, b: 2 }, (v, k) => (k === 'a' ? '01' : 1), { onCollision: 'throw' }),
      { '01': 1, 1: 2 }
    );
    assert.throws(() => O[name]({ a: 1, b: 2 }, (v, k) => (k === 'a' ? -0 : 0), { onCollision: 'throw' }), /collision/);
  }
});
test('seeded query/selection results agree with own-entry reference implementations', () => {
  let seed = 0x63abcd;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed;
  }
  const values = [undefined, null, false, 0, -0, NaN, '', 1, 2, 'ready'];
  const same = (a, b) => a === b || (a !== a && b !== b);
  for (let iteration = 0; iteration < 500; iteration++) {
    const obj = Object.create({ inherited: 'ready' }),
      keys = [];
    const length = random() % 12;
    for (let i = 0; i < length; i++) {
      const key = i % 4 === 0 ? Symbol('s' + i) : 'key' + i;
      keys.push(key);
      obj[key] = values[random() % values.length];
    }
    Object.defineProperty(obj, 'hidden', { value: 0 });
    const entries = Reflect.ownKeys(obj)
      .filter((k) => Object.prototype.propertyIsEnumerable.call(obj, k))
      .map((k) => [k, obj[k]]);
    const target = values[random() % values.length],
      predicate = (v) => same(v, target);
    assert.equal(O.count(obj), entries.length);

    assert.equal(O.count(obj, target), entries.filter(([, v]) => predicate(v)).length);
    assert.equal(
      O.some(obj, target),

      entries.some(([, v]) => predicate(v))
    );
    assert.equal(
      O.every(obj, target),

      entries.every(([, v]) => predicate(v))
    );
    assert.deepEqual(
      O.findEntry(obj, target),

      entries.find(([, v]) => predicate(v))
    );
    const excluded = keys.filter((_, i) => i % 2 === 0),
      expected = Object.fromEntries(entries.filter(([k]) => !excluded.includes(k)));
    assert.deepEqual(O.omit(obj, excluded), expected);
  }
});
test('seeded dynamic updates match direct own-array updates and return observed values', () => {
  const obj = { rows: [] };
  for (let i = 0; i < 200; i++) {
    const index = (i * 17) % 23,
      path = ['rows', index, 'attempts'];
    const previous = obj.rows[index]?.attempts;
    assert.equal(O.has(obj, path), previous !== undefined);
    assert.equal(
      O.update(obj, path, (n) => (n ?? 0) + 1),
      previous
    );
    assert.equal(O.get(obj, path), (previous ?? 0) + 1);
    assert.equal(O.has(obj, path), true);
  }
});
test('type declaration entrypoints cover every runtime utility and wrapper', () => {
  const fs = require('node:fs'),
    path = require('node:path'),
    root = path.resolve(__dirname, '..');
  const declarations = fs.readFileSync(path.join(root, 'types/api.d.ts'), 'utf8');
  const esm = fs.readFileSync(path.join(root, 'index.d.mts'), 'utf8');
  for (const name of Object.keys(O)) {
    assert.ok(fs.existsSync(path.join(root, 'package/src', name + '.d.ts')), name);
    assert.ok(declarations.includes('export function ' + name), name);
    assert.ok(declarations.includes('  ' + name + '(') || declarations.includes('  ' + name + '<'), name);
    assert.ok(esm.includes('export const ' + name + ':'), name);
  }
});
