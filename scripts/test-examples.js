'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const ts = require('typescript');
const { assertCompleted } = require('./consumer-tools');
const root = path.resolve(__dirname, '../package');

function parseExample(code) {
  const ast = ts.createSourceFile('example.ts', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  assert.equal(ast.parseDiagnostics.length, 0, 'Invalid example syntax.');
  return ast;
}
function applyEdits(code, edits) {
  for (const edit of edits.sort((a, b) => b.start - a.start))
    code = code.slice(0, edit.start) + edit.text + code.slice(edit.end);
  return code;
}
function isPackageImport(value) {
  return value === 'go-objects' || value.startsWith('go-objects/');
}
function asEsm(code) {
  const ast = parseExample(code),
    edits = [];
  for (const statement of ast.statements) {
    if (!ts.isVariableStatement(statement) || statement.declarationList.declarations.length !== 1) continue;
    const declaration = statement.declarationList.declarations[0],
      call = declaration.initializer;
    if (
      !(statement.declarationList.flags & ts.NodeFlags.Const) ||
      !ts.isIdentifier(declaration.name) ||
      !call ||
      !ts.isCallExpression(call) ||
      !ts.isIdentifier(call.expression) ||
      call.expression.text !== 'require' ||
      call.arguments.length !== 1 ||
      !ts.isStringLiteral(call.arguments[0]) ||
      !isPackageImport(call.arguments[0].text)
    )
      continue;
    edits.push({
      start: statement.getStart(ast),
      end: statement.end,
      text: 'import ' + declaration.name.text + ' from ' + JSON.stringify(call.arguments[0].text) + ';'
    });
  }
  return applyEdits(code, edits);
}

function collect(directory) {
  const examples = [];
  for (const file of ['README.md', 'docs/API.md', 'docs/MIGRATION.md']) {
    const text = fs.readFileSync(path.join(directory, file), 'utf8');
    for (const [index, match] of [
      ...text.matchAll(/\x60\x60\x60(javascript|typescript)\r?\n([\s\S]*?)\x60\x60\x60/g)
    ].entries()) {
      examples.push({ name: file + ' example ' + (index + 1), language: match[1], code: match[2] });
    }
  }
  for (const [name, value] of Object.entries(require(path.join(directory, 'index.js')))) {
    if (typeof value !== 'function') continue;
    const source = fs.readFileSync(path.join(directory, 'src', name + '.js'), 'utf8');
    for (const [, block] of source.matchAll(/\/\*\*([\s\S]*?)\*\//g)) {
      const clean = block.replace(/^[ \t]*\* ?/gm, '');
      for (const [, code] of clean.matchAll(/@example\s*\n([\s\S]*?)(?=\n@\w|$)/g)) {
        examples.push({ name: 'src/' + name + '.js JSDoc', language: 'javascript', code: code.trim(), jsdoc: true });
      }
    }
  }
  return examples;
}

function instrument(code) {
  const ast = parseExample(code),
    statements = [],
    comments = new Map();
  function visit(node) {
    // Comment ranges start at syntactic boundaries, never inside string/regexp data.
    for (const comment of [
      ...(ts.getLeadingCommentRanges(code, node.pos) || []),
      ...(ts.getTrailingCommentRanges(code, node.end) || [])
    ]) {
      if (comment.kind === ts.SyntaxKind.SingleLineCommentTrivia) comments.set(comment.pos, comment);
    }
    if (ts.isExpressionStatement(node) || ts.isVariableStatement(node) || ts.isReturnStatement(node))
      statements.push(node);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const edits = [];
  let assertions = 0;
  for (const comment of [...comments.values()].sort((a, b) => a.pos - b.pos)) {
    const match = /^\/\/ => ([^\r\n]+)/.exec(code.slice(comment.pos, comment.end));
    if (!match) continue;
    const statement = statements
      .filter((node) => node.end <= comment.pos && /^\s*$/.test(code.slice(node.end, comment.pos)))
      .sort((a, b) => b.end - a.end || a.pos - b.pos)[0];
    assert.ok(statement, 'No statement for result: ' + match[1]);
    const expected = match[1].trim();
    const start = statement.getStart(ast),
      end = statement.end;
    let replacement;
    if (expected.startsWith('throws ')) {
      assert.match(expected, /^throws [A-Za-z]*Error$/);
      replacement =
        (ts.isReturnStatement(statement) ? 'return ' : '') +
        '__throws(() => { ' +
        code.slice(start, end) +
        ' }, ' +
        JSON.stringify(expected.slice(7)) +
        ');';
    } else {
      const check = ts.createSourceFile(
        'expected.ts',
        'const result = (' + expected + ');',
        ts.ScriptTarget.Latest,
        true
      );
      assert.equal(check.parseDiagnostics.length, 0, 'Invalid expected result: ' + expected);
      let expression;
      if (ts.isVariableStatement(statement)) {
        assert.equal(statement.declarationList.declarations.length, 1);
        expression = statement.declarationList.declarations[0].name.getText(ast);
        replacement = code.slice(start, end) + '\n__equal(' + expression + ', (' + expected + '));';
      } else if (ts.isReturnStatement(statement)) {
        expression = statement.expression ? statement.expression.getText(ast) : 'undefined';
        replacement = 'return __equal((' + expression + '), (' + expected + '));';
      } else {
        expression = statement.expression.getText(ast);
        if (/^console\.log\(/.test(expression)) replacement = '__log(() => ' + expression + ', (' + expected + '));';
        else replacement = '__equal((' + expression + '), (' + expected + '));';
      }
    }
    assert.ok(!edits.some((edit) => edit.start === start), 'Repeated annotation for one statement.');
    edits.push({ start, end, text: replacement });
    assertions++;
  }
  return { code: applyEdits(code, edits), assertions };
}

function runExample(example, directory = root, consumerDirectory = directory, format) {
  const marked = instrument(example.code);
  let code = marked.code;
  if (example.language === 'typescript')
    code = ts.transpileModule(code, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
    }).outputText;
  if (format === 'esm') code = asEsm(code);
  const esm = format === 'esm' || ts.isExternalModule(parseExample(code));
  const prelude = esm
    ? 'import __assert from "node:assert/strict";\n'
    : 'const __assert = require("node:assert/strict");\n';
  const globals = example.jsdoc
    ? esm
      ? 'import Objects from "go-objects";\n'
      : 'const Objects = require("go-objects");\n'
    : '';
  const runtime = [
    'let __checks = 0;',
    'function __equal(actual, expected) { __assert.deepStrictEqual(actual, expected); __checks++; return actual; }',
    'function __throws(fn, name) { __assert.throws(fn, error => error.name === name); __checks++; }',
    'function __log(fn, expected) {',
    '  const original = console.log, logs = [];',
    '  console.log = (...args) => logs.push(args);',
    '  try { fn(); } finally { console.log = original; }',
    '  __assert.equal(logs.length, 1); __assert.equal(logs[0].length, 1); __equal(logs[0][0], expected);',
    '}'
  ].join('\n');
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=' + (esm ? 'module' : 'commonjs'),
      '-e',
      prelude +
        runtime +
        '\n' +
        globals +
        code +
        '\n__assert.equal(__checks, ' +
        marked.assertions +
        ');\nconsole.log("go-objects example checks completed");'
    ],
    {
      cwd: consumerDirectory,
      encoding: 'utf8',
      timeout: 10000
    }
  );
  if (result.error) throw result.error;
  assert.equal(result.status, 0, example.name + '\n' + result.stderr);
  assertCompleted(result.stdout, 'go-objects example checks completed', example.name);
  return marked.assertions;
}
function runAll(directory = root, consumerDirectory = directory) {
  const examples = collect(directory);
  let assertions = 0;
  for (const example of examples) {
    assertions += runExample(example, directory, consumerDirectory);
    if (example.language === 'javascript' && !ts.isExternalModule(parseExample(example.code)))
      assertions += runExample(example, directory, consumerDirectory, 'esm');
  }
  console.log(
    examples.length +
      ' documentation examples and ' +
      assertions +
      ' displayed-result checks passed across documented imports and native ESM.'
  );
  return {
    blocks: examples.length,
    examples: assertions,
    errorExamples: examples.reduce((n, example) => n + (example.code.match(/\/\/ => throws /g) || []).length, 0)
  };
}
function checkTypes(directory = root) {
  const examples = collect(directory).filter((example) => example.language === 'typescript');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'go-objects-doc-types-'));
  try {
    // Resolve the selected package normally; never rewrite literal types or values.
    const modules = path.join(temporary, 'node_modules');
    fs.mkdirSync(modules);
    fs.symlinkSync(path.resolve(directory), path.join(modules, 'go-objects'), 'junction');
    for (const [index, example] of examples.entries()) {
      fs.writeFileSync(path.join(temporary, 'example-' + index + '.mts'), example.code);
    }
    for (const exact of [false, true]) {
      fs.writeFileSync(
        path.join(temporary, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            strict: true,
            noEmit: true,
            target: 'ES2022',
            module: 'NodeNext',
            moduleResolution: 'NodeNext',
            exactOptionalPropertyTypes: exact,
            skipLibCheck: false
          }
        })
      );
      const result = spawnSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', temporary], {
        encoding: 'utf8',
        timeout: 20000
      });
      if (result.error) throw result.error;
      assert.equal(
        result.status,
        0,
        'Documentation types (exactOptionalPropertyTypes=' + exact + ')\n' + result.stdout + result.stderr
      );
    }
  } finally {
    assert.equal(path.dirname(temporary), os.tmpdir());
    fs.rmSync(temporary, { recursive: true, force: true });
  }
  console.log(examples.length + ' TypeScript examples compile with and without exactOptionalPropertyTypes.');
}

function browserExamples(directory = root) {
  const examples = [];
  for (const file of ['README.md', 'docs/API.md']) {
    const metadata = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
    const cdnPrefix = 'https://cdn.jsdelivr.net/npm/' + metadata.name + '@' + metadata.version + '/';
    const markdown = fs.readFileSync(path.join(directory, file), 'utf8').replaceAll(cdnPrefix, './');
    for (const [index, match] of [...markdown.matchAll(/\x60\x60\x60html\r?\n([\s\S]*?)\x60\x60\x60/g)].entries()) {
      const scripts = [...match[1].matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
      for (const [, attributes, source] of scripts) {
        const external = /\bsrc="([^"]+)"/.exec(attributes);
        if (external) {
          assert.equal(external[1], './dist/go-objects.js', 'Unexpected documented classic bundle');
          assert.ok(fs.existsSync(path.join(directory, external[1])));
          continue;
        }
        const marked = instrument(source);
        const prelude = [
          'let __checks = 0;',
          'function __equal(actual, expected) { if (!Object.is(actual, expected)) throw new Error("Displayed browser result differs"); __checks++; return actual; }',
          'function __throws(fn, name) { let caught; try { fn(); } catch (error) { caught = error; } if (!caught || caught.name !== name) throw new Error("Expected " + name); __checks++; }',
          'function __log(fn, expected) { const original = console.log, logs = []; console.log = (...args) => logs.push(args); try { fn(); } finally { console.log = original; } if (logs.length !== 1 || logs[0].length !== 1) throw new Error("Expected one logged value"); __equal(logs[0][0], expected); }'
        ].join('\n');
        examples.push({
          name: file + ' browser example ' + (index + 1),
          module: /\btype="module"/.test(attributes),
          assertions: marked.assertions,
          code:
            prelude +
            '\n' +
            marked.code +
            '\nif (__checks !== ' +
            marked.assertions +
            ') throw new Error("Missing browser result checks");'
        });
      }
    }
  }
  assert.ok(examples.length > 0, 'Documented browser examples must remain covered');
  return examples;
}

// Keep the actual script-tag example and its exact-version URL for browser loading.
function browserDocument(directory = root, bundle = 'go-objects.js') {
  assert.ok(['go-objects.js', 'go-objects.min.js'].includes(bundle), 'Unsupported browser bundle');
  const metadata = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
  const prefix = 'https://cdn.jsdelivr.net/npm/' + metadata.name + '@' + metadata.version + '/';
  const markdown = fs.readFileSync(path.join(directory, 'README.md'), 'utf8');
  const block = [...markdown.matchAll(/```html\r?\n([\s\S]*?)```/g)].find((match) => /<script\s+src=/.test(match[1]));
  assert.ok(block, 'Missing README script-tag example');
  const scripts = [...block[1].matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)];
  assert.equal(scripts.length, 1, 'Expected one README script URL');
  assert.equal(scripts[0][1], prefix + 'dist/go-objects.js', 'Expected exact-version README bundle URL');
  const scriptUrl = prefix + 'dist/' + bundle;
  return { scriptUrl, html: block[1].replace('src="' + scripts[0][1] + '"', 'src="' + scriptUrl + '"') };
}

module.exports = { collect, instrument, runExample, runAll, checkTypes, browserExamples, browserDocument };
if (require.main === module) {
  runAll();
  checkTypes();
}
