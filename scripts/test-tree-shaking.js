'use strict';
// Independent consumer bundling check using the pinned development dependency.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
assert.ok(
  args.length === 0 || (args.length === 2 && args[0] === '--package'),
  'Usage: node scripts/test-tree-shaking.js [--package DIRECTORY]'
);
const consumer = fs.realpathSync(args.length ? path.resolve(args[1]) : path.join(root, 'package'));
const manifestPath = path.join(consumer, 'package.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
assert.equal(manifest.name, 'go-objects', 'Expected a go-objects consumer package');
assert.notEqual(manifest.private, true, 'The private development root is not a consumer package');
assert.equal(
  fs.realpathSync(createRequire(manifestPath).resolve('go-objects/package.json')),
  fs.realpathSync(manifestPath),
  'Self-reference must resolve the selected consumer, not an ancestor dependency'
);
let esbuild;
try {
  esbuild = require('esbuild');
} catch {
  console.error('Tree-shaking verification requires esbuild. Run npm ci.');
  process.exit(1);
}
async function main() {
  const result = await esbuild.build({
    absWorkingDir: consumer,
    stdin: {
      contents: "import {get} from 'go-objects'; console.log(get({profile:{name:'Michael'}},'profile.name'));",
      resolveDir: consumer,
      sourcefile: 'get-only.mjs'
    },
    bundle: true,
    format: 'esm',
    platform: 'browser',
    treeShaking: true,
    write: false,
    metafile: true,
    minify: true,
    logLevel: 'silent'
  });
  const contributions = Object.entries(result.metafile.outputs).flatMap(([output, info]) =>
    Object.entries(info.inputs)
      .filter(([, contribution]) => contribution.bytesInOutput > 0)
      .map(([input]) => ({ output, input }))
  );
  // A correct printed value alone is not tree-shaking evidence. Require actual
  // path code from this candidate and reject CJS/bundle or ancestor fallbacks.
  const implementations = contributions
    .filter(({ input }) => input !== 'get-only.mjs')
    .map(({ input }) => path.relative(consumer, path.resolve(consumer, input)).split(path.sep).join('/'));
  for (const input of implementations) {
    assert.ok(
      !input.startsWith('../') && !path.isAbsolute(input),
      'Implementation outside the selected consumer: ' + input
    );
    assert.match(input, /^esm\/.*\.mjs$/, 'Expected static ESM implementation, not CommonJS or a bundle: ' + input);
  }
  assert.ok(
    implementations.includes('esm/internal/path.mjs'),
    'No selected path implementation contributed to the output'
  );
  const unwanted = implementations.filter((input) =>
    /^esm\/(?:ObjectWrapper|internal\/(?:clone|deep|traversal|immutable))\.mjs$/.test(input)
  );
  assert.deepEqual(unwanted, [], 'A get-only import retained unrelated runtime implementations.');
  assert.equal(result.outputFiles.length, 1, 'Expected one executable bundled consumer');
  const run = spawnSync(process.execPath, ['--input-type=module', '-e', result.outputFiles[0].text], {
    encoding: 'utf8',
    timeout: 30000
  });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout.trim(), 'Michael');
  console.log(
    JSON.stringify(
      {
        esbuild: esbuild.version,
        packageRoot: consumer,
        passed: true,
        bytes: result.outputFiles[0].contents.length,
        contributingModules: contributions.map((x) => x.input)
      },
      null,
      2
    )
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
