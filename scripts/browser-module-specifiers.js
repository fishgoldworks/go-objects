'use strict';
// The browser transport rewrites only syntax-node spans. JavaScript strings,
// templates and comments may contain identical-looking import text as data.
const ts = require('typescript');
function moduleSpecifiers(source, filename = 'browser-module.mjs') {
  const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  if (ast.parseDiagnostics.length) throw new SyntaxError('Invalid browser module: ' + filename);
  const imports = [];
  for (const statement of ast.statements) {
    if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
    const specifier = statement.moduleSpecifier;
    if (!specifier) continue;
    if (!ts.isStringLiteral(specifier)) throw new Error('Non-static browser module: ' + filename);
    const value = specifier.text;
    if (!value.startsWith('./') && !value.startsWith('../')) throw new Error('External module ' + value);
    imports.push({ start: specifier.getStart(ast), end: specifier.end, value });
  }
  return imports;
}
module.exports = { moduleSpecifiers };
