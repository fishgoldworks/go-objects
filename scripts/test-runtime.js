'use strict';
// Modern orchestration; consumers run using the explicitly selected Node binary.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const { assertCompleted } = require('./consumer-tools');
const { isTemporaryPath } = require('./package-layout');

function run(executable, args, directory) {
  try {
    return execFileSync(executable, args, {
      cwd: directory,
      encoding: 'utf8',
      timeout: 60000,
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } catch (error) {
    if (error.stdout) process.stderr.write(error.stdout);
    if (error.stderr) process.stderr.write(error.stderr);
    throw error;
  }
}

function runInstalled(consumer, executable = process.execPath, esm = true) {
  const fixtures = path.join(consumer, 'compatibility');
  fs.mkdirSync(fixtures, { recursive: true });
  for (const entry of fs.readdirSync(path.join(root, 'test/compatibility'), { withFileTypes: true })) {
    if (!entry.isFile() || isTemporaryPath(entry.name)) continue;
    fs.copyFileSync(path.join(root, 'test/compatibility', entry.name), path.join(fixtures, entry.name));
  }
  const version = run(executable, ['--version'], consumer).trim();
  const checkConsumer = (file, label) => {
    const output = run(executable, [path.join(fixtures, file)], consumer);
    assertCompleted(output, version + ': ' + label + ' consumer contracts passed', file);
    process.stdout.write(output);
  };
  checkConsumer('commonjs.js', 'CommonJS root, legacy subpaths and UMD');
  if (esm) checkConsumer('esm.mjs', 'native default/named ESM and standalone ESM');

  const compiler = path.join(root, 'node_modules/typescript/bin/tsc');
  const output = path.join(fixtures, 'compiled');
  run(
    process.execPath,
    [
      compiler,
      '--module',
      'NodeNext',
      '--moduleResolution',
      'NodeNext',
      '--target',
      'ES2017',
      '--lib',
      'ES2020,DOM',
      '--strict',
      '--outDir',
      output,
      path.join(fixtures, 'consumer.cts'),
      ...(esm ? [path.join(fixtures, 'consumer.mts')] : [])
    ],
    consumer
  );
  for (const [file, marker] of [
    ['consumer.cjs', 'TypeScript CommonJS consumer passed'],
    ...(esm ? [['consumer.mjs', 'TypeScript ESM consumer passed']] : [])
  ]) {
    const result = run(executable, [path.join(output, file)], consumer);
    assertCompleted(result, marker, file);
    process.stdout.write(result);
  }
  return { version, commonjs: true, esm, compiledTypeScript: true };
}

function parseArguments(args) {
  const options = { executable: process.execPath, esm: args.length === 0 };
  for (let i = 0; i < args.length; i++) {
    const argument = args[i];
    if (argument === '--esm') options.esm = true;
    else if (argument === '--node' || argument === '--tarball') {
      const value = args[++i];
      assert.ok(value && !value.startsWith('--'), argument + ' requires a value');
      options[argument === '--node' ? 'executable' : 'tarball'] = path.resolve(value);
    } else throw new Error('Usage: npm run test:runtime -- [--node PATH] [--esm] [--tarball PATH]');
  }
  if (options.tarball) assert.ok(fs.statSync(options.tarball).isFile(), 'Supplied tarball must be a file');
  return options;
}

function main(args = process.argv.slice(2)) {
  const options = parseArguments(args);
  assert.ok(process.env.npm_execpath, 'Run through npm run test:runtime');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'go-objects-runtime-'));
  const npm = (args, cwd) => run(process.execPath, [process.env.npm_execpath, ...args], cwd);
  try {
    let tarball = options.tarball;
    if (!tarball) {
      tarball = require('./pack-package')(temporary);
    }
    const sha256 = crypto.createHash('sha256').update(fs.readFileSync(tarball)).digest('hex');
    const consumer = path.join(temporary, 'consumer');
    fs.mkdirSync(consumer);
    fs.writeFileSync(path.join(consumer, 'package.json'), JSON.stringify({ name: 'runtime-consumer', private: true }));
    npm(
      ['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false', tarball],
      consumer
    );
    console.log(JSON.stringify({ tarball, sha256, ...runInstalled(consumer, options.executable, options.esm) }));
  } finally {
    assert.equal(path.dirname(temporary), path.resolve(os.tmpdir()));
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

module.exports = { runInstalled, parseArguments, main };
if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
