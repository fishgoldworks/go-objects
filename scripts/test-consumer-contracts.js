'use strict';
// These CLI fixtures simulate esbuild's documented result shape. They test the
// verifier, not the real bundler; the pinned installed-package gate is separate.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');

function runVerifier(options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'go-objects-tree-check-'));
  try {
    fs.mkdirSync(path.join(directory, 'scripts'));
    fs.copyFileSync(
      path.join(root, 'scripts/test-tree-shaking.js'),
      path.join(directory, 'scripts/test-tree-shaking.js')
    );
    fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({ name: 'go-objects', private: true }));
    const consumer = path.join(directory, 'package');
    fs.mkdirSync(consumer);
    fs.writeFileSync(
      path.join(consumer, 'package.json'),
      JSON.stringify({
        name: options.name || 'go-objects',
        version: '3.0.8',
        exports: { '.': './index.mjs', './package.json': './package.json' }
      })
    );
    fs.writeFileSync(path.join(consumer, 'index.mjs'), 'export const get = () => "Michael";');
    const module = path.join(directory, 'node_modules/esbuild');
    fs.mkdirSync(module, { recursive: true });
    const inputs = options.inputs || {
      'get-only.mjs': { bytesInOutput: 4 },
      'esm/internal/path.mjs': { bytesInOutput: 24 }
    };
    fs.writeFileSync(
      path.join(module, 'index.js'),
      `
      exports.version = '0.25.5';
      exports.build = async (options) => {
        ${options.requireGenerated ? `if (options.resolveDir !== undefined || options.stdin.resolveDir !== ${JSON.stringify(consumer)}) throw Error('verifier did not select generated consumer');` : ''}
        const text = ${JSON.stringify(options.code || "console.log('Michael');")};
        return { metafile: { outputs: { 'out.js': { inputs: ${JSON.stringify(inputs)} } } },
          outputFiles: [{ text, contents: Buffer.from(text) }] };
      };
    `
    );
    const args = options.default
      ? []
      : ['--package', options.missing ? path.join(directory, 'absent') : options.private ? directory : consumer];
    const result = spawnSync(process.execPath, [path.join(directory, 'scripts/test-tree-shaking.js'), ...args], {
      cwd: directory,
      encoding: 'utf8',
      timeout: 15000
    });
    assert.equal(result.error, undefined);
    assert.equal(result.signal, null);
    return result;
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function rejects(result, pattern) {
  assert.notEqual(result.status, 0, 'Incorrect consumer/bundle was accepted as tree-shaken');
  assert.match(result.stderr + result.stdout, pattern);
}

test('tree gate defaults to the generated consumer, not the private development root', () => {
  const result = runVerifier({ default: true, requireGenerated: true });
  assert.equal(result.status, 0, result.stderr);
});
test('tree gate accepts completed get-only ESM evidence for an explicit consumer', () => {
  const result = runVerifier();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).passed, true);
});
test('tree gate rejects an explicitly missing consumer directory', () =>
  rejects(runVerifier({ missing: true }), /ENOENT|package|consumer/i));
test('tree gate rejects the private source root as a consumer', () =>
  rejects(runVerifier({ private: true }), /private|consumer/i));
test('tree gate rejects a different package identity', () =>
  rejects(runVerifier({ name: 'some-other-package' }), /go-objects|consumer/i));
for (const file of [
  'src/ObjectWrapper.js',
  'src/internal/clone.js',
  'src/internal/deep.js',
  'src/internal/traversal.js',
  'src/internal/immutable.js'
]) {
  test('tree gate rejects retained CommonJS contribution ' + file, () => {
    rejects(
      runVerifier({
        inputs: {
          'get-only.mjs': { bytesInOutput: 4 },
          'esm/internal/path.mjs': { bytesInOutput: 24 },
          [file]: { bytesInOutput: 50 }
        }
      }),
      /unrelated|ESM|implementation|CommonJS/i
    );
  });
}
test('tree gate still rejects retained ESM clone code', () => {
  rejects(
    runVerifier({
      inputs: {
        'esm/internal/path.mjs': { bytesInOutput: 24 },
        'esm/internal/clone.mjs': { bytesInOutput: 50 }
      }
    }),
    /unrelated|implementation/i
  );
});
test('tree gate requires actual path implementation contribution, not just a printed answer', () => {
  rejects(runVerifier({ inputs: { 'get-only.mjs': { bytesInOutput: 30 } } }), /implementation|path|contribut/i);
});
test('tree gate rejects implementation contributions from another package directory', () => {
  rejects(
    runVerifier({ inputs: { '../other-package/esm/internal/path.mjs': { bytesInOutput: 24 } } }),
    /outside|consumer|package/i
  );
});
test('tree gate permits unused implementations that contribute zero bytes', () => {
  const result = runVerifier({
    inputs: {
      'get-only.mjs': { bytesInOutput: 4 },
      'esm/internal/path.mjs': { bytesInOutput: 24 },
      'esm/internal/clone.mjs': { bytesInOutput: 0 }
    }
  });
  assert.equal(result.status, 0, result.stderr);
});
test('tree gate retains the executed-result assertion', () =>
  rejects(runVerifier({ code: "console.log('wrong');" }), /wrong|Michael/));
test('tree gate rejects failed bundle execution', () =>
  rejects(runVerifier({ code: 'throw Error("bundle failed");' }), /bundle failed/));

// Source fidelity is checked through actual Node ESM evaluation as well as the
// independent Chromium transport fixture. This is not a bundler simulation.
const dataModule = (source) => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
function rewriteForNode(source) {
  const { moduleSpecifiers } = require('./browser-module-specifiers');
  let result = source;
  for (const specifier of moduleSpecifiers(source, 'fixture.mjs').slice().reverse()) {
    assert.equal(specifier.value, './dep.mjs');
    result =
      result.slice(0, specifier.start) +
      JSON.stringify(dataModule('export const value = 7; export default 7;')) +
      result.slice(specifier.end);
  }
  return result;
}
for (const [name, source, expected] of [
  [
    'quoted import-looking data',
    `import {value} from './dep.mjs'; export const text = "from './dep.mjs'"; export {value};`,
    "from './dep.mjs'"
  ],
  [
    'template import-looking data',
    "import {value} from './dep.mjs'; export const text = `from './dep.mjs'`; export {value};",
    "from './dep.mjs'"
  ],
  [
    'external-looking comment and text',
    `import {value} from './dep.mjs'; /* from 'not-a-dependency' */ export const text = "from 'not-an-import'"; export {value};`,
    "from 'not-an-import'"
  ],
  [
    'astral prefix and commented import clause',
    `const prefix = '😀'; import {value} from /* module */ './dep.mjs'; export const text = prefix; export {value};`,
    '😀'
  ],
  [
    'escaped module specifier',
    `import {value} from './d\\u0065p.mjs'; export const text = 'escaped'; export {value};`,
    'escaped'
  ]
]) {
  test('browser import transport preserves ' + name, async () => {
    const loaded = await import(dataModule(rewriteForNode(source)));
    assert.equal(loaded.value, 7);
    assert.equal(loaded.text, expected);
  });
}
test('browser import transport handles re-exports and side-effect imports', async () => {
  const result = await import(dataModule(rewriteForNode("import './dep.mjs'; export {value} from './dep.mjs';")));
  assert.equal(result.value, 7);
});
test('browser transport ignores imports embedded entirely in strings and comments', () => {
  const { moduleSpecifiers } = require('./browser-module-specifiers');
  assert.deepEqual(moduleSpecifiers(`/* import x from 'external'; */ export const text = "import './side.mjs';";`), []);
});
test('browser transport rejects real non-relative imports rather than loading external dependencies', () => {
  const { moduleSpecifiers } = require('./browser-module-specifiers');
  assert.throws(() => moduleSpecifiers("import x from 'external';"), /External module/);
});
test('browser transport rejects malformed module syntax before creating blobs', () => {
  const { moduleSpecifiers } = require('./browser-module-specifiers');
  assert.throws(() => moduleSpecifiers('import {'), /Invalid browser module/);
});

test('browser documentation rewriting preserves path-valued data while resolving the import', async () => {
  const { moduleSpecifiers } = require('./browser-module-specifiers');
  const source =
    "import value from './dist/go-objects.mjs'; export const text = './dist/go-objects.mjs'; export {value};";
  const ranges = moduleSpecifiers(source);
  assert.equal(ranges.length, 1);
  const [{ start, end, value }] = ranges;
  assert.equal(value, './dist/go-objects.mjs');
  const output = source.slice(0, start) + JSON.stringify(dataModule('export default 7;')) + source.slice(end);
  const loaded = await import(dataModule(output));
  assert.equal(loaded.value, 7);
  assert.equal(loaded.text, './dist/go-objects.mjs');
});
test('browser documentation source keeps non-module strings untouched', () => {
  const { moduleSpecifiers } = require('./browser-module-specifiers');
  assert.deepEqual(moduleSpecifiers("const path = './dist/go-objects.mjs';"), []);
});
