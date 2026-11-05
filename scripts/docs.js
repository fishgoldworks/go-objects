'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { consumerEngines } = require('./package-layout');
const documents = ['README.md', 'docs/API.md', 'docs/MIGRATION.md'];
const slug = (title) =>
  title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/ /g, '-');
function headings(text) {
  let fence;
  const counts = new Map();
  return text.split('\n').flatMap((line) => {
    const marker = /^ {0,3}(\x60{3,}|~{3,})(.*)$/.exec(line);
    if (fence) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim())
        fence = undefined;
      return [];
    }
    if (marker) {
      fence = marker[1];
      return [];
    }
    const match = /^(#{1,6}) (.+)$/.exec(line);
    if (!match) return [];
    const base = slug(match[2]),
      count = counts.get(base) || 0;
    counts.set(base, count + 1);
    return [{ level: match[1].length, title: match[2], anchor: base + (count ? '-' + count : '') }];
  });
}
function entries(reference) {
  let category = '';
  return [...reference.matchAll(/^(#{2,3}) (.+)\n([\s\S]*?)(?=^#{2,3} |$(?![\s\S]))/gm)].flatMap((match) => {
    if (match[1] === '##') {
      category = match[2];
      return [];
    }
    if (!/^\x60[^\x60]+\x60$/.test(match[2])) return [];
    return [
      {
        title: match[2].replace(/\x60/g, ''),
        body: match[3],
        purpose: match[3].trim().split('\n\n')[0].replace(/\n/g, ' '),
        category
      }
    ];
  });
}
function summary(reference, api) {
  if (typeof api === 'function' && api.prototype?.unwrap && api.prototype?.result)
    api = {
      ...api,
      Objects: api,
      'new Objects': api,
      'wrapper.unwrap': api.prototype.unwrap,
      'wrapper.result': api.prototype.result
    };
  const all = entries(reference),
    links = headings(reference),
    table = [],
    groups = [],
    q = String.fromCharCode(96);
  const used = new Set();
  let category;
  for (const entry of all) {
    const name = entry.title.split('(')[0];
    if (!Object.hasOwn(api, name)) continue;
    assert.ok(!used.has(name), 'Duplicate public API: ' + name);
    used.add(name);
    if (entry.category !== category) {
      category = entry.category;
      groups.push(category);
      table.push(
        (table.length ? '\n' : '') + '### ' + category,
        '',
        '| API | Description | Returns |',
        '| --- | --- | --- |'
      );
    }
    const escape = (text) => text.replace(/(?<!\\)\|/g, '\\|');
    let result = '—';
    if (typeof api[name] === 'function') {
      assert.match(entry.body, /\*\*Parameters\*\*/, 'Document parameters: ' + name);
      assert.match(entry.body, /\*\*Examples\*\*[\s\S]*\x60\x60\x60javascript/, 'Document examples: ' + name);
      const returns = /\*\*Returns:\*\* \x60([^\x60]+)\x60 — ([^\n]+)/.exec(entry.body);
      assert.ok(returns, 'Document return contract: ' + name);
      result = '**' + q + escape(returns[1]) + q + '**<br><br>' + escape(returns[2]);
    } else {
      assert.match(entry.body, /\*\*Value:\*\*/, 'Document constant value: ' + name);
    }
    const anchor = links.find((h) => h.title.replace(/\x60/g, '') === entry.title).anchor;
    table.push(
      '| [' + q + entry.title + q + '](docs/API.md#' + anchor + ') | ' + escape(entry.purpose) + ' | ' + result + ' |'
    );
  }
  for (const name of Object.keys(api)) assert.ok(used.has(name), 'Document public API: ' + name);
  const navigation =
    groups.length > 1 ? groups.map((group) => '[' + group + '](#' + slug(group) + ')').join(' · ') + '\n\n' : '';
  return navigation + table.join('\n');
}
function render(template, metadata, api, reference) {
  const fields = {
    VERSION: metadata.version,
    NAME: metadata.name,
    LICENSE: metadata.license,
    NODE_ENGINE: consumerEngines.node,
    NODE_MINIMUM: consumerEngines.node.replace(/^>=/, ''),
    API_COUNT: String(Object.keys(api).length),
    TYPESCRIPT_VERSION: metadata.devDependencies.typescript,
    CALLABLE_COUNT: String(Object.values(api).filter((value) => typeof value === 'function').length),
    CONSTANT_COUNT: String(Object.values(api).filter((value) => typeof value !== 'function').length),
    API_SUMMARY: reference ? summary(reference, api) : '',
    TOC: '{{TOC}}'
  };
  const source = template.replace(/\r\n/g, '\n').replace(/\{\{([A-Z_]+)\}\}/g, (_, name) => {
    assert.equal(typeof fields[name], 'string', 'Unknown documentation field: ' + name);
    return fields[name];
  });
  assert.equal(source.split('{{TOC}}').length, 2, 'Expected one navigation placeholder');
  const links = headings(source)
    .filter((h) => h.level === 2 && h.title !== 'Contents')
    .map((h) => '- [' + h.title + '](#' + h.anchor + ')');
  return source.replace('{{TOC}}', links.join('\n'));
}
function validateLinks(directory, outputs = {}) {
  for (const file of documents) {
    if (file === 'docs/MIGRATION.md' && !fs.existsSync(path.join(directory, file))) continue;
    const text = outputs[file] ?? fs.readFileSync(path.join(directory, file), 'utf8');
    for (const [, target] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
      if (/^(?:https?:|mailto:)/.test(target)) continue;
      const [relative, fragment] = target.split('#');
      const full = path.resolve(directory, path.dirname(file), relative || path.basename(file));
      const resolved = path.relative(directory, full).replace(/\\/g, '/');
      assert.ok(
        outputs[resolved] !== undefined || fs.existsSync(full),
        'Missing documentation link: ' + file + ' -> ' + target
      );
      if (fragment) {
        const destination = outputs[resolved] ?? fs.readFileSync(full, 'utf8');
        assert.ok(
          headings(destination).some((h) => h.anchor === fragment),
          'Missing documentation heading: ' + target
        );
      }
    }
    const contents = /^## Contents\n([\s\S]*?)(?=^## |$(?![\s\S]))/m.exec(text);
    if (contents)
      for (const [, target] of contents[1].matchAll(/\]\(([^)]+)\)/g))
        assert.ok(target.startsWith('#'), 'Contents must link to local sections: ' + target);
  }
}
function generate(directory = path.resolve(__dirname, '..'), check = false) {
  const metadata = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
  const api = require(path.join(directory, 'index.js'));
  const template = (name) => fs.readFileSync(path.join(directory, 'scripts', name), 'utf8');
  const reference = render(template('API.template.md'), metadata, api);
  const outputs = {
    'docs/API.md': reference,
    'README.md': render(template('README.template.md'), metadata, api, reference)
  };
  validateLinks(directory, outputs);
  for (const file of ['README.md', 'docs/API.md']) {
    const destination = path.join(directory, file);
    if (check)
      assert.equal(
        fs.readFileSync(destination, 'utf8').replace(/\r\n/g, '\n'),
        outputs[file],
        file + ' is stale; run npm run docs.'
      );
    else {
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, outputs[file]);
    }
  }
  return outputs;
}
module.exports = Object.assign(render, { render, generate, summary, headings, entries, validateLinks, documents });
if (require.main === module) {
  const flags = process.argv.slice(2);
  assert.ok(
    flags.length === 0 || (flags.length === 1 && flags[0] === '--check'),
    'Usage: node scripts/docs.js [--check]'
  );
  generate(undefined, flags.length > 0);
  console.log(
    flags.length ? 'README and full API documentation are current.' : 'Generated README and full API documentation.'
  );
}
