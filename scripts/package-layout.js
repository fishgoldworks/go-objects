'use strict';
const fs = require('node:fs'),
  path = require('node:path');
const root = path.resolve(__dirname, '..'),
  packageRoot = path.join(root, 'package');
// Local experiments are never build or consumer inputs, at any nesting depth.
const isTemporaryPath = (file) => file.split(/[\\/]/).some((part) => part === 'temp' || part === '.tmp');
const consumerEngines = { node: '>=8.0.0' };
const consumerFiles = [
  'index.js',
  'index.d.ts',
  'index.d.mts',
  'README.md',
  'CHANGELOG.md',
  'LICENSE.md',
  'docs/API.md',
  'docs/MIGRATION.md'
];
function consumerManifest(names) {
  const metadata = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const manifest = {};
  for (const key of [
    'name',
    'description',
    'author',
    'email',
    'version',
    'license',
    'keywords',
    'homepage',
    'repository',
    'type'
  ])
    manifest[key] = metadata[key];
  manifest.engines = consumerEngines;
  manifest.files = ['src', 'esm', 'dist', 'types', '*.js', 'index.mjs', ...consumerFiles];
  // Consumer bundlers may omit unused modules; importing the library requires no setup.
  manifest.sideEffects = ['./dist/go-objects.js', './dist/go-objects.min.js'];
  manifest.unpkg = 'dist/go-objects.min.js';
  manifest.jsdelivr = 'dist/go-objects.min.js';
  manifest.main = './index.js';
  manifest.module = './index.mjs';
  manifest.types = './index.d.ts';
  manifest.typesVersions = {
    '*': {
      'src/*.js': ['src/*.d.ts'],
      'src/*': ['src/*.d.ts'],
      'dist/go-objects.js': ['dist/go-objects.d.ts'],
      'dist/go-objects.min.js': ['dist/go-objects.d.ts'],
      'dist/go-objects.mjs': ['dist/go-objects.d.mts'],
      'index.d.ts': ['index.d.ts'],
      'esm/*.mjs': ['esm/*.d.mts'],
      '*': ['src/*.d.ts']
    }
  };
  manifest.exports = {
    '.': {
      import: { types: './index.d.mts', default: './index.mjs' },
      require: { types: './index.d.ts', default: './index.js' }
    },
    './package.json': './package.json'
  };
  // Explicit mappings support Node 12.17's conditional exports as well as modern Node.
  for (const name of names)
    for (const suffix of [name, 'src/' + name, 'src/' + name + '.js'])
      manifest.exports['./' + suffix] = {
        import: { types: './esm/' + name + '.d.mts', default: './esm/' + name + '.mjs' },
        require: { types: './src/' + name + '.d.ts', default: './src/' + name + '.js' }
      };
  for (const name of names)
    manifest.exports['./esm/' + name + '.mjs'] = {
      types: './esm/' + name + '.d.mts',
      default: './esm/' + name + '.mjs'
    };
  for (const name of ['js', 'mjs'])
    manifest.exports['./dist/go-objects.' + name] = {
      types: './dist/go-objects.d.' + (name === 'js' ? 'ts' : 'mts'),
      default: './dist/go-objects.' + name
    };
  manifest.exports['./dist/go-objects.min.js'] = {
    types: './dist/go-objects.d.ts',
    default: './dist/go-objects.min.js'
  };
  for (const file of ['go-objects.js.map', 'go-objects.min.js.map'])
    manifest.exports['./dist/' + file] = './dist/' + file;
  // Node 13.0 understands export arrays but predates conditional export objects.
  // Keep its CommonJS target as a fallback after modern import/require conditions.
  for (const key of Object.keys(manifest.exports)) {
    const entry = manifest.exports[key];
    if (entry && typeof entry === 'object')
      manifest.exports[key] = [entry, entry.require ? entry.require.default : entry.default];
  }
  // Order only manifest fields; nested conditions and fallback arrays retain their precedence.
  for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
    if (manifest[field])
      manifest[field] = Object.fromEntries(Object.entries(manifest[field]).sort(([a], [b]) => a.localeCompare(b)));
  }
  const fields = [
    'name',
    'version',
    'description',
    'license',
    'author',
    'contributors',
    'email',
    'keywords',
    'homepage',
    'repository',
    'bugs',
    'funding',
    'type',
    'engines',
    'main',
    'module',
    'browser',
    'types',
    'typesVersions',
    'exports',
    'imports',
    'bin',
    'unpkg',
    'jsdelivr',
    'files',
    'sideEffects',
    'publishConfig',
    'dependencies',
    'optionalDependencies',
    'peerDependencies',
    'peerDependenciesMeta'
  ];
  return Object.fromEntries(
    fields.filter((field) => manifest[field] !== undefined).map((field) => [field, manifest[field]])
  );
}
module.exports = { root, packageRoot, consumerFiles, consumerEngines, consumerManifest, isTemporaryPath };
