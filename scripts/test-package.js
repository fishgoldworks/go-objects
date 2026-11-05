'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const { assertCompleted } = require('./consumer-tools');
const options = require('./consumer-tools').parseConsumerArgs(process.argv.slice(2));
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, 0, result.error?.message || result.stderr || result.stdout);
  return result.stdout;
}
function npm(args, cwd = root) {
  const bin = path.dirname(process.execPath);
  const cli = [
    process.env.npm_execpath,
    path.resolve(bin, '../lib/node_modules/npm/bin/npm-cli.js'),
    path.resolve(bin, 'node_modules/npm/bin/npm-cli.js')
  ].find((file) => file && fs.existsSync(file));
  return cli
    ? run(process.execPath, [cli, ...args], cwd)
    : run(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, cwd);
}
test('packed archive installs offline and resolves public imports', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'go-objects-package-'));
  try {
    const tarball = options.tarball || require('./pack-package')(temp);
    const consumer = path.join(temp, 'consumer');
    fs.mkdirSync(consumer);
    fs.writeFileSync(path.join(consumer, 'package.json'), '{"name":"consumer","private":true}');
    npm(
      ['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false', tarball],
      consumer
    );
    const installed = path.join(consumer, 'node_modules/go-objects');
    const manifest = JSON.parse(fs.readFileSync(path.join(installed, 'package.json'), 'utf8'));
    assert.equal(manifest.scripts, undefined, 'Consumer package must not inherit lifecycle tooling');
    assert.equal(manifest.devDependencies, undefined, 'Consumer package must not inherit build dependencies');
    assert.deepEqual(Object.keys(manifest.dependencies || {}), [], 'Consumer package must remain dependency-free');
    const info = {
      version: manifest.version,
      files: fs
        .readdirSync(installed, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => ({
          path: path.relative(installed, path.join(entry.parentPath, entry.name)).split(path.sep).join('/')
        }))
    };
    assert.equal(info.version, require('../package.json').version);
    assert.ok(info.files.some((f) => f.path === 'dist/go-objects.js'));
    const packedPaths = new Set(info.files.map((file) => file.path));
    const names = Object.keys(require(root));
    const sources = fs
      .readdirSync(path.join(root, 'src'), { recursive: true })
      .filter((file) => file.endsWith('.js') && !require('./package-layout').isTemporaryPath(file))
      .map((file) => file.split(path.sep).join('/'));
    const expectedPaths = new Set([
      'package.json',
      ...require('./package-layout').consumerFiles,
      'types/api.d.ts',
      'index.mjs',
      ...['js', 'js.map', 'min.js', 'min.js.map', 'mjs', 'd.ts', 'd.mts'].map(
        (extension) => 'dist/go-objects.' + extension
      ),
      ...sources.map((file) => 'src/' + file),
      ...sources.map((file) => 'esm/' + file.replace(/\.js$/, '.mjs')),
      ...names.flatMap((name) => [name + '.js', 'src/' + name + '.d.ts', 'esm/' + name + '.d.mts'])
    ]);
    assert.deepEqual(
      [...packedPaths].sort(),
      [...expectedPaths].sort(),
      'Consumer file inventory must match the explicit generated layout'
    );

    for (const required of [
      'index.js',
      'index.mjs',
      'index.d.ts',
      'index.d.mts',
      'types/api.d.ts',
      'dist/go-objects.js',
      'dist/go-objects.mjs',
      'dist/go-objects.d.ts',
      'dist/go-objects.d.mts',
      'README.md',
      'docs/API.md',
      'docs/MIGRATION.md',
      'CHANGELOG.md',
      'LICENSE.md'
    ])
      assert.ok(packedPaths.has(required), 'Missing package file: ' + required);
    require('./docs.js').validateLinks(root);
    for (const file of info.files) {
      assert.match(
        file.path,
        /^(?:[a-zA-Z]+\.js|package\.json|README\.md|docs\/(?:API|MIGRATION)\.md|CHANGELOG\.md|LICENSE\.md|index\.(?:js|mjs|d\.ts|d\.mts)|src\/(?:internal\/)?[\w-]+\.(?:js|d\.ts)|esm\/(?:internal\/)?[\w-]+\.(?:mjs|d\.mts)|types\/api\.d\.ts|dist\/go-objects\.(?:js|js\.map|min\.js|min\.js\.map|mjs|d\.ts|d\.mts))$/,
        'Unexpected package file: ' + file.path
      );
      assert.ok(
        !/^(test|scripts|benchmarks|coverage|node_modules|nbproject|\.git|\.github)\//.test(file.path),
        file.path
      );
      assert.ok(!/(^|\/)(temp|\.tmp|fonts|node_modules|coverage|nbproject|\.git)(\/|$)/.test(file.path), file.path);
    }
    assert.equal(packedPaths.has('src/ObjectWrapper.d.ts'), false);
    assert.equal(packedPaths.has('esm/ObjectWrapper.d.mts'), false);
    for (const file of info.files)
      assert.deepEqual(
        fs.readFileSync(path.join(installed, file.path)),
        fs.readFileSync(path.join(root, 'package', file.path)),
        'Installed bytes: ' + file.path
      );
    require('./docs.js').validateLinks(installed);
    require('./lib/check-library-readme.cjs')(
      fs.readFileSync(path.join(installed, 'README.md'), 'utf8'),
      'Installed README'
    );
    require('./test-examples.js').runAll(installed, consumer);
    const cjsOutput = run(
      process.execPath,
      [
        '-e',
        `const assert=require('node:assert/strict');const O=require('go-objects');assert.equal(O.get({x:3},'x'),3);for(const [name,fn] of Object.entries(O))for(const spec of ['go-objects/'+name,'go-objects/src/'+name,'go-objects/src/'+name+'.js'])assert.equal(require(spec),fn,spec);for(const spec of ['go-objects/internal/path','go-objects/src/internal/path','go-objects/ObjectWrapper','go-objects/src/ObjectWrapper'])assert.throws(()=>require(spec),e=>e&&e.code==='ERR_PACKAGE_PATH_NOT_EXPORTED',spec);assert.equal(require('go-objects/package.json').version,${JSON.stringify(require('../package.json').version)});console.log('go-objects installed CommonJS imports completed');`
      ],
      consumer
    );
    assertCompleted(cjsOutput, 'go-objects installed CommonJS imports completed', 'Installed CommonJS imports');
    const script = path.join(consumer, 'esm.mjs');
    fs.writeFileSync(
      script,
      `import O,{get,deepClone} from 'go-objects';if(get({x:3},'x')!==3||O.deepClone!==deepClone)throw new Error('ESM import failed');for(const [name,fn] of Object.entries(O))for(const spec of ['go-objects/'+name,'go-objects/src/'+name,'go-objects/src/'+name+'.js','go-objects/esm/'+name+'.mjs']){const imported=await import(spec);if(imported.default!==fn||imported[name]!==fn)throw new Error(spec);}for(const spec of ['go-objects/esm/internal/path.mjs','go-objects/esm/ObjectWrapper.mjs']){try{await import(spec);throw new Error('internal import succeeded: '+spec);}catch(error){if(error.code!=='ERR_PACKAGE_PATH_NOT_EXPORTED')throw error;}}if(O.has({a:undefined},'a')!==true)throw new Error('New API failed');console.log('go-objects installed ESM imports completed');`
    );
    assertCompleted(
      run(process.execPath, [script], consumer),
      'go-objects installed ESM imports completed',
      'Installed ESM imports'
    );
    console.log('Verified installed package: ' + tarball);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
