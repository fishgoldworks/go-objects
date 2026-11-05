'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(process.env.BROWSER_PACKAGE_ROOT || path.join(__dirname, '../package'));
const contract = fs.readFileSync(path.join(__dirname, '../test/browser/bundle-contract.js'), 'utf8');
for (const filename of ['go-objects.js', 'go-objects.min.js']) {
  test(filename + ' maps, notices, loaders and documented example', () => {
    const source = fs.readFileSync(path.join(root, 'dist', filename), 'utf8');
    assert.ok(source.startsWith('/*! go-objects v'));
    assert.match(source, /Permission is hereby granted/);
    assert.ok(source.includes('sourceMappingURL=' + filename + '.map'));
    const map = JSON.parse(fs.readFileSync(path.join(root, 'dist', filename + '.map'), 'utf8'));
    assert.equal(map.file, filename);
    assert.ok(map.mappings.length > 0 && map.sources.length > 0);
    assert.equal(map.sourcesContent.length, map.sources.length);
    for (const [index, name] of map.sources.entries()) {
      assert.ok(!path.isAbsolute(name) && !name.includes('\\'));
      assert.ok(map.sourcesContent[index].length > 0);
    }
    for (const mode of ['global', 'commonjs', 'amd']) {
      const context = {};
      if (mode === 'commonjs') context.module = { exports: {} };
      if (mode === 'amd') {
        context.define = (dependencies, factory) => {
          assert.equal(dependencies.length, 0);
          context.api = factory();
        };
        context.define.amd = {};
      }
      vm.runInNewContext(source, context, { timeout: 5000 });
      context.api = mode === 'global' ? context.Objects : mode === 'commonjs' ? context.module.exports : context.api;
      delete context.module;
      vm.runInNewContext(contract + '\ncheckBrowserBundle(api);', context, { timeout: 5000 });
    }
    const metadata = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    const cdnPrefix = 'https://cdn.jsdelivr.net/npm/' + metadata.name + '@' + metadata.version + '/';
    const html = fs
      .readFileSync(path.join(root, 'README.md'), 'utf8')
      .replaceAll(cdnPrefix, './')
      .match(/```html\r?\n([\s\S]*?)```/)[1];
    assert.match(html, /<script src=".\/dist\/go-objects\.js"><\/script>/);
    const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
    const context = { console: { log() {} } };
    vm.runInNewContext(source + '\n' + script + '\n' + contract + '\ncheckBrowserBundle(Objects);', context);
  });
}
test('minified distribution is smaller than its readable counterpart', () => {
  assert.ok(
    fs.statSync(path.join(root, 'dist/go-objects.min.js')).size <
      fs.statSync(path.join(root, 'dist/go-objects.js')).size
  );
});
