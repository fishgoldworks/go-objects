'use strict';
// Bounded mutation checks, not a general-purpose/exhaustive mutation engine.
// Every fault is applied in a disposable copy. Source files in this checkout are never changed.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const definitions = [
  [
    'Error brand guard disabled',
    'src/internal/clone.js',
    'if (!genuineError(input)) return unsupported(input);',
    'if (false) return unsupported(input);',
    'test/error-brand-and-array-prototypes.test.js'
  ],
  [
    'Error @@toStringTag spoof guard disabled',
    'src/internal/clone.js',
    'if (inspected.has(node) || Object.getOwnPropertyDescriptor(node, Symbol.toStringTag)) return false;',
    'if (inspected.has(node)) return false;',
    'test/error-brand-and-array-prototypes.test.js'
  ],
  [
    'clone ignores tags above the immediate Error prototype',
    'src/internal/clone.js',
    'for (let node = value; node !== null; node = Object.getPrototypeOf(node)) {',
    'for (let node = value; node !== null; node = node === value ? Object.getPrototypeOf(node) : null) {',
    'test/inherited-error-tags.test.js'
  ],
  [
    'wrapper factory mistakes an existing receiver for construction',
    'src/ObjectWrapper.js',
    'if (!new.target) return new ObjectWrapper(value);',
    'if (!(this instanceof ObjectWrapper)) return new ObjectWrapper(value);',
    'test/wrapper-contracts.test.js'
  ],
  [
    'null-prototype arrays are treated as opaque',
    'src/internal/clone.js',
    "if (proto === null) return 'Array';",
    "if (false) return 'Array';",
    'test/clone-buffer-aliases.test.js'
  ],
  [
    'unsupported backing buffers produce secretly shared views',
    'src/internal/clone.js',
    " || kindOf(buffer) !== 'ArrayBuffer'",
    '',
    'test/clone-buffer-aliases.test.js'
  ],
  [
    'clone accepts altered native prototype chains',
    'src/internal/clone.js',
    'return prototype && prototype.value === proto ? kind : undefined;',
    'return kind;',
    'test/native-prototypes-and-exports.test.js'
  ],
  [
    'clone accepts altered Array prototype chains',
    'src/internal/clone.js',
    "return c.isNativeArrayPrototype(proto) ? 'Array' : undefined;",
    "return 'Array';",
    'test/native-prototypes-and-exports.test.js'
  ],
  [
    'clone accepts altered Buffer prototype chains',
    'src/internal/clone.js',
    "return Object.getPrototypeOf(value) === Buffer.prototype ? 'Buffer' : undefined;",
    "return 'Buffer';",
    'test/native-prototypes-and-exports.test.js'
  ],
  [
    'SameValueZero drops NaN',
    'src/internal/common.js',
    'a === b || (a !== a && b !== b)',
    'a === b',
    'test/scenarios-properties.test.js'
  ],
  [
    'enumeration drops symbols',
    'src/internal/common.js',
    'if (Object.prototype.propertyIsEnumerable.call(value, key)) result.push(key);',
    'if (false) result.push(key);',
    'test/scenarios-properties.test.js'
  ],
  [
    'parser helpers expose cached segment storage',
    'src/internal/path.js',
    'return compile(path).slice();',
    'return compile(path);',
    'test/performance-regressions.test.js'
  ],
  [
    'cache accepts hash collisions as path matches',
    'src/internal/path.js',
    'if (cached !== undefined && cached.path === path)',
    'if (cached !== undefined)',
    'test/performance-regressions.test.js'
  ],
  [
    'map reuses input',
    'src/internal/collection.js',
    'const result = c.shape(obj);',
    'const result = obj;',
    'test/scenarios-surfaces.test.js'
  ],
  [
    'filter preserves rather than compacts array indices',
    'src/internal/collection.js',
    'Array.isArray(result) && c.indexKey(key) ? result.length : key',
    'key',
    'test/shallow.test.js'
  ],
  [
    'key collision guard disabled',
    'src/internal/collection.js',
    "if (mode === 'throw' && c.own(result, nextKey))",
    "if (false && mode === 'throw' && c.own(result, nextKey))",
    'test/scenarios-generated.test.js'
  ],
  [
    'hasProp ignores non-enumerable data',
    'src/internal/collection.js',
    'c.isObject(obj) && c.isKey(key) && c.own(obj, key)',
    'c.enumerable(obj, key)',
    'test/scenarios-properties.test.js'
  ],
  [
    'omit evaluates excluded getters',
    'src/internal/collection.js',
    'const excluded = new Set(c.keyList(list)),\n    result = c.record(obj);',
    'const excluded = new Set(c.keyList(list)), result = c.record(obj); for (const key of c.keys(obj)) void obj[key];',
    'test/query-and-update.test.js'
  ],
  [
    'constructor mutation guard removed',
    'src/internal/path.js',
    "['__proto__', 'constructor', 'prototype']",
    "['__proto__', 'prototype']",
    'test/scenarios-paths.test.js'
  ],
  [
    'path arrays are no longer validated or copied',
    'src/internal/path.js',
    'return Array.from(path, c.keyOf);',
    'return path;',
    'test/scenarios-paths.test.js'
  ],
  [
    'get follows inherited properties',
    'src/internal/path.js',
    '!c.own(value, key)',
    '!(key in value)',
    'test/scenarios-paths.test.js'
  ],
  [
    'has evaluates terminal getter',
    'src/internal/path.js',
    'if (i === segments.length - 1) return true;',
    'if (i === segments.length - 1) { void node[segments[i]]; return true; }',
    'test/query-and-update.test.js'
  ],
  [
    'update invokes callback twice',
    'src/internal/path.js',
    'const next = updater(previous);',
    'const next = (updater(previous), updater(previous));',
    'test/query-and-update.test.js'
  ],
  [
    'unset reports success without deleting',
    'src/internal/path.js',
    'if (!Reflect.deleteProperty(node, segments[segments.length - 1]))',
    'if (!true)',
    'test/scenarios-paths.test.js'
  ],
  [
    'writes ignore writable descriptor',
    'src/internal/common.js',
    "!own(descriptor, 'value') || !descriptor.writable",
    "!own(descriptor, 'value')",
    'test/scenarios-paths.test.js'
  ],
  [
    'immutable no-op uses strict equality',
    'src/internal/immutable.js',
    'Object.is(previous, next)',
    'previous === next',
    'test/scenarios-immutable.test.js'
  ],
  [
    'immutable copy truncates sparse trailing length',
    'src/internal/immutable.js',
    'new Array(node.length)',
    '[]',
    'test/scenarios-immutable.test.js'
  ],
  [
    'immutable accepts arbitrary array-object prototypes',
    'src/internal/immutable.js',
    'if (proto !== null && !c.isNativeArrayPrototype(proto)) {',
    'if (false) {',
    'test/error-brand-and-array-prototypes.test.js'
  ],
  [
    'immutable cross-realm arrays lose their realm prototype',
    'src/internal/immutable.js',
    'if (proto !== Array.prototype) Object.setPrototypeOf(output, proto);',
    'if (proto === null) Object.setPrototypeOf(output, proto);',
    'test/immutable.test.js'
  ],
  [
    'immutable cross-realm records lose their realm prototype',
    'src/internal/immutable.js',
    'output = Object.create(Object.getPrototypeOf(node));',
    'output = c.record(node);',
    'test/immutable.test.js'
  ],
  [
    'immutable writes lose enumerability',
    'src/internal/immutable.js',
    'enumerable: descriptor ? descriptor.enumerable : true',
    'enumerable: true',
    'test/scenarios-immutable.test.js'
  ],
  [
    'immutable copied properties remain readonly',
    'src/internal/immutable.js',
    'descriptor.writable = true;',
    'descriptor.writable = false;',
    'test/scenarios-immutable.test.js'
  ],
  [
    'depth cutoff off by one',
    'src/internal/traversal.js',
    'link.depth < options.maxDepth',
    'link.depth <= options.maxDepth',
    'test/scenarios-generated.test.js'
  ],
  [
    'root cycle expanded a second time',
    'src/internal/traversal.js',
    'new WeakSet([obj])',
    'new WeakSet()',
    'test/scenarios-deep.test.js'
  ],
  [
    'depth zero still reads values',
    'src/internal/traversal.js',
    'if (options.maxDepth === 0) return;',
    'if (false) return;',
    'test/scenarios-deep.test.js'
  ],
  [
    'last deep search short-circuits first match',
    'src/internal/deep.js',
    "if (mode !== 'last') return t.STOP;",
    'if (true) return t.STOP;',
    'test/scenarios-deep.test.js'
  ],
  [
    'deepMap descends through replacements',
    'src/internal/deep.js',
    'next === value && c.traversable(value)',
    'c.traversable(value)',
    'test/deep.test.js'
  ],
  [
    'preserved arrays rename structural indices',
    'src/internal/deep.js',
    "mode === 'keys' && config.arrays === 'preserve' && Array.isArray(current.node) && c.indexKey(key)",
    'false',
    'test/scenarios-deep.test.js'
  ],
  [
    'clone trusts Date prototype without native brand',
    'src/internal/clone.js',
    'let state;\n      try {\n        state = Date.prototype.getTime.call(input);\n      } catch {\n        return unsupported(input);\n      }',
    'let state; state = Date.prototype.getTime.call(input);',
    'test/native-brand-validation.test.js'
  ],
  [
    'clone reconnects seen values to originals',
    'src/internal/clone.js',
    'if (copies.has(input)) return copies.get(input);',
    'if (copies.has(input)) return input;',
    'test/scenarios-cloning.test.js'
  ],
  [
    'buffer clone shares original memory',
    'src/internal/clone.js',
    'return copy;',
    'return value;',
    'test/scenarios-cloning.test.js'
  ],
  [
    'shallow clone copies nested descriptors deeply',
    'src/internal/clone.js',
    "if (deep && c.own(descriptor, 'value'))",
    "if (c.own(descriptor, 'value'))",
    'test/scenarios-cloning.test.js'
  ],
  [
    'deep Map keys retain originals',
    'src/internal/clone.js',
    'deep ? allocate(key) : key',
    'key',
    'test/scenarios-generated.test.js'
  ],
  [
    'clone loses non-extensibility',
    'src/internal/clone.js',
    'if (!Object.isExtensible(input)) Object.preventExtensions(output);',
    'if (false) Object.preventExtensions(output);',
    'test/scenarios-cloning.test.js'
  ],
  [
    'wrapper queries do not advance the pipeline',
    'src/ObjectWrapper.js',
    'new ObjectWrapper(mutations.has(name) ? this._value : result)',
    'new ObjectWrapper(this._value)',
    'test/scenarios-surfaces.test.js'
  ],
  [
    'wrapper reuses mutable bookkeeping',
    'src/ObjectWrapper.js',
    'const next = new ObjectWrapper(mutations.has(name) ? this._value : result);',
    'const next = this;',
    'test/scenarios-surfaces.test.js'
  ]
];
// This is deliberately limited to Node's explicitly selected TAP reporter, not
// arbitrary TAP. Complete counts and the green baseline's test identities are
// needed: a file loader failure also emits "not ok", without running assertions.
function summariseTestRun(result, label, requireGreen = false) {
  if (result.error || result.signal || !Number.isInteger(result.status))
    throw new Error('Mutation check failed to execute: ' + label + ': ' + (result.error?.message || result.signal));
  const output = result.stdout || '';
  const counts = {};
  for (const name of ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo']) {
    const matches = [...output.matchAll(new RegExp('^# ' + name + ' (\\d+)$', 'gm'))];
    if (matches.length !== 1) throw new Error('Incomplete test summary: ' + label);
    counts[name] = Number(matches[0][1]);
  }
  const names = [...output.matchAll(/^(?:not )?ok \d+ - (.+)$/gm)].map((match) => match[1]);
  const plans = [...output.matchAll(/^1\.\.(\d+)$/gm)];
  if (
    plans.length !== 1 ||
    Number(plans[0][1]) !== names.length ||
    counts.tests === 0 ||
    counts.tests !== counts.pass + counts.fail + counts.cancelled
  )
    throw new Error('Incomplete test plan or summary: ' + label);
  if (counts.cancelled || counts.skipped || counts.todo || /^\s+failureType: 'testTimeoutFailure'$/m.test(output))
    throw new Error('Mutation run cancelled, skipped, todo or timed out: ' + label);
  if ((result.status === 0) !== (counts.fail === 0))
    throw new Error('Incomplete test exit/summary agreement: ' + label);
  if (requireGreen && counts.fail) throw new Error('Baseline is not green: ' + label);
  if (
    requireGreen &&
    names.length === 1 &&
    (names[0] === label || names[0].replaceAll('\\', '/').endsWith('/' + label.replaceAll('\\', '/')))
  )
    throw new Error('Baseline contains only a test-file wrapper, not registered tests: ' + label);
  return {
    names,
    total: counts.tests,
    failingTests: [...output.matchAll(/^not ok \d+ - (.+)$/gm)].map((match) => match[1])
  };
}
function compareMutation(result, baseline, label) {
  const actual = summariseTestRun(result, label);
  if (actual.total !== baseline.total || JSON.stringify(actual.names) !== JSON.stringify(baseline.names))
    throw new Error('Mutation test inventory changed or did not complete: ' + label);
  return { detected: result.status !== 0 && actual.failingTests.length > 0, failingTests: actual.failingTests };
}
module.exports = { summariseTestRun, compareMutation };
function main() {
  const destination = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'go-objects-mutation-report-')), 'results.json');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'go-objects-mutations-'));
  const records = [];
  function execute(args, timeout = 10000) {
    // Node's default reporter varies by version; detection below consumes TAP.
    if (args[0] === '--test') args = ['--test', '--test-reporter=tap', ...args.slice(1)];
    return spawnSync(process.execPath, args, { cwd: temp, encoding: 'utf8', timeout, maxBuffer: 8 * 1024 * 1024 });
  }
  try {
    const baselines = new Map();
    for (const name of ['package.json', 'index.js', 'src', 'package', 'types', 'index.d.ts', 'index.d.mts', 'test']) {
      fs.cpSync(path.join(root, name), path.join(temp, name), { recursive: true });
    }
    for (const file of new Set(definitions.map((row) => row[4]))) {
      const baseline = execute(['--test', file]);
      baselines.set(file, summariseTestRun(baseline, file, true));
    }
    for (const [name, file, from, to, testFile] of definitions) {
      const target = path.join(temp, file),
        source = fs.readFileSync(target, 'utf8');
      if (source.split(from).length !== 2) throw new Error('Mutation must match exactly once: ' + name);
      try {
        fs.writeFileSync(target, source.replace(from, to));
        const syntax = execute(['--check', file]);
        if (syntax.error || syntax.signal || syntax.status !== 0)
          throw new Error('Invalid mutant syntax: ' + name + '\n' + syntax.stderr);
        const start = performance.now(),
          result = execute(['--test', testFile]);
        const { detected, failingTests } = compareMutation(result, baselines.get(testFile), name);
        records.push({
          name,
          file,
          testFile,
          detected,
          exitCode: result.status,
          failingTests,
          durationMs: Math.round(performance.now() - start)
        });
        console.log((detected ? 'DETECTED ' : 'SURVIVED ') + name + ' (' + failingTests.length + ' failing tests)');
      } finally {
        fs.writeFileSync(target, source);
      }
    }
    const report = {
      node: process.version,
      isolatedCopy: true,
      total: records.length,
      detected: records.filter((r) => r.detected).length,
      survived: records.filter((r) => !r.detected).length,
      scope: definitions.length + ' hand-selected runtime faults; not an exhaustive mutation score.',
      mutations: records
    };
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, JSON.stringify(report, null, 2) + '\n');
    console.log(`${report.detected}/${report.total} deliberate mutations detected. Report: ${destination}`);
    if (report.survived) process.exitCode = 1;
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
if (require.main === module) main();
