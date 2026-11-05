'use strict';
// Deterministic, real API workloads. Mutating cases reuse a stable shape;
// allocating cases intentionally include output allocation and natural GC.
const record = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => ['k' + i, i]));
const chain = (n) => {
  const root = {};
  let node = root;
  for (let i = 0; i < n; i++) node = node.next = {};
  node.value = 42;
  return root;
};
const tree = () =>
  Object.fromEntries(
    Array.from({ length: 20 }, (_, i) => [
      'g' + i,
      Object.fromEntries(Array.from({ length: 20 }, (_, j) => ['r' + j, { x: j, y: i }]))
    ])
  );
module.exports = [
  [
    'get/simple-string',
    (O) => {
      const input = { id: 7 };
      return () => O.get(input, 'id');
    }
  ],
  [
    'get/repeated-dot-path',
    (O) => {
      const input = { user: { profile: { name: 'Michael' } } };
      return () => O.get(input, 'user.profile.name');
    }
  ],
  [
    'get/repeated-bracket-path',
    (O) => {
      const input = { user: { 'profile.name': [{ value: 7 }] } };
      return () => O.get(input, 'user["profile.name"][0].value');
    }
  ],
  [
    'get/segment-array',
    (O) => {
      const input = { user: { profile: { name: 'Michael' } } },
        p = ['user', 'profile', 'name'];
      return () => O.get(input, p);
    }
  ],
  [
    'get/4096-rotating-paths',
    (O) => {
      const input = { rows: record(4096) },
        paths = Array.from({ length: 4096 }, (_, i) => 'rows.k' + i);
      let i = 0;
      return () => O.get(input, paths[i++ & 4095]);
    }
  ],
  [
    'get/long-uncached-path',
    (O) => {
      const key = 'k'.repeat(300),
        input = { [key]: { value: 7 } },
        p = key + '.value';
      return () => O.get(input, p);
    }
  ],
  [
    'has/repeated-path',
    (O) => {
      const input = { user: { profile: { name: undefined } } };
      return () => O.has(input, 'user.profile.name');
    }
  ],
  [
    'getEach/10-repeated-paths',
    (O) => {
      const input = { rows: record(10) },
        paths = Array.from({ length: 10 }, (_, i) => 'rows.k' + i);
      return () => O.getEach(input, paths);
    }
  ],
  [
    'set/existing-path',
    (O) => {
      const input = { user: { profile: { name: 'Michael' } } };
      return () => O.set(input, 'user.profile.name', 'Michael');
    }
  ],
  [
    'update/existing-path',
    (O) => {
      const input = { counts: { n: 1 } };
      return () => O.update(input, 'counts.n', (n) => (n === 1 ? 2 : 1));
    }
  ],
  [
    'immutable/changed-path',
    (O) => {
      const input = { user: { profile: { name: 'Michael', more: record(10) }, status: 'active' }, other: record(100) };
      return () => O.setImmutable(input, 'user.profile.name', 'New');
    }
  ],
  [
    'immutable/no-op-path',
    (O) => {
      const input = { user: { profile: { name: 'Michael' } }, other: record(100) };
      return () => O.setImmutable(input, 'user.profile.name', 'Michael');
    }
  ],
  [
    'keys/4-properties',
    (O) => {
      const input = record(4);
      return () => O.keys(input);
    }
  ],
  [
    'keys/1000-properties',
    (O) => {
      const input = record(1000);
      return () => O.keys(input);
    }
  ],
  [
    'keys/1000-properties-20-symbols',
    (O) => {
      const input = record(1000);
      for (let i = 0; i < 20; i++) Object.defineProperty(input, Symbol('s' + i), { value: i, enumerable: i % 2 === 0 });
      return () => O.keys(input);
    }
  ],
  [
    'map/1000-properties',
    (O) => {
      const input = record(1000);
      return () => O.map(input, (n) => n * 2);
    }
  ],
  [
    'filter/1000-properties',
    (O) => {
      const input = record(1000);
      return () => O.filter(input, (n) => n % 2 === 0);
    }
  ],
  [
    'merge/1000-overlapping-properties',
    (O) => {
      const input = record(1000),
        other = record(1000);
      return () => O.merge(input, other);
    }
  ],
  [
    'count/1000-literal-matches',
    (O) => {
      const input = record(1000);
      return () => O.count(input, 42);
    }
  ],
  [
    'some/1000-properties-no-match',
    (O) => {
      const input = record(1000);
      return () => O.some(input, -1);
    }
  ],
  [
    'findEntry/first-of-1000',
    (O) => {
      const input = record(1000);
      return () => O.findEntry(input, 0);
    }
  ],
  [
    'intersect/1000-properties',
    (O) => {
      const input = record(1000),
        other = record(1000);
      return () => O.intersect(input, other);
    }
  ],
  [
    'deepFind/1000-depth-literal',
    (O) => {
      const input = chain(1000);
      return () => O.deepFind(input, 42);
    }
  ],
  [
    'deepFind/1000-depth-predicate',
    (O) => {
      const input = chain(1000);
      return () => O.deepFind(input, (v) => v === 42);
    }
  ],
  [
    'deepCount/tree-literal',
    (O) => {
      const input = tree();
      return () => O.deepCount(input, 7);
    }
  ],
  [
    'deepRemoveAll/1000-depth-no-match',
    (O) => {
      const input = chain(1000);
      return () => O.deepRemoveAll(input, -1);
    }
  ],
  [
    'deepMap/tree-identity',
    (O) => {
      const input = tree();
      return () => O.deepMap(input, (v) => v);
    }
  ],
  [
    'deepMapKeys/preserve-300-rows',
    (O) => {
      const input = Array.from({ length: 300 }, (_, i) => ({ first_name: 'Michael', id: i }));
      return () => O.deepMapKeys(input, (_, key) => (key === 'first_name' ? 'firstName' : key), { arrays: 'preserve' });
    }
  ],
  [
    'clone/native-Error',
    (O) => {
      const input = new Error('failure', { cause: { code: 1 } });
      void input.stack;
      return () => O.clone(input);
    }
  ],
  [
    'deepClone/12-Error-causes',
    (O) => {
      let input = { code: 1 };
      for (let i = 0; i < 12; i++) {
        input = new Error('cause ' + i, { cause: input });
        void input.stack;
      }
      return () => O.deepClone(input);
    }
  ],
  [
    'deepClone/100-native-Errors',
    (O) => {
      const input = Array.from({ length: 100 }, (_, i) => {
        const error = new TypeError('failure ' + i, { cause: { code: i } });
        void error.stack;
        return error;
      });
      return () => O.deepClone(input);
    }
  ],
  ['clone/number', (O) => () => O.clone(42)],
  [
    'clone/1000-properties',
    (O) => {
      const input = record(1000);
      return () => O.clone(input);
    }
  ],
  [
    'deepClone/2000-child-records',
    (O) => {
      const input = Object.fromEntries(Array.from({ length: 2000 }, (_, i) => ['k' + i, { n: i }]));
      return () => O.deepClone(input);
    }
  ],
  [
    'deepClone/2000-shared-references',
    (O) => {
      const shared = { x: 1 },
        input = Object.fromEntries(Array.from({ length: 2000 }, (_, i) => ['k' + i, shared]));
      input.self = input;
      return () => O.deepClone(input);
    }
  ],
  [
    'deepClone/2000-depth',
    (O) => {
      const input = chain(2000);
      return () => O.deepClone(input);
    }
  ],
  [
    'deepClone/500-arrays',
    (O) => {
      const input = Array.from({ length: 500 }, (_, i) => [i, i + 1]);
      return () => O.deepClone(input);
    }
  ],
  [
    'deepClone/500-native-objects',
    (O) => {
      const input = Array.from({ length: 500 }, (_, i) => ({ date: new Date(i), map: new Map([[i, i]]) }));
      return () => O.deepClone(input);
    }
  ],
  [
    'deepClone/16KiB-view',
    (O) => {
      const input = new Uint8Array(16384).fill(7);
      return () => O.deepClone(input);
    }
  ],
  [
    'wrapper/construct-only',
    (O) => {
      const input = { user: { profile: { name: 'Michael' } } };
      return () => O(input);
    }
  ],
  [
    'wrapper/reused-get-path',
    (O) => {
      const wrapped = O({ user: { profile: { name: 'Michael' } } });
      return () => wrapped.get('user.profile.name').unwrap();
    }
  ],
  [
    'wrapper/get-path',
    (O) => {
      const input = { user: { profile: { name: 'Michael' } } };
      return () => O(input).get('user.profile.name').unwrap();
    }
  ]
];
