'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseArguments } = require('./test-runtime');
test('an explicit missing tarball fails rather than packing a different revision', () =>
  assert.throws(() => parseArguments(['--tarball', __filename + '.missing'])));
test('runtime option values and unknown arguments fail clearly', () => {
  assert.throws(() => parseArguments(['--node']));
  assert.throws(() => parseArguments(['--tarball', '--esm']));
  assert.throws(() => parseArguments(['--unknown']));
});
