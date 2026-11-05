'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { summariseTestRun, compareMutation } = require('./test-mutations');

// These are actual Node worker outcomes, not fabricated success/failure objects.
function withRun(source, check, options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'go-objects-mutation-runner-'));
  const file = path.join(directory, 'contract.test.cjs');
  try {
    fs.writeFileSync(file, "const { test } = require('node:test');\n" + source);
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', file], {
      encoding: 'utf8',
      env,
      timeout: 5000,
      ...options
    });
    return check(result);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
const good = "test('contract', () => require('node:assert/strict').equal(1, 1));";
const bad = "test('contract', () => require('node:assert/strict').equal(1, 2));";
const baseline = () => withRun(good, (result) => summariseTestRun(result, 'baseline'));

test('mutation accounting accepts a complete green baseline and surviving mutation', () => {
  const expected = baseline();
  withRun(good, (result) =>
    assert.deepEqual(compareMutation(result, expected, 'control'), {
      detected: false,
      failingTests: []
    })
  );
});
test('mutation accounting detects a genuine assertion failure in the expected test', () => {
  const expected = baseline();
  withRun(bad, (result) =>
    assert.deepEqual(compareMutation(result, expected, 'assertion'), {
      detected: true,
      failingTests: ['contract']
    })
  );
});
test('mutation accounting detects a runtime exception reached inside the expected test', () => {
  const expected = baseline();
  withRun("test('contract', () => { throw new TypeError('broken return value'); });", (result) =>
    assert.equal(compareMutation(result, expected, 'runtime').detected, true)
  );
});
for (const [name, source] of [
  ['module loading failure', "require('./does-not-exist');"],
  ['nonzero worker exit', 'process.exit(1);'],
  ['successful worker exit before tests', 'process.exit(0);'],
  ['empty replacement fixture', 'void 0;'],
  ['unrelated failing test', "test('different contract', () => { throw Error('unrelated'); });"],
  ['skipped test', "test('contract', {skip: true}, () => {});"],
  ['todo test', "test('contract', {todo: true}, () => {});"],
  ['unfinished asynchronous test', "test('contract', () => new Promise(() => {}));"],
  ['test timeout', "test('contract', {timeout: 50}, () => new Promise((resolve) => setTimeout(resolve, 150)));"]
]) {
  test('mutation accounting rejects ' + name + ' rather than reporting detection or survival', () => {
    const expected = baseline();
    withRun(source, (result) =>
      assert.throws(
        () => compareMutation(result, expected, name),
        /incomplete|changed|execute|summary|cancelled|skipped|todo|timeout/i
      )
    );
  });
}
test('mutation accounting rejects subprocess timeout', () => {
  const expected = baseline();
  withRun(
    'setInterval(() => {}, 1000);',
    (result) => {
      assert.equal(result.error.code, 'ETIMEDOUT');
      assert.throws(() => compareMutation(result, expected, 'timeout'), /execute/i);
    },
    { timeout: 250 }
  );
});
test('mutation accounting rejects truncated TAP rather than accepting not-ok alone', () => {
  const expected = baseline();
  withRun(bad, (result) => {
    result.stdout = result.stdout.split('1..1')[0];
    assert.throws(() => compareMutation(result, expected, 'truncated'), /summary|incomplete/i);
  });
});
test('mutation accounting rejects a failed baseline', () => {
  withRun(bad, (result) => assert.throws(() => summariseTestRun(result, 'baseline', true), /baseline/i));
});
