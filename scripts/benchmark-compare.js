'use strict';
// node scripts/benchmark-compare.js BASELINE_ROOT [CANDIDATE_ROOT] [OUTPUT_JSON]
// Optional BENCH_SAMPLES=11 BENCH_MS=30 BENCH_FILTER='pattern'.
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
const { performance } = require('node:perf_hooks');
if (!process.argv[2])
  throw new Error('Usage: node scripts/benchmark-compare.js BASELINE_ROOT [CANDIDATE_ROOT] [OUTPUT_JSON]');
const baseline = path.resolve(process.argv[2]),
  candidate = path.resolve(process.argv[3] || path.join(__dirname, '..'));
const samples = Number(process.env.BENCH_SAMPLES || 11),
  sampleMs = Number(process.env.BENCH_MS || 30);
if (!Number.isSafeInteger(samples) || samples < 3 || !Number.isFinite(sampleMs) || sampleMs < 1)
  throw new Error('Invalid sample configuration.');
// Node's directory-only require suffix is '/' even on Windows; a trailing
// backslash can still resolve an adjacent .js or .json file first.
const B = require(baseline + '/'),
  C = require(candidate + '/'),
  cases = require('../benchmarks/performance-cases');
const filtered = process.env.BENCH_FILTER
  ? cases.filter(([name]) => new RegExp(process.env.BENCH_FILTER).test(name))
  : cases;
if (!filtered.length) throw new Error('No benchmark workloads match BENCH_FILTER.');
const median = (xs) => {
  const a = [...xs].sort((a, b) => a - b);
  return a[Math.floor(a.length / 2)];
};
function measure(fn, n) {
  let sink;
  const start = performance.now();
  for (let i = 0; i < n; i++) sink = fn();
  const elapsed = performance.now() - start;
  globalThis.__goObjectsBenchmarkSink = sink;
  return elapsed;
}
function calibrate(fn) {
  let n = 1,
    ms;
  do {
    ms = measure(fn, n);
    if (ms >= 8 || n >= 1000000) break;
    n = Math.min(1000000, n * 4);
    // eslint-disable-next-line no-constant-condition -- Calibration exits on measured time or the fixed iteration cap.
  } while (true);
  return Math.max(1, Math.min(1000000, Math.ceil((n * sampleMs) / Math.max(ms, 0.001))));
}
const report = {
  node: process.version,
  v8: process.versions.v8,
  cpu: os.cpus()[0]?.model,
  platform: process.platform,
  arch: process.arch,
  baselineRoot: baseline,
  candidateRoot: candidate,
  baselineVersion: B && require(path.join(baseline, 'package.json')).version,
  candidateVersion: require(path.join(candidate, 'package.json')).version,
  samples,
  sampleMs,
  method:
    'Same-process alternating-order paired samples, independent stable fixtures, per-variant calibration/warm-up, result sink; no forced GC; times include natural GC. No cross-library or universal speed claim.',
  results: []
};
for (const [name, make] of filtered) {
  const b = make(B),
    c = make(C);
  const bn = calibrate(b),
    cn = calibrate(c),
    bs = [],
    cs = [];
  for (let i = 0; i < samples; i++) {
    if (i % 2 === 0) {
      bs.push((measure(b, bn) * 1000) / bn);
      cs.push((measure(c, cn) * 1000) / cn);
    } else {
      cs.push((measure(c, cn) * 1000) / cn);
      bs.push((measure(b, bn) * 1000) / bn);
    }
  }
  const bu = median(bs),
    cu = median(cs);
  report.results.push({
    name,
    baselineUs: bu,
    candidateUs: cu,
    speedup: bu / cu,
    baselineIterations: bn,
    candidateIterations: cn,
    baselineSamplesUs: bs,
    candidateSamplesUs: cs
  });
  console.log(
    name.padEnd(42) +
      bu.toFixed(3).padStart(12) +
      ' -> ' +
      cu.toFixed(3).padStart(12) +
      ' us/op   ' +
      (bu / cu).toFixed(2) +
      'x'
  );
}
if (process.argv[4]) fs.writeFileSync(path.resolve(process.argv[4]), JSON.stringify(report, null, 2) + '\n');
