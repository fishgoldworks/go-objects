'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const source = path.resolve(__dirname, '..');

function fixture(check) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'go-objects-build-test-'));
  try {
    for (const name of [
      'package.json',
      'src',
      'scripts',
      'types',
      'index.js',
      'index.d.ts',
      'index.d.mts',
      'README.md',
      'docs',
      'CHANGELOG.md',
      'LICENSE.md'
    ])
      fs.cpSync(path.join(source, name), path.join(root, name), { recursive: true });
    for (const name of ['dist', 'esm', 'package']) {
      fs.mkdirSync(path.join(root, name));
      fs.writeFileSync(path.join(root, name, 'previous.txt'), name);
    }
    fs.writeFileSync(path.join(root, 'index.mjs'), 'previous index');
    fs.writeFileSync(path.join(root, 'src/get.d.ts'), 'previous declaration');
    fs.writeFileSync(path.join(root, 'src/obsolete.d.ts'), 'obsolete declaration');
    fs.writeFileSync(
      path.join(root, 'inject.cjs'),
      `
const fs = require('node:fs'), path = require('node:path');
const mode = process.env.BUILD_FAILURE;
const write = fs.writeFileSync;
fs.writeFileSync = function(file, content, ...args) {
  if (mode === 'generate' && path.basename(file).startsWith('go-objects.mjs')) throw Error('Injected generation failure');
  if (mode === 'smoke' && path.basename(file).startsWith('go-objects.js')) content = 'throw Error("Injected smoke failure")';
  if (mode === 'cjs-import' && file.endsWith(path.join('src','get.js'))) content = "module.exports = require('./Injected-missing');";
  if (mode === 'smoke-exit' && path.basename(file) === 'index.mjs') content += "\\nprocess.exit(0);";
  if (mode === 'smoke-pending' && path.basename(file) === 'index.mjs') content += "\\nawait new Promise(() => {});";
  if (mode === 'esm-import' && path.basename(file) === 'index.mjs') content += "\\nimport './Injected-missing.mjs';";
  return write.call(this, file, content, ...args);
};
const copy = fs.cpSync;
fs.cpSync = function(from, to, options) {
  if (mode === 'preserve' && path.basename(from) === 'temp') throw Error('Injected experiment preservation failure');
  return copy.call(this, from, to, options);
};
const rename = fs.renameSync;
let replaced = false;
fs.renameSync = function(from, to) {
  if (mode === 'package-replace' && path.resolve(to) === path.join(__dirname, 'package') && !replaced) {
    replaced = true;
    throw Error('Injected package replacement failure');
  }
  if (['replace', 'rollback', 'rollback-cleanup'].includes(mode) && path.resolve(to) === path.join(__dirname, 'package') && (!replaced || mode.startsWith('rollback'))) {
    replaced = true;
    throw Error('Injected replacement failure');
  }
  return rename.call(this, from, to);
};
const remove = fs.rmSync;
fs.rmSync = function(file, options) {
  if (mode === 'rollback-cleanup' && path.dirname(file) === __dirname && path.basename(file).startsWith('.go-objects-build-')) throw Error('Injected cleanup failure');
  return remove.call(this, file, options);
};
`
    );
    const build = (mode = '', args = []) =>
      spawnSync(process.execPath, ['--require', './inject.cjs', 'scripts/build.js', ...args], {
        cwd: root,
        encoding: 'utf8',
        timeout: 30000,
        env: { ...process.env, NODE_PATH: path.join(source, 'node_modules'), BUILD_FAILURE: mode }
      });
    check(root, build);
  } finally {
    assert.equal(path.dirname(root), os.tmpdir());
    fs.rmSync(root, { recursive: true, force: true });
  }
}
function preserved(root) {
  for (const name of ['dist', 'esm']) {
    assert.deepEqual(fs.readdirSync(path.join(root, name)), ['previous.txt']);
    assert.equal(fs.readFileSync(path.join(root, name, 'previous.txt'), 'utf8'), name);
  }
  assert.equal(fs.readFileSync(path.join(root, 'index.mjs'), 'utf8'), 'previous index');
  assert.equal(fs.readFileSync(path.join(root, 'src/get.d.ts'), 'utf8'), 'previous declaration');
  assert.equal(fs.readFileSync(path.join(root, 'src/obsolete.d.ts'), 'utf8'), 'obsolete declaration');
}
for (const mode of ['generate', 'smoke', 'cjs-import', 'esm-import', 'replace', 'package-replace'])
  test(mode + ' failure preserves every generated surface', () =>
    fixture((root, build) => {
      const result = build(mode);
      assert.ifError(result.error);
      assert.notEqual(result.status, 0, result.stdout);
      assert.match(result.stderr, /Injected/);
      preserved(root);
      assert.equal(fs.readFileSync(path.join(root, 'package/previous.txt'), 'utf8'), 'package');
      assert.deepEqual(
        fs.readdirSync(root).filter((name) => name.startsWith('.go-objects-build-')),
        []
      );
    })
  );
for (const mode of ['rollback', 'rollback-cleanup'])
  test(mode + ' failure reports and retains the unrestored backup', () =>
    fixture((root, build) => {
      const result = build(mode);
      assert.ifError(result.error);
      assert.notEqual(result.status, 0);
      const backups = fs
        .readdirSync(root)
        .filter((name) => name.startsWith('.go-objects-build-') && name.endsWith('-previous'));
      assert.equal(backups.length, 1);
      const backup = path.join(root, backups[0]);
      assert.ok(result.stderr.includes(backup), result.stderr);
      assert.equal(fs.readFileSync(path.join(backup, 'package/previous.txt'), 'utf8'), 'package');
      assert.equal(fs.existsSync(path.join(root, 'package')), false);
      fs.renameSync(path.join(backup, 'package'), path.join(root, 'package'));
      preserved(root);
      if (mode === 'rollback-cleanup') assert.match(result.stderr, /cleanup also failed/);
    })
  );
test('unknown build modes fail before touching outputs', () =>
  fixture((root, build) => {
    const result = build('', ['bundle']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Usage:/);
    preserved(root);
  }));
test('complete builds replace stale output and generate declarations from scratch', () =>
  fixture((root, build) => {
    const result = build();
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(fs.readdirSync(path.join(root, 'package/dist')).sort(), [
      'go-objects.d.mts',
      'go-objects.d.ts',
      'go-objects.js',
      'go-objects.js.map',
      'go-objects.min.js',
      'go-objects.min.js.map',
      'go-objects.mjs'
    ]);
    assert.equal(fs.existsSync(path.join(root, 'package/esm/previous.txt')), false);
    assert.equal(fs.existsSync(path.join(root, 'package/previous.txt')), false);
    assert.equal(require(path.join(root, 'package/package.json')).engines.node, '>=8.0.0');
    assert.equal(require(path.join(root, 'package/get.js'))({ answer: 42 }, 'answer'), 42);
    assert.equal(fs.existsSync(path.join(root, 'package/src/obsolete.d.ts')), false);
    assert.match(fs.readFileSync(path.join(root, 'package/src/get.d.ts'), 'utf8'), /typeof get/);
    assert.deepEqual(
      fs.readdirSync(root).filter((name) => name.startsWith('.go-objects-build-')),
      []
    );
  }));

test('build prunes stale generated ESM modules and declarations', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const { spawnSync } = require('node:child_process');
  const os = require('node:os');
  const sourceRoot = path.resolve(__dirname, '..');
  // Fault-injection fixtures live elsewhere so packaging cannot see obsolete files.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'go-objects-build-prune-'));
  const staleModule = path.join(root, 'package/esm', 'obsolete-entry.mjs');
  const staleTypes = path.join(root, 'package/esm', 'obsolete-entry.d.mts');
  const staleCjsTypes = path.join(root, 'package/src', 'obsolete-entry.d.ts');
  try {
    for (const file of [
      'package.json',
      'scripts',
      'src',
      'types',
      'index.js',
      'index.d.ts',
      'index.d.mts',
      'README.md',
      'docs',
      'CHANGELOG.md',
      'LICENSE.md'
    ]) {
      fs.cpSync(path.join(sourceRoot, file), path.join(root, file), { recursive: true });
    }
    fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true });
    fs.symlinkSync(
      path.dirname(require.resolve('typescript/package.json')),
      path.join(root, 'node_modules/typescript'),
      process.platform === 'win32' ? 'junction' : 'dir'
    );
    fs.mkdirSync(path.dirname(staleModule), { recursive: true });
    fs.mkdirSync(path.dirname(staleCjsTypes), { recursive: true });
    fs.writeFileSync(staleModule, 'export default 1;\n');
    fs.writeFileSync(staleTypes, 'declare const x: 1; export default x;\n');
    fs.writeFileSync(staleCjsTypes, 'declare const x: 1; export = x;\n');
    const result = spawnSync(process.execPath, ['scripts/build.js'], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, NODE_PATH: path.join(sourceRoot, 'node_modules') }
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(fs.existsSync(staleModule), false);
    assert.equal(fs.existsSync(staleTypes), false);
    assert.equal(fs.existsSync(staleCjsTypes), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('consumer builds leave authored root and legacy output bytes untouched', () =>
  fixture((root, build) => {
    const result = build();
    assert.equal(result.status, 0, result.stderr);
    preserved(root);
    assert.equal(require(path.join(root, 'package/get.js'))({ answer: 42 }, 'answer'), 42);
  }));

async function primitiveBuildProbe(filename, literal, cleanupFails, prefix) {
  const assert = require('node:assert/strict'),
    fs = require('node:fs'),
    path = require('node:path'),
    Module = require('node:module');
  const value = literal === 'undefined' ? undefined : JSON.parse(literal),
    cleanupError = new Error('cleanup denied');
  const write = fs.writeFileSync,
    remove = fs.rmSync;
  fs.writeFileSync = (file, ...args) => {
    if (String(file).includes(prefix)) throw value;
    return write(file, ...args);
  };
  fs.rmSync = (file, ...args) => {
    if (cleanupFails && path.basename(file).startsWith(prefix)) throw cleanupError;
    return remove(file, ...args);
  };
  const source =
    fs.readFileSync(filename, 'utf8').replace(/\nmain\(\);\s*$/, '\n') + '\nmodule.exports.__testMain=main;\n';
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded._compile(source, filename);
  let failed = false,
    thrown;
  try {
    process.argv = [process.execPath, filename];
    await loaded.exports.__testMain();
  } catch (error) {
    failed = true;
    thrown = error;
  }
  assert.equal(failed, true, 'A falsy thrown value must not report success');
  if (cleanupFails) {
    assert.ok(thrown instanceof AggregateError);
    assert.equal(thrown.errors[0], value);
    assert.equal(thrown.errors[1], cleanupError);
    assert.equal(thrown.cause, cleanupError);
  } else assert.equal(thrown, value);
}

for (const literal of ['undefined', 'null', 'false', '0', '""'])
  for (const cleanupFails of [false, true]) {
    test('primitive generation failure ' + literal + ', cleanup=' + cleanupFails + ' remains a failure', () =>
      fixture((root) => {
        const code =
          '(' +
          primitiveBuildProbe.toString() +
          ')(' +
          [path.join(root, 'scripts/build.js'), literal, cleanupFails, '.go-objects-build-']
            .map(JSON.stringify)
            .join(',') +
          ').catch(error=>{console.error(error);process.exitCode=1;});';
        const result = spawnSync(process.execPath, ['-e', code], {
          cwd: root,
          encoding: 'utf8',
          env: { ...process.env, NODE_PATH: path.join(source, 'node_modules') }
        });
        assert.equal(result.status, 0, result.stderr);
        preserved(root);
        assert.equal(fs.readFileSync(path.join(root, 'package/previous.txt'), 'utf8'), 'package');
      })
    );
  }

for (const mode of ['smoke-exit', 'smoke-pending']) {
  test(mode + ' cannot install output without finished format checks', () =>
    fixture((root, build) => {
      const result = build(mode);
      assert.ifError(result.error);
      assert.notEqual(result.status, 0, 'Premature smoke exit must fail the build');
      assert.match(result.stderr, /completion|complete/i);
      preserved(root);
      assert.equal(fs.readFileSync(path.join(root, 'package/previous.txt'), 'utf8'), 'package');
      assert.deepEqual(
        fs.readdirSync(root).filter((name) => name.startsWith('.go-objects-build-')),
        []
      );
    })
  );
}

// Exercise real canonical-source changes in disposable projects. Build smoke
// checks API shape; these assertions additionally compare the observed values.
function allFormatValues(root, argument) {
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import { createRequire } from 'node:module';
import fs from 'node:fs';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const graph = await import('./package/index.mjs');
const bundle = await import('./package/dist/go-objects.mjs');
const context = {};
vm.runInNewContext(fs.readFileSync('./package/dist/go-objects.js', 'utf8'), context);
const apis = [require('./index.js'), require('./package/index.js'), graph.default, bundle.default,
  require('./package/dist/go-objects.js'), context.Objects];
console.log(JSON.stringify(apis.map(api => api.values(${JSON.stringify(argument)}))));`
    ],
    { cwd: root, encoding: 'utf8', timeout: 30000 }
  );
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

for (const exportLine of ['export default sample;', 'export { sample };']) {
  test('standalone generation preserves template data containing ' + exportLine, () =>
    fixture((root, build) => {
      const file = path.join(root, 'src/internal/collection.js');
      const literal = 'before\n' + exportLine + '\nafter';
      const before = fs.readFileSync(file, 'utf8');
      const after = before.replace(
        'function values(obj) {',
        'function values(obj) {\n  if (obj === null) return [`' + literal + '`];'
      );
      assert.notEqual(after, before, 'The fixture must change the actual source');
      fs.writeFileSync(file, after);
      const result = build();
      assert.ifError(result.error);
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(
        allFormatValues(root, null),
        Array.from({ length: 6 }, () => [literal])
      );
      assert.equal(fs.readFileSync(file, 'utf8'), after, 'Building must not change canonical source');
    })
  );
}

const facadeStatements = [
  ['reassigned export', '\nmodule.exports = function values() { return ["override"]; };\n'],
  ['export property write', '\nmodule.exports.reviewLabel = "kept";\n'],
  ['top-level statement', '\nglobalThis.reviewBuildSideEffect = true;\n']
];
for (const [name, extra] of facadeStatements) {
  test('a direct re-export with ' + name + ' is rejected rather than silently shortened', () =>
    fixture((root, build) => {
      fs.appendFileSync(path.join(root, 'src/values.js'), extra);
      const result = build();
      assert.ifError(result.error);
      assert.notEqual(result.status, 0, 'Do not publish a facade with discarded executable source');
      assert.match(result.stderr, /Unsupported.*(?:facade|re-export).*values\.js/i);
      assert.equal(fs.readFileSync(path.join(root, 'package/previous.txt'), 'utf8'), 'package');
      preserved(root);
      assert.deepEqual(
        fs.readdirSync(root).filter((name) => name.startsWith('.go-objects-build-')),
        []
      );
    })
  );
}

test('pure re-export directives, comments and explicit relative extensions remain supported', () =>
  fixture((root, build) => {
    const file = path.join(root, 'src/values.js');
    fs.writeFileSync(
      file,
      fs
        .readFileSync(file, 'utf8')
        .replace("'use strict';", "'use strict';\n// Non-executable facade documentation.\n;")
        .replace("'./internal/collection'", "'./internal/collection.js'")
    );
    const result = build();
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(
      allFormatValues(root, { a: 3 }),
      Array.from({ length: 6 }, () => [3])
    );
  }));

test('supported ES2017 lowering preserves optional access, nullish values and object spread', () =>
  fixture((root, build) => {
    const file = path.join(root, 'src/internal/collection.js');
    fs.writeFileSync(
      file,
      fs
        .readFileSync(file, 'utf8')
        .replace(
          'function values(obj) {',
          "function values(obj) {\n  return [{ ...{ value: obj?.value ?? 'fallback' } }];"
        )
    );
    const result = build();
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(
      allFormatValues(root, null),
      Array.from({ length: 6 }, () => [{ value: 'fallback' }])
    );
    assert.deepEqual(
      allFormatValues(root, { value: 0 }),
      Array.from({ length: 6 }, () => [{ value: 0 }])
    );
    const generated = fs.readFileSync(path.join(root, 'package/src/internal/collection.js'), 'utf8');
    assert.equal(generated.includes('obj?.value'), false, 'Optional access must be lowered in the CJS package');
    assert.equal(generated.includes('??'), false, 'Nullish coalescing must be lowered in the CJS package');
  }));

for (const binding of ['local', 'expression']) {
  test('static conversion preserves a function-valued require used as a ' + binding, () =>
    fixture((root, build) => {
      const file = path.join(root, 'src/internal/collection.js');
      const sourceText = fs.readFileSync(file, 'utf8');
      const invocation = binding === 'local' ? 'read' : "require('../get')";
      const changed = sourceText.replace(
        'function values(obj) {',
        `function values(obj) {\n  if (obj === null) return [${invocation}({ answer: 7 }, 'answer')];`
      );
      fs.writeFileSync(file, (binding === 'local' ? "const read = require('../get');\n" : '') + changed);
      const result = build();
      assert.ifError(result.error);
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(
        allFormatValues(root, null),
        Array.from({ length: 6 }, () => [7])
      );
    })
  );
}

test('static conversion preserves an object-valued require used inside an expression', () =>
  fixture((root, build) => {
    const file = path.join(root, 'src/internal/collection.js');
    fs.writeFileSync(
      file,
      fs
        .readFileSync(file, 'utf8')
        .replace(
          'function values(obj) {',
          "function values(obj) {\n  if (obj === null) return [require('./path').get({ answer: 8 }, 'answer')];"
        )
    );
    const result = build();
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(
      allFormatValues(root, null),
      Array.from({ length: 6 }, () => [8])
    );
  }));

for (const [name, specifier, file, diagnostic] of [
  ['external package', 'node:os', null, /External runtime dependency/],
  ['source-tree escape', '../outside-source', 'outside-source.js', /escapes the source tree/]
]) {
  test('direct re-exports reject a ' + name + ' before replacing the consumer package', () =>
    fixture((root, build) => {
      if (file) fs.writeFileSync(path.join(root, file), 'exports.values = function values() { return []; };\n');
      fs.writeFileSync(
        path.join(root, 'src/values.js'),
        `module.exports = require('${specifier}').${file ? 'values' : 'cpus'};\n`
      );
      const result = build();
      assert.ifError(result.error);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, diagnostic);
      assert.equal(fs.readFileSync(path.join(root, 'package/previous.txt'), 'utf8'), 'package');
      assert.deepEqual(
        fs.readdirSync(root).filter((name) => name.startsWith('.go-objects-build-')),
        []
      );
    })
  );
}

test('a first-generation failure leaves no consumer package or staging directory', () =>
  fixture((root, build) => {
    fs.rmSync(path.join(root, 'package'), { recursive: true });
    const result = build('generate');
    assert.ifError(result.error);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Injected generation failure/);
    assert.equal(fs.existsSync(path.join(root, 'package')), false);
    assert.deepEqual(
      fs.readdirSync(root).filter((name) => name.startsWith('.go-objects-build-')),
      []
    );
    preserved(root);
  }));

test('failure to save the previous package preserves the original in place', () =>
  fixture((root, build) => {
    fs.appendFileSync(
      path.join(root, 'inject.cjs'),
      `\nconst move = fs.renameSync;
fs.renameSync = function(from, to) {
  if (from === path.join(__dirname, 'package')) throw Error('Injected save failure');
  return Reflect.apply(move, this, [from, to]);
};\n`
    );
    const result = build();
    assert.ifError(result.error);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Injected save failure/);
    assert.equal(fs.readFileSync(path.join(root, 'package/previous.txt'), 'utf8'), 'package');
    assert.deepEqual(
      fs.readdirSync(root).filter((name) => name.startsWith('.go-objects-build-')),
      []
    );
    preserved(root);
  }));

test('post-install backup cleanup failure reports the retained backup and keeps the validated package', () =>
  fixture((root, build) => {
    fs.appendFileSync(
      path.join(root, 'inject.cjs'),
      `\nconst erase = fs.rmSync;
fs.rmSync = function(file, options) {
  if (path.dirname(file) === __dirname && path.basename(file).endsWith('-previous'))
    throw Error('Injected backup cleanup failure');
  return Reflect.apply(erase, this, [file, options]);
};\n`
    );
    const result = build();
    assert.ifError(result.error);
    assert.notEqual(result.status, 0, 'A cleanup failure must not be reported as a completed build');
    assert.match(result.stderr, /Build installed, but previous output cleanup failed/);
    const backups = fs.readdirSync(root).filter((name) => name.startsWith('.go-objects-build-'));
    assert.equal(backups.length, 1);
    assert.equal(backups[0].endsWith('-previous'), true);
    assert.equal(result.stderr.includes(path.join(root, backups[0])), true);
    assert.equal(fs.readFileSync(path.join(root, backups[0], 'package/previous.txt'), 'utf8'), 'package');
    assert.deepEqual(
      allFormatValues(root, { a: 9 }),
      Array.from({ length: 6 }, () => [9])
    );
    preserved(root);
  }));

test('build preserves nested local experiments and excludes them from consumer files', () =>
  fixture((root, build) => {
    const experiments = [
      'src/temp/invalid.js',
      'src/.tmp/invalid.js',
      'src/internal/temp/invalid.js',
      'src/internal/.tmp/invalid.js',
      'types/temp/invalid.d.ts',
      'types/.tmp/invalid.d.ts',
      'types/nested/temp/invalid.d.ts',
      'types/nested/.tmp/invalid.d.ts'
    ];
    for (const file of experiments) {
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      fs.writeFileSync(path.join(root, file), 'local experiment: not valid JavaScript or TypeScript');
    }
    const result = build();
    assert.equal(result.status, 0, result.error?.message || result.stderr || result.stdout);
    for (const file of experiments)
      assert.equal(
        fs.readFileSync(path.join(root, file), 'utf8'),
        'local experiment: not valid JavaScript or TypeScript'
      );
    const files = fs.readdirSync(path.join(root, 'package'), { recursive: true });
    assert.ok(files.includes(path.join('src', 'internal', 'path.js')));
    assert.ok(files.includes(path.join('types', 'api.d.ts')));
    assert.ok(!files.some((file) => file.split(path.sep).some((segment) => ['temp', '.tmp'].includes(segment))));
  }));

test('browser source maps locate actual readable and minified exceptions', () =>
  fixture((root, build) => {
    const file = path.join(root, 'src/internal/collection.js');
    fs.writeFileSync(
      file,
      fs
        .readFileSync(file, 'utf8')
        .replace(
          'function values(obj) {',
          "function values(obj) {\n  if (obj === null) throw new Error('source-map-probe');"
        )
    );
    const result = build();
    assert.equal(result.status, 0, result.stderr || result.stdout);
    // Read maps with the compiler's declared source-map dependency.
    const { createRequire } = require('node:module');
    const { SourceMapConsumer } = createRequire(require.resolve('terser'))('@jridgewell/source-map');
    const vm = require('node:vm');
    for (const filename of ['go-objects.js', 'go-objects.min.js']) {
      const source = fs.readFileSync(path.join(root, 'package/dist', filename), 'utf8');
      const map = JSON.parse(fs.readFileSync(path.join(root, 'package/dist', filename + '.map'), 'utf8'));
      const context = {};
      vm.runInNewContext(source, context, { filename });
      let thrown;
      try {
        context.Objects.values(null);
      } catch (error) {
        thrown = error;
      }
      assert.equal(thrown?.message, 'source-map-probe');
      const location = thrown.stack.match(new RegExp(filename.replaceAll('.', '\\.') + ':(\\d+):(\\d+)'));
      assert.ok(location, thrown.stack);
      function checkMap(candidate) {
        const consumer = new SourceMapConsumer(candidate);
        const original = consumer.originalPositionFor({ line: Number(location[1]), column: Number(location[2]) - 1 });
        assert.ok(original.source, filename + ' exception has no original location');
        const line = consumer.sourceContentFor(original.source).split(/\r?\n/)[original.line - 1];
        assert.ok(line.includes('source-map-probe'), filename + ' maps to the wrong source: ' + line);
      }
      checkMap(map);
      const corrupted = {
        ...map,
        sourcesContent: map.sourcesContent.map((content) => content.replaceAll('source-map-probe', 'damaged-map'))
      };
      assert.throws(() => checkMap(corrupted), /wrong source/);
    }
  }));

for (const mode of ['', 'preserve', 'replace', 'rollback'])
  test('package experiments survive ' + (mode || 'successful replacement'), () =>
    fixture((root, build) => {
      const names = ['temp/notes.txt', 'dist/.tmp/notes.txt', 'obsolete/nested/temp/notes.txt'];
      for (const name of names) {
        const file = path.join(root, 'package', name);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, 'local experiment: ' + name);
      }
      const result = build(mode);
      assert.ifError(result.error);
      if (mode) assert.notEqual(result.status, 0);
      else assert.equal(result.status, 0, result.stderr);
      const directory =
        mode === 'rollback'
          ? path.join(
              root,
              fs.readdirSync(root).find((name) => name.endsWith('-previous')),
              'package'
            )
          : path.join(root, 'package');
      for (const name of names)
        assert.equal(fs.readFileSync(path.join(directory, name), 'utf8'), 'local experiment: ' + name);
    })
  );

test('packing excludes preserved package experiments from the installed candidate', () =>
  fixture((root) => {
    const names = ['temp/notes.txt', 'dist/.tmp/notes.txt', 'src/temp/invalid.js', 'types/.tmp/invalid.d.ts'];
    for (const name of names) {
      const file = path.join(root, 'package', name);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, 'local experiment: ' + name);
    }
    const result = spawnSync(process.execPath, ['scripts/pack-package.js'], {
      cwd: root,
      encoding: 'utf8',
      timeout: 60000,
      env: { ...process.env, NODE_PATH: path.join(source, 'node_modules') }
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    for (const name of names)
      assert.equal(fs.readFileSync(path.join(root, 'package', name), 'utf8'), 'local experiment: ' + name);
    const archive = path.join(root, 'artifacts', 'go-objects-' + require('../package.json').version + '.tgz');
    const consumer = path.join(root, 'consumer');
    fs.mkdirSync(consumer);
    fs.writeFileSync(path.join(consumer, 'package.json'), '{"private":true}');
    require('./consumer-tools').npm(
      ['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false', archive],
      consumer
    );
    const installed = path.join(consumer, 'node_modules/go-objects');
    assert.ok(
      !fs
        .readdirSync(installed, { recursive: true })
        .some((file) => file.split(path.sep).some((part) => part === 'temp' || part === '.tmp'))
    );
    assert.equal(require(installed).get({ answer: 42 }, 'answer'), 42);
  }));

test('artifact and ESM discovery ignore retained package experiments', () =>
  fixture((root, build) => {
    for (const name of ['get.d.ts', 'obsolete.d.ts']) fs.unlinkSync(path.join(root, 'src', name));
    const file = path.join(root, 'package/esm/temp/experiment.mjs');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'module.exports = require("unfinished-local-experiment");');
    const result = build();
    assert.equal(result.status, 0, result.stderr);
    fs.mkdirSync(path.join(root, 'test'));
    fs.symlinkSync(path.join(source, 'node_modules'), path.join(root, 'node_modules'), 'junction');
    fs.cpSync(path.join(source, 'test/browser'), path.join(root, 'test/browser'), { recursive: true });
    fs.copyFileSync(path.join(source, 'test/esm-loading.test.js'), path.join(root, 'test/esm-loading.test.js'));
    for (const [pattern, script] of [
      ['all generated files', 'scripts/test-artifacts.js'],
      ['generated ESM is a static', 'test/esm-loading.test.js']
    ]) {
      const checked = spawnSync(
        process.execPath,
        ['--test', '--test-reporter=tap', '--test-name-pattern=' + pattern, script],
        {
          cwd: root,
          encoding: 'utf8',
          timeout: 30000,
          env: { ...process.env, NODE_TEST_CONTEXT: undefined, NODE_PATH: path.join(source, 'node_modules') }
        }
      );
      assert.ifError(checked.error);
      assert.equal(checked.status, 0, checked.stdout + checked.stderr);
      assert.match(checked.stdout, /# tests 1\b/);
      assert.match(checked.stdout, /# pass 1\b/);
    }
    assert.equal(fs.readFileSync(file, 'utf8'), 'module.exports = require("unfinished-local-experiment");');
  }));

test('reserved directory links and nested junctions survive rebuilding without copying their targets', () =>
  fixture((root, build) => {
    const target = path.join(root, 'local-data');
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, 'notes.txt'), 'local junction target');
    fs.mkdirSync(path.join(root, 'package/temp'));
    for (const name of ['package/.tmp', 'package/temp/nested-link'])
      fs.symlinkSync(target, path.join(root, name), 'junction');
    // This target is inside the old package: it must be classified before that tree moves.
    fs.mkdirSync(path.join(root, 'package/temp/data'));
    fs.writeFileSync(path.join(root, 'package/temp/data/inside.txt'), 'inside package');
    fs.symlinkSync(path.join(root, 'package/temp/data'), path.join(root, 'package/temp/internal-link'), 'junction');
    const result = build();
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    for (const name of ['package/.tmp', 'package/temp/nested-link']) {
      assert.ok(fs.lstatSync(path.join(root, name)).isSymbolicLink());
      assert.equal(fs.realpathSync(path.join(root, name)), fs.realpathSync(target));
      assert.equal(fs.readFileSync(path.join(root, name, 'notes.txt'), 'utf8'), 'local junction target');
    }
    assert.ok(fs.lstatSync(path.join(root, 'package/temp/internal-link')).isSymbolicLink());
    assert.equal(fs.readFileSync(path.join(root, 'package/temp/internal-link/inside.txt'), 'utf8'), 'inside package');
    assert.equal(fs.readFileSync(path.join(target, 'notes.txt'), 'utf8'), 'local junction target');
  }));
