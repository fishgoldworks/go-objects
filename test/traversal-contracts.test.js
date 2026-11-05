'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const O = require('..');

const queries = [
  'deepForEach',
  'deepFind',
  'deepFindLast',
  'deepFindAll',
  'deepFindKey',
  'deepFindEntry',
  'deepCount',
  'findPath'
];
const firstQueries = ['deepFind', 'deepFindKey', 'deepFindEntry', 'findPath'];
const variants = {
  'null-prototype callable': (fn) => Object.setPrototypeOf(fn, null),
  'substituted call member': (fn) => Object.assign(fn, { call: () => false }),
  'throwing call accessor': (fn) =>
    Object.defineProperty(fn, 'call', {
      get() {
        throw new Error('unrelated call property was read');
      }
    }),
  'callable Proxy with no metadata access': (fn) =>
    new Proxy(fn, {
      get() {
        throw new Error('unrelated function metadata was read');
      },
      apply(target, receiver, args) {
        return Reflect.apply(target, receiver, args);
      }
    })
};
function expected(name, input, hit, path, count = 1) {
  if (name === 'deepForEach') return input;
  if (name === 'deepCount') return count;
  if (name === 'deepFindAll') return Array(count).fill(hit);
  if (name === 'deepFindKey') return path[path.length - 1];
  if (name === 'findPath') return path;
  if (name === 'deepFindEntry') return [path, hit];
  return hit;
}
function checkQuery(name, decorate) {
  const input = { branch: { hit: 1 }, tail: 1 };
  const paths = [];
  const callback = decorate(function (value, key, parent, path) {
    assert.equal(this, parent);
    assert.equal(arguments.length, 4);
    assert.equal(parent[key], value);
    paths.push(path);
    return value === 1;
  });
  const result = O[name](input, callback);
  assert.deepEqual(result, expected(name, input, 1, ['branch', 'hit'], 2));
  const seen = [['branch'], ['branch', 'hit']];
  if (!firstQueries.includes(name)) seen.push(['tail']);
  assert.deepEqual(paths, seen);
  assert.equal(new Set(paths).size, paths.length);
  assert.deepEqual(input, { branch: { hit: 1 }, tail: 1 });
}
function checkDescent(name, decorate) {
  const input = { blocked: { hit: 1 }, allowed: { hit: 2 } };
  const decisions = [];
  const shouldDescend = decorate(function (value, key, parent, path) {
    assert.equal(this, parent);
    assert.equal(arguments.length, 4);
    assert.equal(parent[key], value);
    decisions.push([...path]);
    path[0] = 'caller-local-edit';
    return key === 'allowed';
  });
  const visited = [];
  const callback = (value, key, parent, path) => {
    visited.push(path);
    return value === 2;
  };
  const result = O[name](input, callback, { shouldDescend });
  assert.deepEqual(result, expected(name, input, 2, ['allowed', 'hit']));
  assert.deepEqual(decisions, [['blocked'], ['allowed']]);
  assert.deepEqual(visited, [['blocked'], ['allowed'], ['allowed', 'hit']]);
}
for (const name of queries) {
  test(`${name}: ordinary callable retains receiver, arguments, order and return contract`, () => {
    checkQuery(name, (fn) => fn);
  });
  for (const [label, decorate] of Object.entries(variants)) {
    test(`${name}: invokes the ${label} itself`, () => checkQuery(name, decorate));
  }
  test(`${name}: descent invokes the supplied callable for every supported callback shape`, () => {
    checkDescent(name, (fn) => fn);
    for (const decorate of Object.values(variants)) checkDescent(name, decorate);
  });
}

// Integration checks exercise the two shared helpers through their consumers.
for (const name of ['deepMap', 'deepMapKeys', 'deepFilter']) {
  test(`${name}: shared descent dispatch accepts a callable that rejects metadata reads`, () => {
    const input = { branch: { n: 1 } };
    let calls = 0;
    const shouldDescend = variants['callable Proxy with no metadata access'](function (value, key, parent, path) {
      calls++;
      assert.equal(this, input);
      assert.equal(parent, input);
      assert.equal(value, input.branch);
      assert.equal(key, 'branch');
      assert.deepEqual(path, ['branch']);
      return true;
    });
    const callback =
      name === 'deepMapKeys' ? (value, key) => key : name === 'deepFilter' ? () => true : (value) => value;
    const output = O[name](input, callback, { shouldDescend });
    assert.deepEqual(output, input);
    assert.notEqual(output.branch, input.branch);
    assert.equal(calls, 1);
  });
}
const mutations = ['deepRemove', 'deepRemoveLast', 'deepRemoveAll', 'deepReplace', 'deepReplaceLast', 'deepReplaceAll'];
for (const name of mutations) {
  test(`${name}: shared predicate and descent dispatch preserve nested mutation results`, () => {
    const input = { branch: { n: 1 } };
    const seen = [];
    const decorate = variants['callable Proxy with no metadata access'];
    const predicate = decorate(function (value, key, parent, path) {
      assert.equal(this, parent);
      assert.equal(arguments.length, 4);
      seen.push(path);
      return value === 1;
    });
    const shouldDescend = decorate(function (value, key, parent, path) {
      assert.equal(this, input);
      assert.equal(parent, input);
      assert.deepEqual(path, ['branch']);
      return true;
    });
    const result = name.startsWith('deepReplace')
      ? O[name](input, predicate, 7, { shouldDescend })
      : O[name](input, predicate, { shouldDescend });
    assert.deepEqual(result, name.endsWith('All') ? [1] : 1);
    assert.deepEqual(input, name.startsWith('deepReplace') ? { branch: { n: 7 } } : { branch: {} });
    assert.deepEqual(seen, [['branch'], ['branch', 'n']]);
  });
}
for (const name of mutations.filter((method) => method.startsWith('deepReplace'))) {
  test(`${name}: shared replacement callback receives an independent observed-entry path`, () => {
    const input = { branch: { n: 1 } };
    const replacement = variants['throwing call accessor'](function (value, key, parent, path) {
      assert.equal(this, input.branch);
      assert.equal(parent, input.branch);
      assert.equal(arguments.length, 4);
      assert.equal(value, 1);
      assert.equal(key, 'n');
      assert.deepEqual(path, ['branch', 'n']);
      path.length = 0;
      return 8;
    });
    assert.deepEqual(O[name](input, 1, replacement), name.endsWith('All') ? [1] : 1);
    assert.deepEqual(input, { branch: { n: 8 } });
  });
}

test('bound query and descent callbacks keep bound receivers and leading arguments', () => {
  const input = { branch: { n: 4 } };
  const context = { min: 3 };
  const predicate = function (tag, value, key, parent, path) {
    assert.equal(this, context);
    assert.equal(tag, 'query');
    assert.equal(arguments.length, 5);
    assert.equal(parent[key], value);
    assert.ok(Array.isArray(path));
    return typeof value === 'number' && value > this.min;
  }.bind(context, 'query');
  const shouldDescend = function (tag, value, key, parent, path) {
    assert.equal(this, context);
    assert.equal(tag, 'descent');
    assert.equal(arguments.length, 5);
    assert.equal(value, input.branch);
    assert.equal(parent, input);
    assert.deepEqual(path, ['branch']);
    return true;
  }.bind(context, 'descent');
  assert.deepEqual(O.deepFindEntry(input, predicate, { shouldDescend }), [['branch', 'n'], 4]);
});

test('callable Proxy apply errors preserve identity and stop before later getters', () => {
  const error = new Error('actual callable failure');
  let reads = 0;
  const input = {
    first: 1,
    get later() {
      reads++;
      return 2;
    }
  };
  const predicate = new Proxy(() => false, {
    apply() {
      throw error;
    }
  });
  assert.throws(
    () => O.deepFindAll(input, predicate),
    (caught) => caught === error
  );
  assert.equal(reads, 0);
});

test('descent errors propagate after the container edge but before reading its children', () => {
  const error = new Error('actual descent failure');
  const seen = [];
  let reads = 0;
  const input = {
    branch: {
      get n() {
        reads++;
        return 1;
      }
    }
  };
  const shouldDescend = variants['null-prototype callable'](() => {
    throw error;
  });
  assert.throws(
    () => O.deepForEach(input, (value, key) => seen.push(key), { shouldDescend }),
    (caught) => caught === error
  );
  assert.deepEqual(seen, ['branch']);
  assert.equal(reads, 0);
});

test('query, visitor and descent results stay synchronous without reading then', () => {
  let thenReads = 0;
  const thenable = Object.defineProperty({}, 'then', {
    get() {
      thenReads++;
      throw new Error('then read');
    }
  });
  const input = { branch: { n: 1 } };
  assert.equal(
    O.deepCount(input, () => thenable, { shouldDescend: () => thenable }),
    2
  );
  assert.equal(
    O.deepForEach(input, () => thenable, { shouldDescend: () => thenable }),
    input
  );
  assert.equal(thenReads, 0);
});

for (const name of firstQueries) {
  test(`${name}: a container match stops before descent and child or later getters`, () => {
    let reads = 0,
      descents = 0;
    const branch = {
      get child() {
        reads++;
        return 1;
      }
    };
    const input = {
      branch,
      get later() {
        reads++;
        return 2;
      }
    };
    const shouldDescend = () => {
      descents++;
      return true;
    };
    assert.deepEqual(O[name](input, branch, { shouldDescend }), expected(name, input, branch, ['branch']));
    assert.equal(reads, 0);
    assert.equal(descents, 0);
  });
}

test('a depth-cutoff alias can be expanded later through a shallower route', () => {
  const shared = { n: 1 };
  const input = { long: { alias: shared }, short: shared };
  const decisions = [];
  const paths = [];
  O.deepForEach(input, (value, key, parent, path) => paths.push(path), {
    maxDepth: 2,
    shouldDescend(value, key, parent, path) {
      decisions.push(path);
      return true;
    }
  });
  assert.deepEqual(paths, [['long'], ['long', 'alias'], ['short'], ['short', 'n']]);
  assert.deepEqual(decisions, [['long'], ['short']]);
});

test('depth-zero queries validate options without enumerating a root Proxy', () => {
  const input = new Proxy(
    {},
    {
      ownKeys() {
        throw new Error('root keys should not be inspected');
      },
      get() {
        throw new Error('root values should not be read');
      }
    }
  );
  assert.equal(O.deepCount(input, 1, { maxDepth: 0 }), 0);
  assert.equal(
    O.deepForEach(
      input,
      () => {
        throw new Error('visitor');
      },
      { maxDepth: 0 }
    ),
    input
  );
  assert.throws(() => O.deepCount(input, 1, { maxDepth: 0, unexpected: true }), TypeError);
});

test('traversal captures option getter values once before input access', () => {
  const events = [];
  const options = {
    get maxDepth() {
      events.push('depth');
      return 2;
    },
    get shouldDescend() {
      events.push('option');
      return () => {
        events.push('descend');
        return true;
      };
    }
  };
  const input = {
    get branch() {
      events.push('read');
      return { n: 1 };
    }
  };
  assert.equal(O.deepCount(input, 1, options), 1);
  assert.deepEqual(events, ['depth', 'option', 'read', 'descend']);
});

test('descent callbacks and input reads cannot alter the captured options', () => {
  const options = { maxDepth: 3, shouldDescend: () => true };
  const input = {
    get branch() {
      options.maxDepth = 0;
      options.shouldDescend = () => false;
      return { n: 1 };
    }
  };
  assert.deepEqual(O.findPath(input, 1, options), ['branch', 'n']);
});

test('child key snapshots are taken on expansion, not at root entry', () => {
  const input = { branch: { n: 1 } };
  const seen = [];
  O.deepForEach(input, (value, key, parent, path) => {
    seen.push(path);
    if (key === 'branch') {
      input.newRoot = 3;
      value.extra = 2;
    }
  });
  assert.deepEqual(seen, [['branch'], ['branch', 'n'], ['branch', 'extra']]);
});

test('reentrant walks use independent expansion state and independent returned paths', () => {
  const shared = { leaf: 1 };
  const input = { first: shared, again: shared };
  input.self = input;
  const paths = [],
    nested = [];
  O.deepForEach(input, (value, key, parent, path) => {
    paths.push(path);
    if (key === 'first') nested.push(O.deepFindEntry(input, 1));
  });
  assert.deepEqual(paths, [['first'], ['first', 'leaf'], ['again'], ['self']]);
  assert.deepEqual(nested, [[['first', 'leaf'], 1]]);
  nested[0][0].push('local');
  assert.deepEqual(paths[1], ['first', 'leaf']);
});

test('custom root own properties are visited while matching nested instances remain leaves', () => {
  class Box {
    constructor() {
      this.child = { n: 1 };
    }
  }
  const input = new Box();
  assert.deepEqual(O.findPath(input, 1), ['child', 'n']);
  let decisions = 0;
  assert.equal(
    O.deepCount({ input }, 1, {
      shouldDescend() {
        decisions++;
        return true;
      }
    }),
    0
  );
  assert.equal(decisions, 0);
});

test('mixed cross-realm/null-prototype arrays and records retain original parents in query callbacks', () => {
  const foreign = vm.runInNewContext('({ row: [, { n: 1 }] })');
  const input = Object.assign(Object.create(null), { foreign });
  const symbol = Symbol('leaf');
  foreign.row[1][symbol] = 2;
  const paths = [];
  O.deepForEach(input, function (value, key, parent, path) {
    assert.equal(this, parent);
    assert.equal(parent[key], value);
    paths.push(path);
  });
  assert.deepEqual(paths, [
    ['foreign'],
    ['foreign', 'row'],
    ['foreign', 'row', '1'],
    ['foreign', 'row', '1', 'n'],
    ['foreign', 'row', '1', symbol]
  ]);
  assert.deepEqual(O.deepFindEntry(input, 2), [['foreign', 'row', '1', symbol], 2]);
});

test('a literal identity match does not coerce or await an opaque value', () => {
  class Leaf {}
  const leaf = new Leaf();
  Object.defineProperty(leaf, Symbol.toPrimitive, {
    get() {
      throw new Error('coerced');
    }
  });
  Object.defineProperty(leaf, 'then', {
    get() {
      throw new Error('awaited');
    }
  });
  const input = { one: { leaf }, two: leaf };
  assert.equal(O.deepCount(input, leaf), 2);
  assert.equal(O.deepFind(input, leaf), leaf);
  assert.deepEqual(O.findPath(input, leaf), ['one', 'leaf']);
});
