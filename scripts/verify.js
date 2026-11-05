'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os'),
  crypto = require('node:crypto'),
  assert = require('node:assert/strict');
const { npm } = require('./consumer-tools');
const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
assert.ok(args.length === 0 || (args.length === 1 && args[0] === '--all'), 'Usage: node scripts/verify.js [--all]');
const tarball = require('./pack-package')();
const digest = () => crypto.createHash('sha256').update(fs.readFileSync(tarball)).digest('hex');
const sha256 = digest();
console.log('Verification candidate: ' + tarball + ' SHA-256 ' + sha256);
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'go-objects-verify-'));
try {
  for (const name of ['lint', 'format:check', 'test:docs', 'coverage']) npm(['run', name], root, true);
  npm(['run', 'test:types', '--', '--tarball', tarball], root, true);
  for (const name of ['test:build', 'test:artifacts']) npm(['run', name], root, true);
  const consumer = path.join(temporary, 'consumer');
  fs.mkdirSync(consumer);
  fs.writeFileSync(path.join(consumer, 'package.json'), JSON.stringify({ private: true }));
  npm(
    ['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false', tarball],
    consumer,
    true
  );
  const installed = path.join(consumer, 'node_modules/go-objects');
  npm(['run', 'test:tree-shaking', '--', '--package', installed], root, true);
  for (const name of ['test:package', 'test:runtime'])
    npm(['run', name, '--', '--tarball', tarball, ...(name === 'test:runtime' ? ['--esm'] : [])], root, true);
  npm(['run', 'test:mutations'], root, true);
  if (args.length)
    for (const browser of ['chromium', 'firefox', 'webkit'])
      for (const bundle of ['go-objects.js', 'go-objects.min.js'])
        npm(
          ['run', 'test:browser', '--', '--package', installed, '--browser', browser, '--bundle', bundle],
          root,
          true
        );
  assert.equal(digest(), sha256, 'The candidate tarball changed during verification');
  console.log(JSON.stringify({ verifiedTarball: tarball, sha256, browser: args.length > 0 }));
} finally {
  assert.equal(path.dirname(temporary), path.resolve(os.tmpdir()));
  fs.rmSync(temporary, { recursive: true, force: true });
}
