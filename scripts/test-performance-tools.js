'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const script = path.join(__dirname, 'benchmark-compare.js');

function compare(filter, samples = '3', sampleMs = '1') {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'go-objects-performance-test-'));
  try {
    const output = path.join(temporary, 'report.json');
    const child = spawnSync(process.execPath, [script, root, root, output], {
      cwd: temporary,
      env: { ...process.env, BENCH_FILTER: filter, BENCH_SAMPLES: samples, BENCH_MS: sampleMs },
      encoding: 'utf8',
      timeout: 30000,
      maxBuffer: 1024 * 1024
    });
    assert.ifError(child.error);
    assert.equal(child.signal, null);
    return {
      status: child.status,
      stderr: child.stderr,
      report: fs.existsSync(output) ? JSON.parse(fs.readFileSync(output, 'utf8')) : undefined
    };
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

test('benchmark comparison rejects a filter that selects no workloads', () => {
  const result = compare('^no-such-workload$');
  assert.notEqual(result.status, 0, 'An empty benchmark cannot report success');
  assert.match(result.stderr, /No benchmark workloads match/);
  assert.equal(result.report, undefined);
});

test('benchmark comparison reports every selected sample with positive calibrated iterations', () => {
  const result = compare('^get/simple-string$');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.report.results.length, 1);
  const row = result.report.results[0];
  assert.equal(row.name, 'get/simple-string');
  for (const side of ['baseline', 'candidate']) {
    assert.ok(Number.isSafeInteger(row[side + 'Iterations']) && row[side + 'Iterations'] > 0);
    assert.equal(row[side + 'SamplesUs'].length, 3);
    assert.ok(row[side + 'SamplesUs'].every((sample) => Number.isFinite(sample) && sample > 0));
    const sorted = row[side + 'SamplesUs'].slice().sort((a, b) => a - b);
    assert.equal(row[side + 'Us'], sorted[1]);
  }
  assert.equal(row.speedup, row.baselineUs / row.candidateUs);
});

for (const [label, filter, samples, duration] of [
  ['invalid regex', '[', '3', '1'],
  ['too few samples', '^get/simple-string$', '2', '1'],
  ['fractional sample count', '^get/simple-string$', '3.5', '1'],
  ['nonfinite duration', '^get/simple-string$', '3', 'Infinity'],
  ['nonpositive duration', '^get/simple-string$', '3', '0']
]) {
  test('benchmark comparison rejects ' + label, () => {
    const result = compare(filter, samples, duration);
    assert.notEqual(result.status, 0);
    assert.equal(result.report, undefined);
  });
}

test('benchmark comparison identifies the exact selected roots in its report', () => {
  const result = compare('^get/simple-string$');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.report.baselineRoot, root);
  assert.equal(result.report.candidateRoot, root);
});

for (const extension of ['js', 'json'])
  test('benchmark roots resolve as directories even when adjacent ' + extension + ' files exist', () => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'go-objects-benchmark-roots-'));
    try {
      const roots = ['before', 'after'].map((name) => path.join(temporary, name));
      for (const directory of roots) {
        fs.mkdirSync(directory);
        fs.writeFileSync(
          path.join(directory, 'package.json'),
          JSON.stringify({ name: 'fixture', version: '1.0.0', main: 'entry.js' })
        );
        fs.writeFileSync(path.join(directory, 'entry.js'), 'module.exports = { get: (input, key) => input[key] };');
        fs.writeFileSync(
          directory + '.' + extension,
          extension === 'js'
            ? "throw new Error('Adjacent file is not the requested root');"
            : JSON.stringify({ wrongRoot: true })
        );
      }
      const output = path.join(temporary, 'report.json');
      const child = spawnSync(process.execPath, [script, ...roots, output], {
        env: { ...process.env, BENCH_FILTER: '^get/simple-string$', BENCH_SAMPLES: '3', BENCH_MS: '1' },
        encoding: 'utf8',
        timeout: 30000,
        maxBuffer: 1024 * 1024
      });
      assert.ifError(child.error);
      assert.equal(child.signal, null);
      assert.equal(child.status, 0, child.stderr);
      const result = JSON.parse(fs.readFileSync(output, 'utf8'));
      assert.equal(result.results.length, 1);
      assert.equal(result.baselineRoot, roots[0]);
      assert.equal(result.candidateRoot, roots[1]);
    } finally {
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  });
