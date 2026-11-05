'use strict';
const { performance } = require('node:perf_hooks');
const O = require('..');
function benchmark(name, makeInput, fn, repeat = 15) {
  const input = makeInput();
  for (let i = 0; i < 5; i++) fn(input);
  const samples = [];
  for (let i = 0; i < repeat; i++) {
    const start = performance.now();
    fn(input);
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  console.log(name.padEnd(36), samples[Math.floor(samples.length / 2)].toFixed(3) + ' ms median');
}
console.log('Node ' + process.version + '; medians after five warm-up runs. No cross-library performance claim.');
for (const size of [2000, 8000, 16000])
  benchmark(
    'deepClone: ' + size + ' child records',
    () => Object.fromEntries(Array.from({ length: size }, (_, i) => ['k' + i, { n: i }])),
    O.deepClone
  );
benchmark(
  'deepClone: shared graph and cycles',
  () => {
    const shared = { x: 1 },
      value = {};
    for (let i = 0; i < 10000; i++) value['k' + i] = shared;
    value.self = value;
    return value;
  },
  O.deepClone
);
benchmark(
  'deepClone: 20,000-level chain',
  () => {
    const root = {};
    let node = root;
    for (let i = 0; i < 20000; i++) node = node.next = {};
    return root;
  },
  O.deepClone
);
benchmark(
  'map: 10,000 own properties',
  () => Object.fromEntries(Array.from({ length: 10000 }, (_, i) => ['k' + i, i])),
  (value) => O.map(value, (n) => n * 2)
);
benchmark(
  'get: 10,000 path lookups',
  () => ({ user: { profile: { name: 'Michael' } } }),
  (value) => {
    for (let i = 0; i < 10000; i++) O.get(value, 'user.profile.name');
  }
);
