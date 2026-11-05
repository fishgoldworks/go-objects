'use strict';
// Reproducible generated cases complement (not replace) the boundary fixtures.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const O = require('..');
const SEEDS = [1, 0x12345678, 0xdeadbeef, 0xffffffff];
const CASES = 75;
const rng = (seed) => {
  let state = seed >>> 0;
  return (n) => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) % n;
};
const same = (a, b) => a === b || (Number.isNaN(a) && Number.isNaN(b));
const ownEntries = (obj) =>
  Reflect.ownKeys(obj)
    .filter((k) => Object.getOwnPropertyDescriptor(obj, k).enumerable)
    .map((k) => [k, obj[k]]);
function tree(random, depth = 0) {
  if (depth === 4 || (depth && random(4) === 0))
    return [null, undefined, false, NaN, -0, random(20), 'v' + random(4)][random(7)];
  const array = random(3) === 0,
    count = 1 + random(4),
    result = array ? new Array(count) : {};
  for (let i = 0; i < count; i++) {
    if (array && random(5) === 0) continue;
    const key = array ? String(i) : 'key_' + i;
    Object.defineProperty(result, key, {
      value: tree(random, depth + 1),
      enumerable: true,
      writable: true,
      configurable: true
    });
  }
  return result;
}
function referenceWalk(root, maxDepth = Infinity) {
  const results = [],
    seen = new Set([root]);
  function visit(node, prefix) {
    if (prefix.length === maxDepth) return;
    for (const [key, value] of ownEntries(node)) {
      const path = [...prefix, key];
      results.push({ path, value });
      if (value && typeof value === 'object' && !seen.has(value)) {
        seen.add(value);
        visit(value, path);
      }
    }
  }
  visit(root, []);
  return results;
}
function deepFreeze(root) {
  if (root && typeof root === 'object') {
    for (const [, v] of ownEntries(root)) deepFreeze(v);
    Object.freeze(root);
  }
  return root;
}

for (const seed of SEEDS) {
  test(`generated collection model: seed=${seed}, ${CASES} records`, () => {
    const random = rng(seed);
    for (let i = 0; i < CASES; i++) {
      const symbol = Symbol('field'),
        input = {};
      for (const key of ['0', 'alpha', '__proto__', 'constructor', '', symbol]) {
        if (random(4) === 0) continue;
        Object.defineProperty(input, key, {
          value: [undefined, NaN, -0, 0, 1, 2, false, ''][random(8)],
          enumerable: true,
          configurable: true,
          writable: true
        });
      }
      const entries = ownEntries(input),
        match = [undefined, NaN, 0, 1, 2, false, ''][random(7)];
      const matches = entries.filter(([, value]) => same(value, match));
      assert.deepEqual(
        O.findAll(input, match),
        matches.map(([, value]) => value)
      );
      assert.deepEqual(O.findEntry(input, match), matches[0]);
      assert.equal(O.count(input, match), matches.length);
      assert.equal(O.some(input, match), matches.length > 0);
      assert.equal(O.every(input, match), matches.length === entries.length);
      const selected = entries.filter(() => random(2)).map(([key]) => key);
      assert.deepEqual(O.pick(input, selected), Object.fromEntries(entries.filter(([key]) => selected.includes(key))));
      assert.deepEqual(O.omit(input, selected), Object.fromEntries(entries.filter(([key]) => !selected.includes(key))));
      const copy = Object.fromEntries(entries);
      const removed = O.removeAll(copy, match);
      assert.deepEqual(
        removed,
        matches.map(([, value]) => value)
      );
      assert.deepEqual(copy, Object.fromEntries(entries.filter(([, value]) => !same(value, match))));
      assert.deepEqual(ownEntries(input), entries);
    }
  });

  test(`generated deep reference model: seed=${seed}, ${CASES} trees`, () => {
    const random = rng(seed);
    for (let i = 0; i < CASES; i++) {
      const input = tree(random),
        depth = random(6),
        expected = referenceWalk(input, depth),
        seen = [];
      O.deepForEach(input, (value, key, parent, path) => seen.push({ path, value }), { maxDepth: depth });
      assert.deepEqual(seen, expected);
      const matches = expected.filter(({ value }) => typeof value === 'number');
      assert.equal(
        O.deepCount(input, (v) => typeof v === 'number', { maxDepth: depth }),
        matches.length
      );
      assert.deepEqual(
        O.deepFindAll(input, (v) => typeof v === 'number', { maxDepth: depth }),
        matches.map((entry) => entry.value)
      );
      assert.deepEqual(
        O.deepFindEntry(input, (v) => typeof v === 'number', { maxDepth: depth }),
        matches.length ? [matches[0].path, matches[0].value] : undefined
      );
      for (const entry of expected) {
        assert.equal(O.has(input, entry.path), true);
        assert.ok(Object.is(O.get(input, entry.path), entry.value));
      }
    }
  });

  test(`generated immutable spine invariants: seed=${seed}, ${CASES} trees`, () => {
    const random = rng(seed);
    for (let i = 0; i < CASES; i++) {
      const source = tree(random),
        leaves = referenceWalk(source).filter(({ value }) => value === null || typeof value !== 'object');
      if (!leaves.length) {
        source.leaf = 1;
        leaves.push({ path: ['leaf'], value: 1 });
      }
      const { path } = leaves[random(leaves.length)];
      const expected = structuredClone(source),
        replacement = 'replacement:' + i;
      let target = expected;
      for (const key of path.slice(0, -1)) target = target[key];
      target[path.at(-1)] = replacement;
      const baseline = structuredClone(source);
      deepFreeze(source);
      const result = O.setImmutable(source, path, replacement);
      assert.deepEqual(result, expected);
      assert.deepEqual(source, baseline);
      let originalNode = source,
        nextNode = result;
      for (let p = 0; p < path.length; p++) {
        assert.notEqual(originalNode, nextNode);
        for (const key of Reflect.ownKeys(originalNode))
          if (key !== path[p]) assert.equal(nextNode[key], originalNode[key]);
        originalNode = originalNode[path[p]];
        nextNode = nextNode[path[p]];
      }
      assert.equal(O.setImmutable(result, path, replacement), result);
      const removed = O.unsetImmutable(result, path);
      assert.equal(O.has(removed, path), false);
      assert.equal(O.has(result, path), true);
    }
  });

  test(`generated cyclic graph clone model: seed=${seed}, ${CASES} graphs`, () => {
    const random = rng(seed);
    for (let i = 0; i < CASES; i++) {
      const nodes = Array.from({ length: 2 + random(8) }, (_, id) => ({ id }));
      for (const node of nodes) {
        node.next = nodes[random(nodes.length)];
        node.other = nodes[random(nodes.length)];
      }
      const root = { nodes, map: new Map(nodes.map((node) => [node, node.next])), set: new Set(nodes) };
      root.self = root;
      const expected = structuredClone(root),
        copy = O.deepClone(root);
      assert.deepEqual(copy, expected);
      assert.equal(copy.self, copy);
      assert.notEqual(copy.nodes, nodes);
      for (let j = 0; j < nodes.length; j++) {
        const original = nodes[j],
          cloned = copy.nodes[j];
        assert.notEqual(cloned, original);
        assert.equal(cloned.next, copy.nodes[original.next.id]);
        assert.equal(cloned.other, copy.nodes[original.other.id]);
        assert.equal(copy.map.get(cloned), cloned.next);
        assert.equal(copy.set.has(cloned), true);
        assert.equal(copy.set.has(original), false);
      }
    }
  });

  test(`generated key collision model: seed=${seed}, ${CASES} records`, () => {
    const random = rng(seed);
    for (let i = 0; i < CASES; i++) {
      const entries = Array.from({ length: random(12) }, (_, j) => ['k' + j, random(100)]);
      const input = Object.fromEntries(entries);
      const labels = new Map(entries.map(([key]) => [key, 'group' + random(5)]));
      const mapped = entries.map(([key, value]) => [labels.get(key), value]);
      assert.deepEqual(
        O.mapKeys(input, (_, key) => labels.get(key)),
        Object.fromEntries(mapped)
      );
      const collision = new Set(mapped.map(([key]) => key)).size !== mapped.length;
      if (collision)
        assert.throws(() => O.mapKeys(input, (_, key) => labels.get(key), { onCollision: 'throw' }), TypeError);
      else
        assert.deepEqual(
          O.mapKeys(input, (_, key) => labels.get(key), { onCollision: 'throw' }),
          Object.fromEntries(mapped)
        );
      assert.deepEqual(ownEntries(input), entries);
    }
  });
}
