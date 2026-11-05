'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const O = require('..');

const names = ['deepMap', 'deepMapKeys', 'deepFilter'];
const outputKey = (name, key) => (name === 'deepMapKeys' && typeof key === 'string' ? key.toUpperCase() : key);
function mapResult(name, value, key) {
  if (name === 'deepMapKeys') return outputKey(name, key);
  if (name === 'deepFilter') return typeof value !== 'number' || value > 1;
  return typeof value === 'number' ? value * 10 : value;
}
function expected(name) {
  if (name === 'deepMapKeys') return { BRANCH: { KEEP: 2, DROP: 1 }, TAIL: 3 };
  if (name === 'deepFilter') return { branch: { keep: 2 }, tail: 3 };
  return { branch: { keep: 20, drop: 10 }, tail: 30 };
}
const altered = {
  'null-prototype callable': (fn) => Object.setPrototypeOf(fn, null),
  'substituted call method': (fn) => {
    fn.call = () => 'wrong';
    return fn;
  },
  'throwing call getter': (fn) => {
    Object.defineProperty(fn, 'call', {
      get() {
        throw new Error('Callback metadata must not be read');
      }
    });
    return fn;
  },
  'callable Proxy with forbidden property reads': (fn) =>
    new Proxy(fn, {
      get() {
        throw new Error('Callback properties must not be read');
      }
    })
};

for (const name of names) {
  for (const [variant, decorate] of Object.entries(altered)) {
    test(name + ' invokes a ' + variant + ' with the original receiver and arguments', () => {
      const input = { branch: { keep: 2, drop: 1 }, tail: 3 };
      const seen = [];
      const callback = decorate(function (value, key, parent, path) {
        assert.equal(arguments.length, 4);
        assert.equal(this, parent);
        assert.equal(parent, key === 'keep' || key === 'drop' ? input.branch : input);
        assert.equal(value, parent[key]);
        seen.push(path.slice());
        path.push('caller-owned');
        return mapResult(name, value, key);
      });
      let result;
      assert.doesNotThrow(() => {
        result = O[name](input, callback);
      });
      assert.deepEqual(result, expected(name));
      assert.deepEqual(seen, [['branch'], ['branch', 'keep'], ['branch', 'drop'], ['tail']]);
      assert.deepEqual(input, { branch: { keep: 2, drop: 1 }, tail: 3 });
      assert.notEqual(result[outputKey(name, 'branch')], input.branch);
    });
  }

  test(name + ' retains a bound callback receiver without binding the parent argument', () => {
    const input = { branch: { keep: 2, drop: 1 }, tail: 3 };
    const receiver = {};
    let calls = 0;
    function callback(value, key, parent) {
      assert.equal(this, receiver);
      assert.equal(parent, key === 'keep' || key === 'drop' ? input.branch : input);
      calls++;
      return mapResult(name, value, key);
    }
    assert.deepEqual(O[name](input, callback.bind(receiver)), expected(name));
    assert.equal(calls, 4);
  });

  test(name + ' preserves an apply-trap failure after one captured getter read', () => {
    const error = new Error('apply failure');
    let reads = 0;
    const input = {
      get first() {
        reads++;
        return 2;
      },
      get later() {
        throw new Error('Later values must not be read');
      }
    };
    const callback = new Proxy(() => true, {
      apply() {
        throw error;
      }
    });
    assert.throws(
      () => O[name](input, callback),
      (actual) => actual === error
    );
    assert.equal(reads, 1);
  });

  test(name + ' separates mapper and descent paths when callbacks retain and freeze them', () => {
    const input = { branch: { keep: 2 }, tail: 3 };
    const callbackPaths = [];
    const descentPaths = [];
    const result = O[name](
      input,
      (value, key, parent, path) => {
        callbackPaths.push(path);
        Object.freeze(path);
        return mapResult(name, value, key);
      },
      {
        shouldDescend(value, key, parent, path) {
          assert.equal(this, input);
          assert.equal(parent, input);
          assert.equal(value, input.branch);
          assert.equal(key, 'branch');
          descentPaths.push(path);
          path.push('descent-owned');
          return true;
        }
      }
    );
    assert.deepEqual(callbackPaths, [['branch'], ['branch', 'keep'], ['tail']]);
    assert.equal(new Set(callbackPaths).size, 3);
    assert.notEqual(callbackPaths[0], descentPaths[0]);
    assert.deepEqual(descentPaths, [['branch', 'descent-owned']]);
    assert.equal(result[outputKey(name, 'branch')][outputKey(name, 'keep')], name === 'deepMap' ? 20 : 2);
  });

  test(name + ' snapshots traversal options before a mapper changes the supplied configuration', () => {
    const input = { a: { b: { n: 2 } } };
    let descents = 0;
    const options = {
      maxDepth: 2,
      shouldDescend: () => {
        descents++;
        return true;
      }
    };
    const result = O[name](
      input,
      (value, key) => {
        options.maxDepth = 0;
        options.shouldDescend = () => {
          throw new Error('Changed options must not be used');
        };
        return mapResult(name, value, key);
      },
      options
    );
    const a = result[outputKey(name, 'a')];
    assert.notEqual(a, input.a);
    assert.equal(a[outputKey(name, 'b')], input.a.b);
    assert.equal(descents, 1);
  });

  test(name + ' retains a blocked alias and shares only the subsequently copied aliases', () => {
    const child = { n: 2 };
    const input = { blocked: child, first: child, repeat: child };
    const decisions = [];
    const seen = [];
    const result = O[name](
      input,
      (value, key, parent, path) => {
        seen.push(path);
        return mapResult(name, value, key);
      },
      {
        shouldDescend(value, key, parent, path) {
          decisions.push(path);
          return key !== 'blocked';
        }
      }
    );
    assert.equal(result[outputKey(name, 'blocked')], child);
    assert.notEqual(result[outputKey(name, 'first')], child);
    assert.equal(result[outputKey(name, 'repeat')], result[outputKey(name, 'first')]);
    assert.deepEqual(decisions, [['blocked'], ['first']]);
    assert.deepEqual(seen, [['blocked'], ['first'], ['first', 'n'], ['repeat']]);
    assert.equal(child.n, 2);
  });

  test(name + ' does not retroactively rewire an earlier depth-cutoff alias', () => {
    const shared = { n: 2 };
    const input = { deep: { shared }, shallow: shared };
    const result = O[name](input, (value, key) => mapResult(name, value, key), { maxDepth: 2 });
    const deep = result[outputKey(name, 'deep')];
    const shallow = result[outputKey(name, 'shallow')];
    assert.equal(deep[outputKey(name, 'shared')], shared);
    assert.notEqual(shallow, shared);
    assert.equal(shallow[outputKey(name, 'n')], name === 'deepMap' ? 20 : 2);
    assert.equal(shared.n, 2);
  });

  test(name + ' does not inspect a thenable returned by its callback', () => {
    const sentinel = {};
    Object.defineProperty(sentinel, 'then', {
      get() {
        throw new Error('then must not be read');
      }
    });
    const input = { value: 2 };
    if (name === 'deepMapKeys') {
      assert.throws(() => O[name](input, () => sentinel), TypeError);
    } else {
      const result = O[name](input, () => sentinel);
      assert.equal(result.value, name === 'deepMap' ? sentinel : 2);
    }
  });

  test(name + ' copies the observed getter value even when the mapper replaces that source property', () => {
    let reads = 0;
    const observed = { n: 2 };
    const input = {};
    Object.defineProperty(input, 'value', {
      enumerable: true,
      configurable: true,
      get() {
        reads++;
        return observed;
      }
    });
    const result = O[name](input, (value, key, parent) => {
      if (parent === input) Object.defineProperty(input, 'value', { value: { other: 9 }, enumerable: true });
      return mapResult(name, value, key);
    });
    assert.equal(reads, 1);
    assert.equal(result[outputKey(name, 'value')][outputKey(name, 'n')], name === 'deepMap' ? 20 : 2);
    assert.deepEqual(input.value, { other: 9 });
    assert.deepEqual(observed, { n: 2 });
  });
}

test('deepMap treats a replacement pointing to another input branch as an explicit opaque replacement', () => {
  const shared = { n: 2 };
  const input = { replace: { old: 1 }, visit: shared };
  const seen = [];
  const result = O.deepMap(input, (value, key, parent, path) => {
    seen.push(path);
    if (key === 'replace') return shared;
    return typeof value === 'number' ? value * 10 : value;
  });
  assert.equal(result.replace, shared);
  assert.notEqual(result.visit, shared);
  assert.deepEqual(result.visit, { n: 20 });
  assert.deepEqual(seen, [['replace'], ['visit'], ['visit', 'n']]);
  assert.deepEqual(shared, { n: 2 });
});

test('deepFilter can expand a later accepted alias after pruning the first incoming edge', () => {
  const shared = { secret: 2, visible: 3 };
  const input = { rejected: shared, accepted: shared };
  const seen = [];
  const result = O.deepFilter(input, (value, key, parent, path) => {
    seen.push(path);
    return key !== 'rejected' && key !== 'secret';
  });
  assert.deepEqual(result, { accepted: { visible: 3 } });
  assert.deepEqual(seen, [['rejected'], ['accepted'], ['accepted', 'secret'], ['accepted', 'visible']]);
  assert.deepEqual(shared, { secret: 2, visible: 3 });
});

test('deepMapKeys skips preserved indices but directly invokes the mapper for their children and array extras', () => {
  const symbol = Symbol('extra');
  const input = new Array(4);
  input[2] = { first_name: 'Michael' };
  input.extra_name = 7;
  input[symbol] = 8;
  const seen = [];
  const mapper = Object.setPrototypeOf((value, key, parent, path) => {
    seen.push(path);
    return typeof key === 'string' ? key.replace('_', '') : key;
  }, null);
  let result;
  assert.doesNotThrow(() => {
    result = O.deepMapKeys(input, mapper, { arrays: 'preserve', onCollision: 'throw' });
  });
  assert.equal(result.length, 4);
  assert.equal(Object.hasOwn(result, 0), false);
  assert.equal(Object.hasOwn(result, 3), false);
  assert.deepEqual(result[2], { firstname: 'Michael' });
  assert.equal(result.extraname, 7);
  assert.equal(result[symbol], 8);
  assert.deepEqual(seen, [['2', 'first_name'], ['extra_name'], [symbol]]);
});

test('deepMapKeys does not inspect descendants or invoke descent after an invalid mapped key', () => {
  const child = {};
  Object.defineProperty(child, 'unvisited', {
    enumerable: true,
    get() {
      throw new Error('No descendant should be read');
    }
  });
  const invalid = {};
  invalid[Symbol.toPrimitive] = () => {
    throw new Error('No mapped-key coercion');
  };
  let calls = 0;
  assert.throws(
    () =>
      O.deepMapKeys(
        { child },
        () => {
          calls++;
          return invalid;
        },
        {
          shouldDescend() {
            throw new Error('No descent after invalid mapped key');
          }
        }
      ),
    TypeError
  );
  assert.equal(calls, 1);
});

test('deepMapKeys validates preserved-array extra-key conflicts before expanding a returned branch', () => {
  for (const onCollision of ['overwrite', 'throw']) {
    const input = [];
    input.extra = { hidden: 1 };
    let descents = 0;
    assert.throws(
      () =>
        O.deepMapKeys(input, () => '0', {
          arrays: 'preserve',
          onCollision,
          shouldDescend() {
            descents++;
            return true;
          }
        }),
      TypeError
    );
    assert.equal(descents, 0);
    assert.equal(input.length, 0);
    assert.deepEqual(input.extra, { hidden: 1 });
  }
});

test('deepMapKeys keeps a copied alias reachable even when a later colliding root key overwrites its first edge', () => {
  const first = { n: 2 };
  const second = { n: 3 };
  const input = { first, second, alias: first };
  const result = O.deepMapKeys(input, (_value, key) => (key === 'first' || key === 'second' ? 'entry' : key));
  assert.deepEqual(result, { entry: { n: 3 }, alias: { n: 2 } });
  assert.notEqual(result.alias, first);
  assert.notEqual(result.entry, second);
  assert.deepEqual(input, { first, second, alias: first });
});
