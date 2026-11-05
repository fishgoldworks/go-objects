'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const api = require('..');
for (const file of ['README.md', 'docs/API.md', 'docs/MIGRATION.md']) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  for (const [index, match] of [...source.matchAll(/\x60\x60\x60javascript\n([\s\S]*?)\x60\x60\x60/g)].entries()) {
    if (/^\s*import /m.test(match[1]) || /\/\/ => throws /.test(match[1])) continue;
    test(file + ' JavaScript example ' + (index + 1) + ' executes', () => {
      vm.runInNewContext(
        match[1],
        {
          require: (specifier) => {
            if (specifier === 'go-objects') return api;
            if (specifier.startsWith('go-objects/')) return require('../src/' + specifier.slice('go-objects/'.length));
            throw new Error('Unexpected example import: ' + specifier);
          },
          console
        },
        { timeout: 1000 }
      );
    });
  }
}
test('full reference and linked summary cover utilities and wrappers', () => {
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8'),
    reference = fs.readFileSync(path.join(root, 'docs/API.md'), 'utf8');
  for (const name of Object.keys(api)) {
    assert.ok(reference.includes('### `' + name + '('), name);
    assert.ok(reference.includes('wrapper.' + name + '('), 'wrapper ' + name);
    assert.ok(readme.includes('docs/API.md#' + name.toLowerCase()), name + ' link');
  }
  for (const name of ['Objects', 'new Objects', 'wrapper.unwrap', 'wrapper.result'])
    assert.ok(reference.includes('### `' + name + '('), name);
});
