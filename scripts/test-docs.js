'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const vm = require('node:vm');
const render = require('./docs.js');
const q = String.fromCharCode(96),
  fence = q.repeat(3);
const reference =
  '# Fixture API\n\n## Contents\n\n{{TOC}}\n\n## Examples\n\n### `example(value)`\n\nReturns a value.\n\n**Parameters**\n\n| Parameter | Type | Description |\n| --- | --- | --- |\n| ' +
  q +
  'value' +
  q +
  ' | ' +
  q +
  'number' +
  q +
  ' | Value. |\n\n**Returns:** ' +
  q +
  'number' +
  q +
  ' — The value.\n\n**Examples**\n\n' +
  fence +
  'javascript\nexample(1); // => 1\n' +
  fence +
  '\n';
test('both documents are generated and checked without writes, including cross-document anchors', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'go-objects-docs-test-'));
  try {
    fs.mkdirSync(path.join(root, 'scripts'));
    fs.copyFileSync(path.join(__dirname, 'docs.js'), path.join(root, 'scripts/docs.js'));
    fs.copyFileSync(path.join(__dirname, 'package-layout.js'), path.join(root, 'scripts/package-layout.js'));
    fs.writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({
        name: 'fixture',
        version: '8.2.1',
        license: 'MIT',
        devDependencies: { typescript: '5.8.3' }
      })
    );
    fs.writeFileSync(path.join(root, 'index.js'), 'exports.example=value=>value;');
    fs.writeFileSync(path.join(root, 'scripts/API.template.md'), reference);
    fs.writeFileSync(
      path.join(root, 'scripts/README.template.md'),
      '# Fixture\n\n{{VERSION}} {{NODE_ENGINE}} {{API_COUNT}}\n\n## Contents\n\n{{TOC}}\n\n## API summary\n\n{{API_SUMMARY}}\n\n## Usage\n\nKeep authored prose.\n'
    );
    const run = (...args) => spawnSync(process.execPath, ['scripts/docs.js', ...args], { cwd: root, encoding: 'utf8' });
    const generated = run();
    assert.equal(generated.status, 0, generated.stderr);
    const file = path.join(root, 'README.md'),
      expected = fs.readFileSync(file, 'utf8');
    assert.match(expected, /8\.2\.1 >=8\.0\.0 1/);
    assert.match(expected, /docs\/API\.md#examplevalue/);
    assert.match(expected, /\[Usage\]\(#usage\)/);
    assert.match(expected, /Keep authored prose/);
    assert.doesNotMatch(expected, /\[Contents\]\(#contents\)/);
    assert.equal(run('--check').status, 0);
    for (const relative of ['README.md', 'docs/API.md']) {
      const full = path.join(root, relative),
        original = fs.readFileSync(full, 'utf8');
      fs.appendFileSync(full, 'stale\n');
      const stale = fs.readFileSync(full, 'utf8');
      const check = run('--check');
      assert.notEqual(check.status, 0);
      assert.match(check.stderr, /stale/);
      assert.equal(fs.readFileSync(full, 'utf8'), stale);
      fs.writeFileSync(full, original);
    }
    const apiTemplate = path.join(root, 'scripts/API.template.md');
    fs.appendFileSync(apiTemplate, '\n[Broken heading](../README.md#missing)\n');
    assert.notEqual(run().status, 0, 'Missing cross-document anchors must fail');
    assert.notEqual(run('--unknown').status, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
test('API coverage requires complete entries, not just summary rows', () => {
  const api = { example: () => 1 };
  const current = reference.replace('{{TOC}}', '');
  assert.match(render.summary(current, api), /examplevalue/);
  assert.throws(() => render.summary(current, { ...api, missing: () => 0 }), /Document public API/);
  assert.throws(() => render.summary(current.replace('**Parameters**', 'Parameters'), api), /parameters/);
  assert.throws(() => render.summary(current.replace('**Returns:**', 'Returns:'), api), /return contract/);
  assert.throws(() => render.summary(current.replace('**Examples**', 'Examples'), api), /examples/);
  assert.throws(() => render.summary(current + '\n### `example(value)`\n\nDuplicate.\n', api), /Duplicate/);
});
test('headings ignore fenced examples and disambiguate repeated names', () => {
  assert.deepEqual(
    render
      .headings('# Test\n\n## Same\n' + fence + 'javascript\n## Hidden\n' + fence + '\n## Same')
      .map((h) => h.anchor),
    ['test', 'same', 'same-1']
  );
});

test('documented result instrumentation checks values, errors and multiline calls in both formats', () => {
  const { runExample, instrument } = require('./test-examples.js');
  const root = path.resolve(__dirname, '..');
  const example = {
    name: 'instrumentation probe',
    language: 'javascript',
    code: [
      "const A = require('go-objects');",
      'A.count(',
      '  [1, 1], 1',
      '); // => 2',
      'A.some(null, 1); // => throws TypeError',
      "const result = A.findEntry({ a: 'a', b: 'b' }, 'b'); // => ['b', 'b']"
    ].join('\n')
  };
  assert.equal(instrument(example.code).assertions, 3);
  for (const format of [undefined, 'esm']) {
    assert.equal(runExample(example, root, path.join(root, 'package'), format), 3);
    assert.throws(
      () =>
        runExample(
          { ...example, code: example.code.replace('// => 2', '// => 99') },
          root,
          path.join(root, 'package'),
          format
        ),
      /instrumentation probe/
    );
    assert.throws(
      () =>
        runExample(
          { ...example, code: example.code.replace('throws TypeError', 'throws RangeError') },
          root,
          path.join(root, 'package'),
          format
        ),
      /instrumentation probe/
    );
  }
});

test('public JSDoc type references resolve in CommonJS and generated ESM source', () => {
  const ts = require('typescript');
  const root = path.resolve(__dirname, '..');
  const names = Object.keys(require(root));
  const files = names
    .flatMap((name) => ['src/' + name + '.js', 'package/esm/' + name + '.mjs'])
    .map((file) => path.join(root, file));
  const program = ts.createProgram(files, {
    allowJs: true,
    checkJs: true,
    noEmit: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext
  });
  const problems = [];
  for (const file of files) {
    const source = program.getSourceFile(file);
    const comments = [];
    function visit(node) {
      if (node.jsDoc) comments.push(...node.jsDoc);
      ts.forEachChild(node, visit);
    }
    visit(source);
    for (const diagnostic of program.getSemanticDiagnostics(source)) {
      if (comments.some((comment) => diagnostic.start >= comment.pos && diagnostic.start < comment.end)) {
        problems.push(path.relative(root, file) + ': ' + ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
      }
    }
  }
  assert.deepEqual(problems, [], 'Public JSDoc annotations must resolve without relying on implicit type names');
});

// adapting examples must not rewrite code-looking data or type literals.
for (const [name, code] of [
  ['quoted string', 'const sample = "// => 7";'],
  ['template literal', 'const sample = `before\n// => 7\nafter`;'],
  ['block comment', '/* // => 7 */\nconst sample = 1;'],
  ['regexp literal', 'const sample = /[// => 7]/;']
]) {
  test('result annotations ignore ' + name + ' data', () => {
    const { instrument } = require('./test-examples.js');
    const marked = instrument(code);
    assert.equal(marked.assertions, 0);
    assert.equal(marked.code, code);
  });
}

test('annotated return statements retain their return value', () => {
  const { runExample, instrument } = require('./test-examples.js');
  const root = path.resolve(__dirname, '..');
  const code = ['function answer() { return 3; // => 3', '}', 'answer(); // => 3'].join('\n');
  // Return annotations keep their control flow: check the value, then return it.
  const example = { name: 'nested return annotation', language: 'javascript', code };
  assert.equal(instrument(code).assertions, 2);
  assert.equal(runExample(example, root, path.join(root, 'package')), 2);
});

test('orphaned result annotations are not silently ignored', () => {
  const { instrument } = require('./test-examples.js');
  assert.throws(() => instrument('// => 3\nconst value = 3;'), /No statement/);
  assert.throws(() => instrument('const value = 3;\n// => 3\n// => 3'), /No statement/);
});

for (const [name, code] of [
  [
    'quoted require text',
    [`const sample = "const Objects = require('go-objects');";`, "sample.startsWith('const'); // => true"].join('\n')
  ],
  [
    'template require text',
    [
      "const sample = `before\nconst Objects = require('go-objects');\nafter`;",
      "sample.includes('require'); // => true"
    ].join('\n')
  ],
  ['spaced standalone import', ["const get = require( 'go-objects/get' );", "get({ n: 3 }, 'n'); // => 3"].join('\n')],
  [
    'multiline standalone import',
    ["const get =\n  require(\n    'go-objects/get'\n  );", "get({ n: 3 }, 'n'); // => 3"].join('\n')
  ]
]) {
  test('ESM example adaptation preserves ' + name, () => {
    const { runExample } = require('./test-examples.js');
    const root = path.resolve(__dirname, '..');
    const example = { name, language: 'javascript', code };
    assert.equal(runExample(example, root, path.join(root, 'package')), 1);
    assert.equal(runExample(example, root, path.join(root, 'package'), 'esm'), 1);
  });
}

test('import text inside a template does not change an example module kind', () => {
  const { runExample } = require('./test-examples.js');
  const root = path.resolve(__dirname, '..');
  const example = {
    name: 'module-kind source fidelity',
    language: 'javascript',
    code: [
      "const Objects = require('go-objects');",
      "const sample = `before\nimport Objects from 'go-objects';\nafter`;",
      "Objects.hasProp({ sample }, 'sample'); // => true"
    ].join('\n')
  };
  assert.equal(runExample(example, root, path.join(root, 'package')), 1);
});

test('TypeScript example checking preserves source and uses package resolution', () => {
  const { checkTypes } = require('./test-examples.js');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'go-objects-doc-types-fidelity-'));
  try {
    fs.cpSync(path.resolve(__dirname, '../package'), root, { recursive: true });
    fs.writeFileSync(
      path.join(root, 'README.md'),
      [
        '# Fixture',
        '',
        '```typescript',
        "import Objects from 'go-objects';",
        "import get from 'go-objects/get';",
        "import legacyGet from 'go-objects/src/get';",
        "import explicitGet from 'go-objects/esm/get.mjs';",
        "type Namespace = typeof import('go-objects').default;",
        'const checked: Namespace = Objects;',
        "const name: `go-${'objects'}` = 'go-objects';",
        "const subpath: `go-objects/${'get'}` = 'go-objects/get';",
        'Objects.hasProp({ name }, name);',
        "get({ subpath }, ['subpath']);",
        "legacyGet({ name }, ['name']);",
        "explicitGet({ name }, ['name']);",
        'checked.hasProp({ name }, name);',
        '```',
        ''
      ].join('\n')
    );
    fs.writeFileSync(path.join(root, 'docs/API.md'), '# Fixture API\n');
    fs.writeFileSync(path.join(root, 'docs/MIGRATION.md'), '# Fixture migration\n');
    checkTypes(root);
    const markdown = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
    fs.writeFileSync(
      path.join(root, 'README.md'),
      markdown.replace("const name: `go-${'objects'}` = 'go-objects';", "const name: `go-${'objects'}` = 3;")
    );
    assert.throws(() => checkTypes(root), /not assignable/);
    assert.ok(fs.existsSync(path.join(root, 'index.mjs')), 'Temporary resolution links must not delete their target');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('annotation controls preserve ordinary values and report wrong values or error types', () => {
  const { runExample } = require('./test-examples.js');
  const root = path.resolve(__dirname, '..');
  const example = {
    name: 'result controls',
    language: 'javascript',
    code: "const Objects = require('go-objects');\nObjects.count({ a: 3 }); // => 1\nObjects.get({}, '[*]'); // => throws SyntaxError"
  };
  for (const format of [undefined, 'esm']) {
    assert.equal(runExample(example, root, path.join(root, 'package'), format), 2);
    assert.throws(
      () =>
        runExample(
          { ...example, code: example.code.replace('// => 1', '// => 99') },
          root,
          path.join(root, 'package'),
          format
        ),
      /result controls/
    );
    assert.throws(
      () =>
        runExample(
          { ...example, code: example.code.replace('throws SyntaxError', 'throws TypeError') },
          root,
          path.join(root, 'package'),
          format
        ),
      /result controls/
    );
  }
});

test('real ESM imports still select ESM execution', () => {
  const { runExample } = require('./test-examples.js');
  const root = path.resolve(__dirname, '..');
  assert.equal(
    runExample(
      {
        name: 'real ESM control',
        language: 'javascript',
        code: "import { get } from 'go-objects';\nget({ a: 3 }, 'a'); // => 3"
      },
      root,
      path.join(root, 'package')
    ),
    1
  );
});

test('annotated returns preserve early exit and evaluate the value once', () => {
  const { runExample } = require('./test-examples.js');
  const root = path.resolve(__dirname, '..');
  const example = {
    name: 'return evaluation control',
    language: 'javascript',
    code: [
      'let reads = 0;',
      'const value = { get n() { reads++; return 3; } };',
      'function read() {',
      '  return value.n; // => 3',
      '  throw new Error("must not run");',
      '}',
      'read(); // => 3',
      'reads; // => 1',
      'function fails() {',
      '  return JSON.parse("invalid"); // => throws SyntaxError',
      '  throw new Error("must not run");',
      '}',
      'fails(); // => undefined'
    ].join('\n')
  };
  for (const format of [undefined, 'esm'])
    assert.equal(runExample(example, root, path.join(root, 'package'), format), 5);
});

test('bare annotated returns preserve early exit with undefined', () => {
  const { runExample } = require('./test-examples.js');
  const root = path.resolve(__dirname, '..');
  const example = {
    name: 'bare return',
    language: 'javascript',
    code: 'function stop() { return; // => undefined\nthrow new Error("must not run"); }\nstop(); // => undefined'
  };
  assert.equal(runExample(example, root, path.join(root, 'package')), 2);
});

test('browser example instrumentation preserves annotated return control flow', () => {
  const { browserExamples } = require('./test-examples.js');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'go-objects-browser-return-'));
  try {
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(require('../package.json')));
    fs.mkdirSync(path.join(root, 'docs'));
    fs.writeFileSync(path.join(root, 'docs/API.md'), '# API\n');
    fs.writeFileSync(
      path.join(root, 'README.md'),
      [
        '# Browser example',
        '```html',
        '<script>',
        'function value() {',
        '  return 3; // => 3',
        '  throw new Error("must not run");',
        '}',
        'value(); // => 3',
        '</script>',
        '```',
        ''
      ].join('\n')
    );
    const [example] = browserExamples(root);
    assert.equal(example.assertions, 2);
    vm.runInNewContext(example.code, {}, { timeout: 1000 });
    const file = path.join(root, 'README.md');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('return 3;', 'return 4;'));
    const [wrong] = browserExamples(root);
    assert.throws(() => vm.runInNewContext(wrong.code, {}, { timeout: 1000 }), /Displayed browser result differs/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('README script delivery selects the exact version and rejects unrelated URLs', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'go-objects-browser-document-'));
  const { browserDocument } = require('./test-examples');
  const prefix = 'https://cdn.jsdelivr.net/npm/go-objects@3.0.8/';
  try {
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'go-objects', version: '3.0.8' }));
    const document = (url) =>
      fs.writeFileSync(
        path.join(root, 'README.md'),
        fence +
          'html\n<script src="' +
          url +
          '"></script>\n<script>console.log(Objects.get({x: true}, "x"));</script>\n' +
          fence
      );
    document(prefix + 'dist/go-objects.js');
    const readable = browserDocument(root, 'go-objects.js');
    assert.equal(readable.scriptUrl, prefix + 'dist/go-objects.js');
    assert.ok(readable.html.includes('<script src="' + readable.scriptUrl + '"></script>'));
    const minified = browserDocument(root, 'go-objects.min.js');
    assert.equal(minified.scriptUrl, prefix + 'dist/go-objects.min.js');
    assert.ok(minified.html.includes('<script src="' + minified.scriptUrl + '"></script>'));
    assert.throws(() => browserDocument(root, '../index.js'), /Unsupported browser bundle/);
    for (const url of [
      prefix.replace('@3.0.8', '@latest') + 'dist/go-objects.js',
      'https://example.test/go-objects.js',
      prefix + 'dist/missing.js'
    ]) {
      document(url);
      assert.throws(() => browserDocument(root), /exact-version/);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('summary navigation links every generated API group in order', () => {
  const second = reference
    .slice(reference.indexOf('## Examples'))
    .replace('## Examples', '## Other operations')
    .replaceAll('example', 'another');
  const summary = render.summary(reference + second, { example: () => 1, another: () => 2 });
  assert.equal(summary.split('\n')[0], '[Examples](#examples) · [Other operations](#other-operations)');
  assert.ok(summary.includes('### Examples'));
  assert.ok(summary.includes('### Other operations'));
});
