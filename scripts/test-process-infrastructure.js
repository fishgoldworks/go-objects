'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { run, assertCompleted, parseConsumerArgs } = require('./consumer-tools');

function temporary(prefix, check) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  try {
    return check(directory);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
function child(args, cwd, additions = {}) {
  const env = { ...process.env, ...additions };
  delete env.NODE_TEST_CONTEXT;
  return spawnSync(process.execPath, args, { cwd, env, encoding: 'utf8', timeout: 15000 });
}
function discovered(files, args, check) {
  temporary('go-objects-discovery-', (directory) => {
    fs.mkdirSync(path.join(directory, 'scripts'));
    fs.mkdirSync(path.join(directory, 'test'));
    fs.copyFileSync(path.join(__dirname, 'test.js'), path.join(directory, 'scripts/test.js'));
    for (const [name, code] of Object.entries(files)) {
      const file = path.join(directory, 'test', name);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, code);
    }
    check(child([path.join(directory, 'scripts/test.js'), '--test-reporter=tap', ...args], os.tmpdir()));
  });
}
test('runtime discovery executes top-level tests from its root and excludes fixtures and tooling', () => {
  discovered(
    {
      'b.test.js': "require('node:test').test('second',()=>{});",
      'a.test.js': "require('node:test').test('first',()=>{});",
      'helper.js': "throw Error('Do not discover helpers');",
      'fixtures/hidden.test.js': "throw Error('Do not discover fixtures');"
    },
    [],
    (result) => {
      assert.ifError(result.error);
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /# pass 2\b/);
      assert.match(result.stdout, /ok \d+ - first/);
      assert.match(result.stdout, /ok \d+ - second/);
    }
  );
});
test('runtime discovery fails for an empty suite', () => {
  discovered({}, [], (result) => {
    assert.equal(result.status, 1);
    assert.match(result.stderr, /No runtime tests found/);
  });
});
for (const [name, code] of [
  ['assertion', "require('node:test').test('failure',()=>require('node:assert/strict').equal(1,2));"],
  ['terminated worker', 'process.kill(process.pid, "SIGTERM");']
])
  test('runtime runner propagates ' + name, () => {
    discovered({ 'failure.test.js': code }, [], (result) => {
      assert.ifError(result.error);
      assert.equal(result.status, 1);
    });
  });
test('consumer process helper propagates nonzero exits, signals and spawn errors', () => {
  assert.equal(run(process.execPath, ['-e', "process.stdout.write('control')"]), 'control');
  assert.throws(
    () => run(process.execPath, ['-e', 'process.exit(7)']),
    (error) => error.status === 7
  );
  assert.throws(
    () => run(process.execPath, ['-e', 'process.kill(process.pid,"SIGTERM")']),
    (error) =>
      // Windows reports self-termination as an unsuccessful exit, not a POSIX signal.
      process.platform === 'win32' ? error.status === 1 && error.signal === null : error.signal === 'SIGTERM'
  );
  assert.throws(
    () => run(path.join(os.tmpdir(), 'go-objects-nonexistent-executable'), []),
    (error) => error.code === 'ENOENT'
  );
});
test('completion markers require an exact line and do not accept empty or partial output', () => {
  assert.doesNotThrow(() => assertCompleted('before\r\nDONE\r\nafter', 'DONE', 'control'));
  for (const output of ['', 'almost DONE', 'DONE but pending'])
    assert.throws(() => assertCompleted(output, 'DONE', 'control'), /completion marker/);
});
test('consumer argument parsing preserves explicit candidate identity and rejects invalid inputs', () => {
  temporary('go-objects-consumer-args-', (directory) => {
    const file = path.join(directory, 'candidate with spaces.tgz');
    fs.writeFileSync(file, 'fixture only');
    assert.equal(parseConsumerArgs(['--tarball', file]).tarball, file);
    assert.throws(() => parseConsumerArgs(['--tarball', directory]), /must be a file/);
    assert.throws(() => parseConsumerArgs(['--tarball']), /requires a path/);
    assert.throws(() => parseConsumerArgs(['--unexpected']), /Unknown/);
  });
});

// The orchestration below is real, but individual heavyweight gates are simulated
// child commands. It proves routing, failure propagation and cleanup, NOT release
// validation, compilation, npm installation or browser compatibility.
function orchestrated(args, mode, check) {
  temporary('go-objects-orchestration-', (directory) => {
    fs.mkdirSync(path.join(directory, 'scripts'));
    const tmp = path.join(directory, 'temporary');
    fs.mkdirSync(tmp);
    for (const name of ['verify.js', 'consumer-tools.js'])
      fs.copyFileSync(path.join(__dirname, name), path.join(directory, 'scripts', name));
    const candidate = path.join(directory, 'candidate.tgz');
    fs.writeFileSync(candidate, 'candidate bytes');
    const events = path.join(directory, 'events.jsonl');
    fs.writeFileSync(
      path.join(directory, 'scripts/pack-package.js'),
      `
      module.exports = () => {
        require('node:fs').appendFileSync(${JSON.stringify(events)}, JSON.stringify({pack:true})+'\\n');
        return ${JSON.stringify(candidate)};
      };
    `
    );
    const cli = path.join(directory, 'npm-fixture.cjs');
    fs.writeFileSync(
      cli,
      `
      const fs = require('node:fs'), path = require('node:path');
      const args = process.argv.slice(2);
      fs.appendFileSync(${JSON.stringify(events)}, JSON.stringify({args,cwd:process.cwd()})+'\\n');
      if (args[0] === 'install') fs.mkdirSync(path.join(process.cwd(),'node_modules/go-objects'),{recursive:true});
      if (args[1] === 'coverage' && ${JSON.stringify(mode)} === 'failure') process.exit(7);
      if (args[1] === 'coverage' && ${JSON.stringify(mode)} === 'signal') process.kill(process.pid,'SIGTERM');
      if (args[1] === 'test:runtime' && ${JSON.stringify(mode)} === 'changed') fs.appendFileSync(${JSON.stringify(candidate)},'changed');
    `
    );
    const result = child(['scripts/verify.js', ...args], directory, {
      npm_execpath: cli,
      TMPDIR: tmp,
      TMP: tmp,
      TEMP: tmp
    });
    assert.ifError(result.error);
    const calls = fs.existsSync(events) ? fs.readFileSync(events, 'utf8').trim().split('\n').map(JSON.parse) : [];
    check(result, calls, candidate);
    assert.deepEqual(fs.readdirSync(tmp), [], 'Verifier must clean its temporary consumer on success and failure');
  });
}
for (const args of [[], ['--all']])
  test('verifier routes one candidate and cleans up ' + JSON.stringify(args), () => {
    orchestrated(args, 'valid', (result, calls, candidate) => {
      assert.equal(result.status, 0, result.stderr);
      assert.equal(calls.filter((call) => call.pack).length, 1);
      const runs = calls.filter((call) => call.args?.[0] === 'run');
      assert.deepEqual(
        runs.map((call) => call.args[1]),
        [
          'lint',
          'format:check',
          'test:docs',
          'coverage',
          'test:types',
          'test:build',
          'test:artifacts',
          'test:tree-shaking',
          'test:package',
          'test:runtime',
          'test:mutations',
          ...(args.length ? Array(6).fill('test:browser') : [])
        ]
      );
      for (const name of ['test:types', 'test:package', 'test:runtime']) {
        const call = runs.find((item) => item.args[1] === name);
        assert.equal(call.args[call.args.indexOf('--tarball') + 1], candidate);
      }
      const install = calls.find((call) => call.args?.[0] === 'install');
      assert.equal(install.args.at(-1), candidate);
      for (const name of ['test:tree-shaking', ...(args.length ? ['test:browser'] : [])]) {
        const call = runs.find((item) => item.args[1] === name);
        assert.equal(call.args[call.args.indexOf('--package') + 1], path.join(install.cwd, 'node_modules/go-objects'));
      }
      if (args.length) {
        const browsers = runs.filter((call) => call.args[1] === 'test:browser');
        assert.deepEqual(
          browsers.map((call) => [
            call.args[call.args.indexOf('--browser') + 1],
            call.args[call.args.indexOf('--bundle') + 1]
          ]),
          ['chromium', 'firefox', 'webkit'].flatMap((engine) =>
            ['go-objects.js', 'go-objects.min.js'].map((file) => [engine, file])
          )
        );
        for (const call of browsers)
          assert.equal(
            call.args[call.args.indexOf('--package') + 1],
            path.join(install.cwd, 'node_modules/go-objects')
          );
      }
      assert.match(result.stdout, /verifiedTarball/);
    });
  });
for (const mode of ['failure', 'signal'])
  test('verifier stops and cleans up after a gate ' + mode, () => {
    orchestrated([], mode, (result, calls) => {
      assert.notEqual(result.status, 0);
      assert.equal(calls.at(-1).args[1], 'coverage');
      assert.doesNotMatch(result.stdout, /verifiedTarball/);
    });
  });
test('verifier rejects candidate bytes changed during checks', () => {
  orchestrated([], 'changed', (result) => {
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /candidate tarball changed/);
    assert.doesNotMatch(result.stdout, /verifiedTarball/);
  });
});
test('verifier rejects an unknown option before packing', () => {
  orchestrated(['--unknown'], 'valid', (result, calls) => {
    assert.notEqual(result.status, 0);
    assert.deepEqual(calls, []);
  });
});
