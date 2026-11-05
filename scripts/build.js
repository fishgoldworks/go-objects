'use strict';
// CommonJS remains the canonical implementation. Parse it, rather than using
// regex replacements, to generate a static ESM graph and standalone bundles.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { spawnSync } = require('node:child_process');
const { assertCompleted } = require('./consumer-tools');
const root = path.resolve(__dirname, '..');
const pkg = require('../package.json');
const sourceRoot = path.join(root, 'src');
function compatible(source, filename) {
  const result = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.ESNext, removeComments: false }
  });
  return result.outputText;
}
function generate(outputRoot) {
  const esmRoot = path.join(outputRoot, 'esm');
  const banner = '/*! go-objects v' + pkg.version + ' | ' + pkg.license + ' | See LICENSE.md */\n';
  const graph = new Map();
  const slash = (value) => value.split(path.sep).join('/');
  const relativeModule = (value) => value.replace(/\.js$/, '.mjs') + (path.extname(value) ? '' : '.mjs');
  const isRequire = (node) =>
    ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require';
  const isModuleExports = (node) =>
    ts.isPropertyAccessExpression(node) && node.expression.getText() === 'module' && node.name.text === 'exports';
  function editsOf(source, edits) {
    let text = source;
    for (const { start, end, text: replacement } of edits.sort((a, b) => b.start - a.start))
      text = text.slice(0, start) + replacement + text.slice(end);
    return text;
  }
  function write(file, value) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, /\.(?:js|mjs)$/.test(file) ? compatible(value, file) : value);
  }
  function convert(file) {
    const publicName = publicFiles.has(file) ? file.slice(0, -3) : undefined;
    const filename = path.join(sourceRoot, file),
      text = fs.readFileSync(filename, 'utf8');
    const ast = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    if (ast.parseDiagnostics.length) throw new Error('Invalid source: ' + file);
    const output = relativeModule(file),
      edits = [],
      imports = [],
      exported = [];
    let counter = 0;
    const exportStatement = ast.statements.find(
      (statement) =>
        ts.isExpressionStatement(statement) &&
        ts.isBinaryExpression(statement.expression) &&
        isModuleExports(statement.expression.left)
    );
    if (!exportStatement) throw new Error('Missing static export in ' + file);
    const rhs = exportStatement.expression.right;
    const addImport = (specifier, local, namespace) => {
      if (!specifier.startsWith('.')) throw new Error('External runtime dependency: ' + specifier);
      const dep = path.posix.normalize(path.posix.join(path.posix.dirname(slash(output)), relativeModule(specifier)));
      if (dep.startsWith('../')) throw new Error('Runtime import escapes the source tree.');
      imports.push({ dep, local, namespace, specifier: relativeModule(specifier) });
    };
    if (ts.isPropertyAccessExpression(rhs) && isRequire(rhs.expression)) {
      // This shortcut replaces the whole module. Never silently discard any
      // executable statement added to what used to be a one-line facade.
      if (
        ast.statements.some(
          (statement) =>
            statement !== exportStatement &&
            !ts.isEmptyStatement(statement) &&
            !(ts.isExpressionStatement(statement) && ts.isStringLiteral(statement.expression))
        )
      )
        throw new Error('Unsupported direct re-export facade in ' + file + ': extra executable statements.');
      if (rhs.expression.arguments.length !== 1 || !ts.isStringLiteral(rhs.expression.arguments[0]))
        throw new Error('Non-static require in ' + file);
      const specifier = rhs.expression.arguments[0].text,
        depName = rhs.name.text;
      addImport(specifier, 'value', false);
      const dep = imports[0].dep;
      const tooltip = (text.match(/\/\*\*[\s\S]*?\*\//g) || []).join('\n');
      const source =
        banner +
        tooltip +
        '\n' +
        `export { ${depName} as default${publicName ? ', ' + depName + ' as ' + publicName : ''} } from '${relativeModule(specifier)}';\n`;
      graph.set(slash(output), {
        imports: [{ dep, local: 'value', property: depName }],
        body: '',
        exports: [['default', 'value'], ...(publicName ? [[publicName, 'value']] : [])]
      });
      write(path.join(esmRoot, output), source);
      return;
    }
    function visit(node) {
      if (isRequire(node)) {
        if (node.arguments.length !== 1 || !ts.isStringLiteral(node.arguments[0]))
          throw new Error('Non-static require in ' + file);
        const specifier = node.arguments[0].text;
        if (
          ts.isVariableDeclaration(node.parent) &&
          ts.isIdentifier(node.parent.name) &&
          node.parent.initializer === node
        ) {
          const declaration = node.parent,
            statement = declaration.parent.parent;
          if (!ts.isVariableStatement(statement) || statement.declarationList.declarations.length !== 1)
            throw new Error('Unsupported declaration in ' + file);
          addImport(specifier, declaration.name.text, true);
          edits.push({ start: statement.getStart(ast), end: statement.end, text: '' });
        } else {
          const local = '__dependency' + counter++;
          addImport(specifier, local, false);
          edits.push({ start: node.getStart(ast), end: node.end, text: local });
        }
        return;
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
    let exportCode,
      declarationCode = '';
    if (ts.isIdentifier(rhs)) {
      exported.push(['default', rhs.text]);
      exportCode = 'export default ' + rhs.text + ';';
      if (publicName) {
        exported.push([publicName, rhs.text]);
        exportCode += '\nexport { ' + rhs.text + ' as ' + publicName + ' };';
      }
    } else if (ts.isObjectLiteralExpression(rhs)) {
      const declarations = [],
        names = [];
      for (const property of rhs.properties) {
        if (ts.isShorthandPropertyAssignment(property)) {
          names.push(property.name.text);
          exported.push([property.name.text, property.name.text]);
        } else if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.name)) {
          const name = property.name.text;
          declarations.push('const ' + name + ' = ' + property.initializer.getText(ast) + ';');
          names.push(name);
          exported.push([name, name]);
        } else throw new Error('Unsupported module export in ' + file);
      }
      declarationCode = declarations.join('\n');
      exportCode = declarationCode + '\nexport { ' + names.join(', ') + ' };';
    } else throw new Error('Unsupported module export in ' + file);
    const exportRange = { start: exportStatement.getStart(ast), end: exportStatement.end };
    const converted = editsOf(text, [...edits, { ...exportRange, text: exportCode }]).replace(
      /^['"]use strict['"];\s*/,
      ''
    );
    // A standalone bundle uses statically ordered lexical scopes, not a CJS loader.
    // Remove only the parsed CommonJS export statement, never export-like text
    // inside strings, template literals or comments. Keep object-export bindings.
    const body = editsOf(text, [...edits, { ...exportRange, text: declarationCode }]).replace(
      /^['"]use strict['"];\s*/,
      ''
    );
    graph.set(slash(output), { imports, body, exports: exported, converted });
  }
  const files = fs
    .readdirSync(sourceRoot, { recursive: true })
    .filter((file) => file.endsWith('.js') && !require('./package-layout').isTemporaryPath(file))
    .sort();
  const publicFiles = new Set(files.filter((file) => !file.includes(path.sep) && file !== 'ObjectWrapper.js'));
  const names = [...publicFiles].map((file) => file.slice(0, -3));
  for (const file of files) convert(file);
  // CommonJS require returns the exported value, regardless of whether it is
  // bound to a local name or used in an expression. Resolve its ESM binding
  // from the dependency's actual export shape once the whole graph is known.
  for (const [output, mod] of graph) {
    if (mod.converted === undefined) continue; // Pure re-export written above.
    for (const item of mod.imports) {
      const dependency = graph.get(item.dep);
      if (!dependency) throw new Error('Missing generated module ' + item.dep);
      item.namespace = !dependency.exports.some(([key]) => key === 'default');
    }
    const importCode = mod.imports
      .map((item) =>
        item.namespace
          ? `import * as ${item.local} from '${item.specifier}';`
          : `import ${item.local} from '${item.specifier}';`
      )
      .join('\n');
    write(path.join(esmRoot, output), banner + importCode + '\n' + mod.converted);
  }
  const rootEsm =
    banner +
    "export { default } from './esm/ObjectWrapper.mjs';\n" +
    names.map((name) => `export { default as ${name} } from './esm/${name}.mjs';`).join('\n') +
    '\n';
  write(path.join(outputRoot, 'index.mjs'), rootEsm);
  const declarations = ts.createSourceFile(
    'api.d.ts',
    fs.readFileSync(path.join(root, 'types/api.d.ts'), 'utf8'),
    ts.ScriptTarget.Latest,
    true
  );
  for (const name of names) {
    const declaration = declarations.statements.find(
      (node) => ts.isFunctionDeclaration(node) && node.name?.text === name
    );
    const tooltip = declaration?.jsDoc?.map((comment) => comment.getText(declarations)).join('\n') || '';
    write(
      path.join(esmRoot, name + '.d.mts'),
      `import type { ${name} } from '../types/api.js';
${tooltip}
declare const value: typeof ${name};
export { value as default, value as ${name} };
`
    );
    write(
      path.join(outputRoot, 'src', name + '.d.ts'),
      `import type { ${name} } from '../types/api.js';
${tooltip}
declare const utility: typeof ${name};
export = utility;
`
    );
  }
  const ids = new Map(),
    visiting = new Set(),
    scopes = [];
  function emit(name) {
    if (ids.has(name)) return ids.get(name);
    if (visiting.has(name)) throw new Error('A runtime dependency cycle must be handled explicitly: ' + name);
    visiting.add(name);
    const mod = graph.get(name);
    if (!mod) throw new Error('Missing generated module ' + name);
    const imports = mod.imports
      .map((item) => {
        const source = emit(item.dep);
        return (
          'const ' + item.local + ' = ' + source + (item.namespace ? '' : '.' + (item.property || 'default')) + ';'
        );
      })
      .join('\n');
    const id = '__module' + ids.size;
    ids.set(name, id);
    visiting.delete(name);
    scopes.push(
      '// ' +
        name +
        '\nconst ' +
        id +
        ' = (() => {\n' +
        imports +
        '\n' +
        mod.body +
        '\nreturn {' +
        mod.exports.map(([key, value]) => key + ':' + value).join(',') +
        '};\n})();\n'
    );
    return id;
  }
  const wrapper = emit('ObjectWrapper.mjs');
  const lexical = scopes.join('\n');
  const esmBundle =
    banner +
    lexical +
    '\nconst Objects = ' +
    wrapper +
    '.default;\nexport default Objects;\n' +
    names.map((name) => `export const ${name} = ${ids.get(name + '.mjs')}.default;`).join('\n') +
    '\n';
  const umd =
    banner +
    '(function (root, factory) {\n' +
    '  if (typeof module === "object" && module !== null && module.exports) module.exports = factory();\n' +
    '  else if (typeof define === "function" && define.amd) define([], factory);\n' +
    '  else root.Objects = factory();\n' +
    '})(typeof globalThis !== "undefined" ? globalThis : this, function () {\n"use strict";\n' +
    lexical +
    '\nreturn ' +
    wrapper +
    '.default;\n});\n';
  // Lower syntax before generating maps; rewriting mapped output invalidates positions.
  const browserSource = compatible(umd, 'go-objects.source.js');
  fs.mkdirSync(path.join(outputRoot, 'dist'), { recursive: true });
  for (const [file, content] of Object.entries(require('./build-browser')(root, 'go-objects', browserSource)))
    fs.writeFileSync(path.join(outputRoot, 'dist', file), content);
  write(path.join(outputRoot, 'dist/go-objects.mjs'), esmBundle);
  write(
    path.join(outputRoot, 'dist/go-objects.d.ts'),
    "import Objects = require('../index.js');\nexport = Objects;\nexport as namespace Objects;\n"
  );
  write(
    path.join(outputRoot, 'dist/go-objects.d.mts'),
    "export { default } from '../index.mjs';\nexport * from '../index.mjs';\n"
  );
  const layout = require('./package-layout');
  const consumer = outputRoot;
  fs.cpSync(path.join(root, 'types'), path.join(consumer, 'types'), {
    recursive: true,
    filter: (file) => !layout.isTemporaryPath(path.relative(root, file))
  });
  for (const file of layout.consumerFiles)
    write(path.join(consumer, file), fs.readFileSync(path.join(root, file), 'utf8'));
  for (const file of files)
    write(path.join(consumer, 'src', file), fs.readFileSync(path.join(sourceRoot, file), 'utf8'));
  for (const name of names)
    write(path.join(consumer, name + '.js'), "'use strict';\nmodule.exports = require('./src/" + name + "');\n");
  write(path.join(consumer, 'package.json'), JSON.stringify(layout.consumerManifest(names), null, 2) + '\n');
  return names.length;
}

// Carry local experiments across replacement without treating them as build inputs.
// Do not traverse symbolic links into unrelated trees.
function preserveExperiments(previous, replacement) {
  for (const entry of fs.readdirSync(previous, { withFileTypes: true })) {
    const from = path.join(previous, entry.name),
      to = path.join(replacement, entry.name);
    if ((entry.isDirectory() || entry.isSymbolicLink()) && ['temp', '.tmp'].includes(entry.name)) {
      fs.cpSync(from, to, {
        recursive: true,
        force: false,
        errorOnExist: true,
        verbatimSymlinks: true,
        filter: (source, destination) => {
          if (process.platform !== 'win32' || !fs.lstatSync(source).isSymbolicLink()) return true;
          const target = fs.readlinkSync(source);
          // Windows junctions do not require symbolic-link privileges. Recreate
          // directory links as junctions instead of cp's untyped symlink call.
          if (!path.isAbsolute(target)) return true;
          let directory;
          try {
            directory = fs.statSync(source).isDirectory();
          } catch (error) {
            if (error.code === 'ENOENT') return true;
            throw error;
          }
          if (!directory) return true;
          fs.mkdirSync(path.dirname(destination), { recursive: true });
          fs.symlinkSync(target, destination, 'junction');
          return false;
        }
      });
    } else if (entry.isDirectory()) preserveExperiments(from, to);
  }
}

function replaceOutputs(staging) {
  const backup = staging + '-previous';
  const changes = [];
  try {
    for (const relative of ['package']) {
      const destination = path.join(root, relative),
        previous = path.join(backup, relative);
      const change = { destination, previous, saved: false, installed: false };
      changes.push(change);
      const replacement = path.join(staging, relative);
      if (fs.existsSync(destination)) {
        // Classify links while their original targets still exist. Copy failure
        // leaves the previous tree untouched and staging is discarded.
        preserveExperiments(destination, replacement);
        fs.mkdirSync(path.dirname(previous), { recursive: true });
        fs.renameSync(destination, previous);
        change.saved = true;
      }
      if (fs.existsSync(replacement)) {
        fs.renameSync(replacement, destination);
        change.installed = true;
      }
    }
  } catch (error) {
    const failures = [];
    for (const change of changes.reverse()) {
      try {
        if (change.installed) fs.rmSync(change.destination, { recursive: true, force: true });
        if (change.saved) fs.renameSync(change.previous, change.destination);
      } catch (restoreError) {
        failures.push(restoreError);
      }
    }
    if (failures.length)
      throw new AggregateError(
        [error, ...failures],
        'Build replacement and rollback failed; previous output retained at ' + backup,
        { cause: error }
      );
    try {
      fs.rmSync(backup, { recursive: true, force: true });
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], 'Build failed; backup cleanup failed at ' + backup, {
        cause: cleanupError
      });
    }
    throw error;
  }
  try {
    fs.rmSync(backup, { recursive: true, force: true });
  } catch (error) {
    throw new Error('Build installed, but previous output cleanup failed at ' + backup, { cause: error });
  }
}

function main() {
  if (process.argv.length !== 2) throw new Error('Usage: node scripts/build.js');
  require('./docs.js').generate(root);
  const staging = fs.mkdtempSync(path.join(root, '.go-objects-build-'));
  let failed = false;
  let failure;
  try {
    const consumer = path.join(staging, 'package');
    const count = generate(consumer);
    const check = spawnSync(process.execPath, [path.join(__dirname, 'build-smoke.js'), consumer], {
      encoding: 'utf8',
      timeout: 30000
    });
    if (check.error || check.status !== 0)
      throw new Error(check.error?.message || check.stderr || check.stdout || 'Generated format checks failed.');
    assertCompleted(check.stdout, 'go-objects generated format checks completed', 'Generated format checks');
    replaceOutputs(staging);
    console.log('Built ' + count + ' utilities: static ESM graph, UMD, standalone ESM and declarations.');
  } catch (error) {
    failed = true;
    failure = error;
  }
  try {
    fs.rmSync(staging, { recursive: true, force: true });
  } catch (cleanupError) {
    if (failed)
      throw new AggregateError([failure, cleanupError], 'Build failed; cleanup also failed at ' + staging, {
        cause: cleanupError
      });
    throw cleanupError;
  }
  if (failed) throw failure;
}
main();
