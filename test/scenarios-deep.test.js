'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const O = require('..');
const readSearch = ['deepFind', 'deepFindLast', 'deepFindAll', 'deepFindKey', 'findPath', 'deepCount', 'deepFindEntry'];
const transform = ['deepMap', 'deepMapKeys', 'deepFilter'];
const changes = ['deepRemove', 'deepRemoveLast', 'deepRemoveAll', 'deepReplace', 'deepReplaceLast', 'deepReplaceAll'];
const allDeep = [...readSearch, 'deepForEach', ...transform, ...changes];
function invoke(name, object, callback, options) {
  return name.startsWith('deepReplace') ? O[name](object, callback, 99, options) : O[name](object, callback, options);
}

for (const name of allDeep) {
  test(name + ' validates all traversal option partitions before callbacks', () => {
    let reads = 0,
      callbacks = 0;
    const input = {
      get a() {
        reads++;
        return { n: 1 };
      }
    };
    const invalid = [
      null,
      [],
      new Date(),
      () => 1,
      { unknown: true },
      { [Symbol('option')]: 1 },
      ...[-1, 0.5, NaN, -Infinity, '1', null, undefined, Number.MAX_SAFE_INTEGER + 1].map((maxDepth) => ({ maxDepth })),
      ...[null, false, 1, 'callback', {}].map((shouldDescend) => ({ shouldDescend }))
    ];
    for (const options of invalid)
      assert.throws(
        () =>
          invoke(
            name,
            input,
            () => {
              callbacks++;
              return true;
            },
            options
          ),
        TypeError
      );
    assert.equal(reads, 0);
    assert.equal(callbacks, 0);
  });
  test(name + ' propagates the exact user exception at the first visited property', () => {
    const error = new Error(name);
    let reads = 0;
    const input = {
      get first() {
        reads++;
        return 1;
      },
      get second() {
        reads++;
        return 2;
      }
    };
    assert.throws(
      () =>
        invoke(name, input, () => {
          throw error;
        }),
      (thrown) => thrown === error
    );
    assert.equal(reads, 1);
  });
  test(name + ' does not evaluate properties or callbacks at maxDepth zero', () => {
    let reads = 0,
      calls = 0;
    const input = {
      get a() {
        reads++;
        return 1;
      }
    };
    invoke(
      name,
      input,
      () => {
        calls++;
        return true;
      },
      { maxDepth: 0 }
    );
    assert.equal(reads, 0);
    assert.equal(calls, 0);
  });
}

for (const name of ['deepForEach', ...transform, ...readSearch]) {
  test(name + ' observes own-property deletion and enumerability changes without prototype fallback', () => {
    const hidden = Symbol('hidden');
    const child = Object.assign(Object.create(null), { first: 1, deleted: 2, changed: 3, [hidden]: 4 });
    const input = { child };
    const seen = [];
    invoke(name, input, (value, key, parent, path) => {
      seen.push([...path]);
      if (key === 'first') {
        delete child.deleted;
        Object.defineProperty(child, 'changed', { enumerable: false });
        delete child[hidden];
        child.new = 9;
      }
      return name === 'deepMapKeys' ? key : name === 'deepMap' ? value : ['deepFilter', 'deepForEach'].includes(name);
    });
    assert.deepEqual(seen, [['child'], ['child', 'first']]);
  });
}

for (const [label, value] of [
  ['undefined', undefined],
  ['null', null],
  ['NaN', NaN],
  ['zero', -0],
  ['false', false],
  ['empty', ''],
  ['bigint', 4n],
  ['symbol', Symbol('leaf')]
]) {
  test('deep literal matcher partition: ' + label, () => {
    const s = Symbol('key'),
      input = { a: { [s]: value }, b: { leaf: value } };
    assert.deepEqual(O.findPath(input, value), ['a', s]);
    assert.deepEqual(O.deepFindEntry(input, value), [['a', s], value]);
    assert.equal(O.deepFindKey(input, value), s);
    assert.deepEqual(O.deepFindAll(input, value), [value, value]);
    assert.equal(O.deepCount(input, value), 2);
    assert.ok(Object.is(O.deepFindLast(input, value), value));
  });
}

test('deepFindLast inspects forward preorder rather than invoking predicates in reverse', () => {
  const input = { a: { b: 1 }, c: 2 };
  const seen = [];
  const value = O.deepFindLast(input, (value, key) => {
    seen.push(key);
    return typeof value === 'number';
  });
  assert.deepEqual(seen, ['a', 'b', 'c']);
  assert.equal(value, 2);
});

test('deep visited container aliases count edges once, not leaves once per alias', () => {
  const shared = { x: 1 },
    root = { a: shared, b: shared };
  root.self = root;
  assert.equal(
    O.deepCount(root, () => true),
    4
  );
  assert.equal(O.deepCount(root, 1), 1);
  assert.deepEqual(
    O.deepFindEntry(root, (v) => v === shared),
    [['a'], shared]
  );
});

test('shouldDescend sees the parent context and a separate path snapshot', () => {
  const child = { n: 1 },
    input = { a: child, again: child, b: { m: 2 } };
  input.self = input;
  const visited = [],
    decisions = [];
  O.deepForEach(
    input,
    (_, key, parent, path) => {
      visited.push([...path]);
      path.length = 0;
    },
    {
      shouldDescend(value, key, parent, path) {
        assert.equal(this, parent);
        assert.equal(parent[key], value);
        decisions.push([...path]);
        path.push('corrupt');
        return key !== 'a';
      }
    }
  );
  assert.deepEqual(decisions, [['a'], ['again'], ['b']]);
  assert.deepEqual(visited, [['a'], ['again'], ['again', 'n'], ['b'], ['b', 'm'], ['self']]);
});

for (const name of ['deepForEach', ...transform]) {
  test(name + ' propagates shouldDescend exceptions without modifying the source', () => {
    const error = new Error('prune');
    const input = { a: { n: 1 } };
    const fn = name === 'deepMapKeys' ? (_, k) => k : name === 'deepMap' ? (v) => v : () => true;
    assert.throws(
      () =>
        O[name](input, fn, {
          shouldDescend() {
            throw error;
          }
        }),
      (thrown) => thrown === error
    );
    assert.deepEqual(input, { a: { n: 1 } });
  });
}

for (const name of transform) {
  test(name + ' reports cycle edges and preserves copied aliases, including symbol edges', () => {
    const symbol = Symbol('alias'),
      branch = { n: 1 },
      root = { a: branch, b: branch, [symbol]: branch };
    branch.parent = root;
    const output = O[name](root, name === 'deepMapKeys' ? (_, k) => k : name === 'deepMap' ? (v) => v : () => true);
    assert.notEqual(output, root);
    assert.notEqual(output.a, branch);
    assert.equal(output.a, output.b);
    assert.equal(output[symbol], output.a);
    assert.equal(output.a.parent, output);
    assert.equal(branch.parent, root);
  });
}

test('deepFilter deliberately prunes unmatched containers without reading their descendants', () => {
  let reads = 0;
  const root = {
    denied: {
      get secret() {
        reads++;
        throw new Error('unvisited');
      }
    },
    allowed: 7
  };
  assert.deepEqual(
    O.deepFilter(root, (_, key) => key !== 'denied'),
    { allowed: 7 }
  );
  assert.equal(reads, 0);
});

test('deepFilter with shared aliases uses the first expanded path, not a per-path redaction policy', () => {
  const shared = { secret: 1, public: 2 },
    root = { admin: shared, guest: shared };
  const output = O.deepFilter(root, (_, key, parent, path) => key !== 'secret' || path[0] === 'admin');
  assert.equal(output.admin, output.guest);
  assert.equal(output.guest.secret, 1);
  assert.notEqual(output.admin, shared);
});

test('deep transforms preserve unvisited branches by reference at depth/shouldDescend cutoffs', () => {
  for (const name of transform) {
    for (const options of [{ maxDepth: 1 }, { shouldDescend: () => false }]) {
      const child = { nested: 1 },
        root = { a: child };
      const callback = name === 'deepMapKeys' ? (_, k) => k : name === 'deepMap' ? (v) => v : () => true;
      const output = O[name](root, callback, options);
      assert.notEqual(output, root);
      assert.equal(output.a, child);
    }
  }
});

for (const name of changes) {
  test(name + ' handles no matches and respects immutable descriptors', () => {
    const root = { a: { n: 1 } };
    const expected = name.endsWith('All') ? [] : undefined;
    assert.deepEqual(invoke(name, root, 9), expected);
    assert.deepEqual(root, { a: { n: 1 } });
    Object.freeze(root.a);
    assert.throws(() => invoke(name, root, 1), TypeError);
    assert.equal(root.a.n, 1);
  });
  test(name + ' gives predicate callbacks stable paths and parent-bound context', () => {
    const root = { a: { n: 1 } };
    const seen = [];
    invoke(name, root, function (value, key, parent, path) {
      assert.equal(this, parent);
      assert.equal(parent[key], value);
      seen.push([...path]);
      path.push('unused');
      return typeof value === 'number';
    });
    assert.deepEqual(seen, [['a'], ['a', 'n']]);
    if (name.startsWith('deepRemove')) assert.equal(Object.hasOwn(root.a, 'n'), false);
    else assert.equal(root.a.n, 99);
  });
}

for (const name of ['deepRemoveAll', 'deepReplaceAll']) {
  test(name + ' does not descend into a matched container or a replacement graph', () => {
    let reads = 0;
    const child = {
      get secret() {
        reads++;
        throw new Error('must not read');
      }
    };
    const input = { a: child };
    const replacement = { n: 1 };
    const result =
      name === 'deepRemoveAll' ? O[name](input, (v) => v === child) : O[name](input, (v) => v === child, replacement);
    assert.deepEqual(result, [child]);
    assert.equal(reads, 0);
    if (name === 'deepReplaceAll') assert.equal(input.a, replacement);
    else assert.deepEqual(input, {});
  });
  test(name + ' leaves earlier successful changes in place after a later failure', () => {
    const input = { a: { n: 1 }, b: Object.freeze({ n: 1 }) };
    assert.throws(() => invoke(name, input, 1), TypeError);
    assert.equal(input.b.n, 1);
    assert.equal(
      name === 'deepRemoveAll' ? Object.hasOwn(input.a, 'n') : input.a.n,
      name === 'deepRemoveAll' ? false : 99
    );
  });
}

for (const name of ['deepReplace', 'deepReplaceLast', 'deepReplaceAll']) {
  test(name + ' replacement callbacks receive the captured value and an independent path', () => {
    let calls = 0;
    const input = { a: { n: 1 } };
    O[name](
      input,
      (value, key, parent, path) => {
        path.length = 0;
        return key === 'n';
      },
      function (value, key, parent, path) {
        calls++;
        assert.equal(value, 1);
        assert.equal(key, 'n');
        assert.equal(this, input.a);
        assert.equal(parent, input.a);
        assert.deepEqual(path, ['a', 'n']);
        return value + 1;
      }
    );
    assert.equal(calls, 1);
    assert.equal(input.a.n, 2);
  });
}

test('array-preserving key mapping ignores structural indices but visits extra properties', () => {
  const symbol = Symbol('extra'),
    input = new Array(4);
  input[2] = { a: 1 };
  input['01'] = 2;
  input[-1] = 3;
  input[symbol] = 4;
  const seen = [];
  const output = O.deepMapKeys(
    input,
    (_, key) => {
      seen.push(key);
      return key;
    },
    { arrays: 'preserve', onCollision: 'throw' }
  );
  assert.deepEqual(seen, ['a', '01', '-1', symbol]);
  assert.equal(output.length, 4);
  assert.equal(0 in output, false);
  assert.equal(output['01'], 2);
  assert.equal(output[-1], 3);
  assert.equal(output[symbol], 4);
  assert.notEqual(output[2], input[2]);
});

test('deep key collisions compare canonical names and stop before reading a later getter', () => {
  let reads = 0;
  const input = {
    a: {
      A: 1,
      a: 2,
      get later() {
        reads++;
        return 3;
      }
    }
  };
  assert.throws(() => O.deepMapKeys(input, (_, key) => key.toLowerCase(), { onCollision: 'throw' }), TypeError);
  assert.equal(reads, 0);
  assert.equal(input.a.A, 1);
  assert.equal(input.a.a, 2);
});
