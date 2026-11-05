'use strict';
// Validate declarations as an actual consumer: no source aliases or skipLibCheck.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const { assertCompleted } = require('./consumer-tools');
let compiler;
try {
  compiler = require.resolve('typescript/bin/tsc');
} catch {
  console.error('TypeScript is a development dependency. Run npm ci before npm run test:types.');
  process.exit(1);
}
function run(args, cwd) {
  const result = spawnSync(process.execPath, args, { cwd, encoding: 'utf8', timeout: 60000 });
  if (result.status !== 0)
    throw new Error(result.error?.message || result.stdout || result.stderr || 'Command failed.');
  return result.stdout;
}
function npm(args, cwd) {
  const bin = path.dirname(process.execPath);
  const cli = [
    process.env.npm_execpath,
    path.resolve(bin, '../lib/node_modules/npm/bin/npm-cli.js'),
    path.resolve(bin, 'node_modules/npm/bin/npm-cli.js')
  ].find((file) => file && fs.existsSync(file));
  if (!cli) throw new Error('Cannot locate npm CLI; run this check through npm run test:types.');
  return run([cli, ...args], cwd);
}
const args = process.argv.slice(2);
let packageDirectory;
for (let index = 0; index < args.length;) {
  if (!['--compiler', '--package'].includes(args[index])) {
    index++;
    continue;
  }
  const flag = args[index],
    value = args[index + 1];
  if (!value || value.startsWith('--')) throw Error(flag + ' requires a path');
  if (flag === '--compiler') compiler = path.resolve(value);
  else packageDirectory = path.resolve(value);
  args.splice(index, 2);
}
const compilerVersion = run([compiler, '--version'], root).trim();
const [major, minor] = compilerVersion.replace('Version ', '').split('.').map(Number);
const inferredGuards = major > 5 || (major === 5 && minor >= 5);
console.log(compilerVersion);
const options = require('./consumer-tools').parseConsumerArgs(args, true);
if (packageDirectory && options.tarball) throw Error('Use --package or --tarball, not both.');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'go-objects-types-'));
const reports = [];
try {
  const tarball = packageDirectory ? null : options.tarball || require('./pack-package')(temp);
  const archive = { filename: tarball ? path.basename(tarball) : null };
  const consumer = path.join(temp, 'consumer');
  fs.mkdirSync(consumer);
  fs.writeFileSync(path.join(consumer, 'package.json'), '{"name":"go-objects-types-consumer","private":true}');
  if (packageDirectory)
    fs.cpSync(packageDirectory, path.join(consumer, 'node_modules/go-objects'), { recursive: true });
  else npm(['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', tarball], consumer);
  fs.cpSync(path.join(root, 'test/types'), path.join(consumer, 'test/types'), {
    recursive: true,
    filter: (file) => !require('./package-layout').isTemporaryPath(path.relative(root, file))
  });
  const snippets = ['README.md', 'docs/API.md', 'docs/MIGRATION.md'].flatMap((file) => [
    ...fs
      .readFileSync(path.join(consumer, 'node_modules/go-objects', file), 'utf8')
      .matchAll(/\x60\x60\x60typescript\r?\n([\s\S]*?)\r?\n\x60\x60\x60/g)
  ]);
  assert.ok(snippets.length > 0, 'Published TypeScript examples must remain covered');
  const snippetFiles = snippets.map((match, index) => {
    const name = 'test/types/readme-' + index + '.mts';
    fs.writeFileSync(path.join(consumer, name), match[1]);
    return name;
  });
  const subpaths = [
    "import type * as API from 'go-objects';",
    'type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;',
    'type Assert<T extends true> = T;'
  ];
  for (const name of Object.keys(require(path.join(consumer, 'node_modules/go-objects')))) {
    const paths = [name, 'src/' + name, 'src/' + name + '.js', 'esm/' + name + '.mjs'];
    for (const [index, suffix] of paths.entries()) {
      const id = name + '_' + index;
      subpaths.push(
        `import default_${id}, { ${name} as named_${id} } from 'go-objects/${suffix}';`,
        `type Named_${id} = Assert<Equal<typeof named_${id}, typeof API.${name}>>;`,
        `type Default_${id} = Assert<Equal<typeof default_${id}, typeof API.${name}>>;`
      );
    }
  }
  fs.writeFileSync(path.join(consumer, 'test/types/subpath-exports.mts'), subpaths.join('\n'));
  const base = {
    target: 'ES2022',
    strict: true,
    noEmit: true,
    skipLibCheck: false,
    exactOptionalPropertyTypes: true,
    noUncheckedIndexedAccess: true,
    types: []
  };
  const cases = [
    [
      'NodeNext (CJS and ESM)',
      { module: 'NodeNext', moduleResolution: 'NodeNext' },
      [
        'test/types/consumer.cts',
        'test/types/consumer.mts',
        'test/types/all-exports.cts',
        'test/types/all-exports.mts',
        ...snippetFiles
      ]
    ],
    [
      'Node16 (CJS and ESM)',
      { module: 'Node16', moduleResolution: 'Node16' },
      ['test/types/consumer.cts', 'test/types/consumer.mts', 'test/types/all-exports.cts', 'test/types/all-exports.mts']
    ],
    [
      'Bundler (ESM)',
      { module: 'ESNext', moduleResolution: 'Bundler' },
      ['test/types/consumer.mts', 'test/types/all-exports.mts', ...snippetFiles]
    ],
    ['Legacy Node/CommonJS', { module: 'CommonJS', moduleResolution: 'Node10' }, ['test/types/legacy.ts']],
    [
      'NodeNext (default optional semantics)',
      { module: 'NodeNext', moduleResolution: 'NodeNext', exactOptionalPropertyTypes: false },
      [
        'test/types/default-optional.cts',
        'test/types/default-optional.mts',
        'test/types/nested-immutable-deletion.cts',
        'test/types/nested-immutable-deletion.mts'
      ]
    ],
    ['UMD browser global', { module: 'CommonJS', moduleResolution: 'Node10' }, ['test/types/browser-global.ts']],
    [
      'ES2017 libraries without DOM or Node ambient types',
      { module: 'NodeNext', moduleResolution: 'NodeNext', target: 'ES2017', lib: ['ES2017'] },
      [
        'test/types/all-exports.cts',
        'test/types/all-exports.mts',
        'test/types/read-transform-contracts.cts',
        'test/types/read-transform-contracts.mts'
      ]
    ]
  ];
  for (const [name, options, files] of cases) {
    if (files.some((file) => file.endsWith('.mts'))) files.push('test/types/subpath-exports.mts');
    if (inferredGuards && name.startsWith('Node')) files.push('test/types/inferred-guards.cts');
    if (name.startsWith('Node')) files.push('test/types/mutation-contracts.cts', 'test/types/mutation-contracts.mts');
    if (name.startsWith('Bundler')) files.push('test/types/mutation-contracts.mts');
    if (name.startsWith('Legacy')) files.push('test/types/mutation-contracts.cts');
    if (name.startsWith('Node'))
      files.push('test/types/read-transform-contracts.cts', 'test/types/read-transform-contracts.mts');
    if (name.startsWith('Bundler')) files.push('test/types/read-transform-contracts.mts');
    if (name.startsWith('Legacy')) files.push('test/types/read-transform-contracts.cts');
    if (name.startsWith('Node'))
      files.push(
        'test/types/matcher-callbacks.cts',
        'test/types/matcher-callbacks.mts',
        'test/types/callback-receivers.cts',
        'test/types/callback-receivers.mts'
      );
    if (name.startsWith('Bundler')) files.push('test/types/matcher-callbacks.mts', 'test/types/callback-receivers.mts');
    if (name.startsWith('Legacy')) files.push('test/types/callback-receivers.cts');
    if (name.startsWith('Node') && options.exactOptionalPropertyTypes !== false)
      files.push(
        'test/types/regressions.cts',
        'test/types/regressions.mts',
        'test/types/scenarios.cts',
        'test/types/scenarios.mts',
        'test/types/key-domain-regressions.cts',
        'test/types/key-domain-regressions.mts',
        'test/types/dictionary-and-merge.cts',
        'test/types/dictionary-and-merge.mts',
        'test/types/nested-immutable-deletion.cts',
        'test/types/nested-immutable-deletion.mts'
      );
    if (name.startsWith('Bundler'))
      files.push(
        'test/types/regressions.mts',
        'test/types/scenarios.mts',
        'test/types/key-domain-regressions.mts',
        'test/types/dictionary-and-merge.mts',
        'test/types/nested-immutable-deletion.mts'
      );
    fs.writeFileSync(
      path.join(consumer, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { ...base, ...options }, files }, null, 2)
    );
    run([compiler, '-p', 'tsconfig.json'], consumer);
    reports.push({ name, passed: true, files: files.length });
    console.log('PASS ' + name);
  }
  fs.writeFileSync(
    path.join(consumer, 'tsconfig.runtime.json'),
    JSON.stringify(
      {
        compilerOptions: {
          ...base,
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          noEmit: false,
          outDir: 'runtime'
        },
        files: ['test/types/runtime.cts']
      },
      null,
      2
    )
  );
  run([compiler, '-p', 'tsconfig.runtime.json'], consumer);
  assertCompleted(
    run([path.join(consumer, 'runtime/runtime.cjs')], consumer),
    'TypeScript runtime regression fixture completed',
    'Emitted TypeScript runtime regression fixture'
  );
  console.log('PASS emitted TypeScript runtime regression fixture');
  const report = {
    tarball,
    runtimeFixture: true,
    compiler: run([compiler, '--version'], root).trim(),
    package: archive.filename,
    packedConsumer: !packageDirectory,
    packageDirectory,
    documentationExamples: snippets.length,
    cases: reports
  };
  if (options.output) {
    const output = options.output;
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  }
  console.log('All ' + reports.length + ' strict consumer configurations passed.');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
