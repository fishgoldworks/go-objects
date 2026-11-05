'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { minify_sync: minify } = require('terser');

// Keep observable names, property access and callable host-object semantics intact.
module.exports = function browserBundles(root, name, source) {
  const metadata = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const notices = ['LICENSE.md', 'LICENSE', 'THIRD_PARTY_NOTICES']
    .filter((file) => fs.existsSync(path.join(root, file)))
    .map((file) => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n').trim());
  const notice = `/*! ${metadata.name} v${metadata.version} | ${metadata.license}\n\n${notices.join('\n\n')}\n*/`;
  const filename = name + '.js';
  const readable = minify(
    { [name + '.source.js']: source },
    {
      ecma: 2017,
      compress: false,
      mangle: false,
      format: { beautify: true, comments: false, preamble: notice },
      sourceMap: { filename, url: filename + '.map', includeSources: true }
    }
  );
  const minifiedName = name + '.min.js';
  const minified = minify(
    { [filename]: readable.code },
    {
      ecma: 2017,
      compress: { comparisons: false, typeofs: false, pure_getters: false },
      mangle: { properties: false },
      keep_fnames: true,
      keep_classnames: true,
      format: { comments: false, preamble: notice },
      sourceMap: { content: readable.map, filename: minifiedName, url: minifiedName + '.map', includeSources: true }
    }
  );
  const output = {};
  for (const [file, result] of [
    [filename, readable],
    [minifiedName, minified]
  ]) {
    if (typeof result.code !== 'string' || typeof result.map !== 'string')
      throw new Error('Browser compilation did not produce code and a source map');
    output[file] = result.code + '\n';
    output[file + '.map'] = result.map + '\n';
  }
  return output;
};
