'use strict';
// Isolated coarse heap-retention check, not a timing/GC-allocation benchmark.
const assert = require('node:assert/strict');
const path = require('node:path');
const O = require(path.resolve(process.argv[2]) + path.sep);
const method = process.argv[3];
assert.ok(['get', 'has', 'getEach', 'control'].includes(method));
assert.equal(typeof global.gc, 'function', 'Run this fixture with --expose-gc');
const names = Array.from(
  { length: 32 },
  (_, i) => String.fromCharCode(0x100 + i) + 'retention_node.long_unvisited_property_name'
);
function lookup(key) {
  if (method === 'get') assert.equal(O.get({}, key), undefined);
  else if (method === 'has') assert.equal(O.has({}, key), false);
  else if (method === 'getEach') assert.deepEqual(O.getEach({}, [key]), [undefined]);
}
function heap() {
  for (let i = 0; i < 4; i++) global.gc();
  return process.memoryUsage().heapUsed;
}
function churn() {
  for (const name of names) {
    // A short slice of a two-byte, approximately 2 MiB source string. The
    // source and slice exist only in this frame; the library must not keep it.
    const source = ' ' + name + '.'.repeat(1024 * 1024);
    lookup(source.slice(1, name.length + 1));
  }
}
for (let i = 0; i < 200; i++) lookup('warm.up');
const before = heap();
churn();
setImmediate(() => {
  const after = heap();
  console.log(JSON.stringify({ method, before, after, retainedBytes: after - before, sourceCount: names.length }));
});
