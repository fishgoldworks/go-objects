'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
function run(executable, args, cwd = root, inherit = false) {
  return execFileSync(executable, args, {
    cwd,
    encoding: 'utf8',
    timeout: 300000,
    stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe']
  });
}
function npm(args, cwd = root, inherit = false) {
  const bin = path.dirname(process.execPath);
  const cli = [
    process.env.npm_execpath,
    path.resolve(bin, '../lib/node_modules/npm/bin/npm-cli.js'),
    path.resolve(bin, 'node_modules/npm/bin/npm-cli.js')
  ].find((file) => file && fs.existsSync(file));
  assert.ok(cli, 'Cannot locate npm; run through an npm command');
  return run(process.execPath, [cli, ...args], cwd, inherit);
}
function parseConsumerArgs(args, allowOutput = false) {
  const result = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--tarball') {
      const value = args[++i];
      assert.ok(value && !value.startsWith('--'), '--tarball requires a path');
      result.tarball = path.resolve(value);
    } else if (allowOutput && !args[i].startsWith('--') && !result.output) result.output = path.resolve(args[i]);
    else throw Error('Unknown consumer-check argument: ' + args[i]);
  }
  if (result.tarball) assert.ok(fs.statSync(result.tarball).isFile(), 'Supplied tarball must be a file');
  return result;
}
// Exit zero is necessary but does not prove an async/plain script reached its
// final assertion. Call only after checking the child process outcome.
function assertCompleted(output, marker, label) {
  assert.ok(output.split(/\r?\n/).includes(marker), label + ' exited without its completion marker');
}
module.exports = { run, npm, parseConsumerArgs, assertCompleted };
