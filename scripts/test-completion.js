'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const { runExample } = require('./test-examples');

for (const format of [undefined, 'esm']) {
  test(
    'example completion: valid results and assertion failures remain observable in ' + (format || 'CommonJS'),
    () => {
      const example = { name: 'completion control', language: 'javascript', code: '1; // => 1' };
      assert.equal(runExample(example, root, root, format), 1);
      assert.throws(() => runExample({ ...example, code: '1; // => 2' }, root, root, format), /completion control/);
    }
  );
  test('example completion rejects process exit before its result assertion in ' + (format || 'CommonJS'), () => {
    assert.throws(
      () =>
        runExample(
          {
            name: 'early example exit',
            language: 'javascript',
            code: 'process.exit(0);\n1; // => 2'
          },
          root,
          root,
          format
        ),
      /completion|complete/i
    );
  });
}
function runtimeFixture(check, replacement) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'go-objects-completion-'));
  try {
    fs.mkdirSync(path.join(directory, 'scripts'));
    for (const name of ['test-runtime.js', 'consumer-tools.js', 'package-layout.js'])
      fs.copyFileSync(path.join(root, 'scripts', name), path.join(directory, 'scripts', name));
    fs.cpSync(path.join(root, 'test/compatibility'), path.join(directory, 'test/compatibility'), { recursive: true });
    if (replacement) fs.writeFileSync(path.join(directory, 'test/compatibility', replacement.file), replacement.code);
    // Forward to the actual installed compiler, not a fake compilation outcome.
    const compiler = path.join(directory, 'node_modules/typescript/bin/tsc');
    fs.mkdirSync(path.dirname(compiler), { recursive: true });
    fs.writeFileSync(compiler, 'require(' + JSON.stringify(require.resolve('typescript/bin/tsc')) + ');');
    const consumer = path.join(directory, 'consumer');
    fs.mkdirSync(consumer);
    fs.writeFileSync(path.join(consumer, 'package.json'), '{"private":true}');
    fs.cpSync(path.join(root, 'package'), path.join(consumer, 'node_modules/go-objects'), { recursive: true });
    check(
      () => require(path.join(directory, 'scripts/test-runtime')).runInstalled(consumer, process.execPath, true),
      directory,
      consumer
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
test('runtime completion accepts genuinely completed native and compiled consumers', () => {
  runtimeFixture((run) => assert.equal(run().compiledTypeScript, true));
});
for (const extension of ['cts', 'mts']) {
  for (const early of ['exit', 'pending']) {
    test('compiled ' + extension + ' consumer rejects ' + early + ' without completed contracts', () => {
      const marker = extension === 'cts' ? 'TypeScript CommonJS consumer passed' : 'TypeScript ESM consumer passed';
      const code =
        early === 'exit'
          ? 'declare const process: { exit(code: number): never }; process.exit(0);'
          : 'async function main() { await new Promise(() => {}); console.log(' +
            JSON.stringify(marker) +
            '); } main();';
      runtimeFixture((run) => assert.throws(run, /completion|complete/i), { file: 'consumer.' + extension, code });
    });
  }
}

test('runtime consumer discovery preserves and excludes experiment directories', () => {
  runtimeFixture((run, directory, consumer) => {
    for (const name of ['temp', '.tmp']) {
      const file = path.join(directory, 'test/compatibility', name, 'invalid.js');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, 'not executable JavaScript');
    }
    assert.equal(run().compiledTypeScript, true);
    for (const name of ['temp', '.tmp']) {
      assert.equal(
        fs.readFileSync(path.join(directory, 'test/compatibility', name, 'invalid.js'), 'utf8'),
        'not executable JavaScript'
      );
      assert.equal(fs.existsSync(path.join(consumer, 'compatibility', name)), false);
    }
  });
});
