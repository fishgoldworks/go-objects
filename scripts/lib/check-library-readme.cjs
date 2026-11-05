'use strict';

// Shared checker for MIT library READMEs. Keep this copy in sync with the
// canonical checker distributed alongside the library review instructions.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const process = require('node:process');

const order = [
  'Contents',
  'Installation',
  'Usage',
  'API summary',
  'Behaviour',
  'TypeScript',
  'Performance',
  'Migration',
  'Development',
  'Further reading',
  'Licence'
];
const required = ['Contents', 'Installation', 'Usage', 'API summary', 'Licence'];

function proseLines(markdown) {
  let fence;
  return markdown
    .replace(/\r\n/g, '\n')
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n')
    .map((line) => {
      const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
      if (fence) {
        if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) {
          fence = undefined;
        }
        return '';
      }
      if (!marker) {
        return line;
      }
      fence = marker[1];
      return '';
    });
}

function headingSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

function linkTargets(lines) {
  return [...lines.join('\n').matchAll(/\]\(([^)\s]+)\)/g)].map((match) => match[1]);
}

function checkReadme(markdown, label = 'README') {
  const lines = proseLines(markdown);
  const sections = lines.flatMap((line, index) => {
    const match = /^## (.+)$/.exec(line);
    return match ? [{ title: match[1], index }] : [];
  });
  const titles = sections.map(({ title }) => title);
  const check = (condition, message) => assert.ok(condition, label + ': ' + message);
  const template = /(?:^|[/\\])README\.template\.md$/.test(label);
  check(lines.filter((line) => /^# \S/.test(line)).length === 1, 'use exactly one project title');
  for (const heading of required) {
    check(titles.includes(heading), 'missing section heading ' + heading);
  }
  let previous = -1;
  for (const title of titles) {
    const index = order.indexOf(title);
    if (index < 0) {
      const equivalent = order.some((heading) => heading.toLowerCase() === title.toLowerCase());
      check(
        !equivalent && !['Behavior', 'License', 'API reference'].includes(title),
        'nonstandard section heading ' + title
      );
      continue;
    }
    check(index > previous, 'duplicate or out-of-order section heading ' + title);
    previous = index;
  }
  const contents = sections.findIndex(({ title }) => title === 'Contents');
  const contentsLines = lines.slice(sections[contents].index + 1, sections[contents + 1].index);
  const opening = lines.slice(0, sections[contents].index).filter((line) => line.trim());
  check(
    opening.at(-1) === '**[View full API documentation](docs/API.md)**',
    'opening API link must use the shared label and destination immediately before Contents'
  );
  const version = opening.findIndex((line) => /^- \*\*Version:\*\* \[[^\]]+\]\(CHANGELOG\.md\)$/.test(line));
  const licenceLink = opening[version + 1];
  const templateLicence = template && licenceLink === '- **Licence:** [{{LICENSE}}](LICENSE.md)';
  check(
    version >= 0 && (licenceLink === '- **Licence:** [MIT](LICENSE.md)' || templateLicence),
    'project information must list the linked Version and Licence in order'
  );
  const contentsTargets = linkTargets(contentsLines);
  if (!template || !contentsLines.includes('{{TOC}}')) {
    check(
      contentsTargets.filter((target) => target === '#api-summary').length === 1 &&
        contentsLines.includes('- [API summary](#api-summary)'),
      'Contents must have exactly one API summary entry'
    );
  }
  const licence = sections.find(({ title }) => title === 'Licence').index;
  const summary = sections.findIndex(({ title }) => title === 'API summary');
  const summaryLines = lines.slice(sections[summary].index + 1, sections[summary + 1].index);
  const [intro, navigation] = summaryLines
    .join('\n')
    .trimStart()
    .split(/\n\s*\n/, 2);
  check(
    intro.replace(/\s+/g, ' ') ===
      'See the **[full API documentation](docs/API.md)** for parameters, return values, errors and examples.',
    'API summary must open with the shared reference sentence'
  );
  const nonempty = summaryLines.filter((line) => line.trim());
  const tableHeadings = nonempty.flatMap((line, index) =>
    line === '| API | Description | Returns |' ? [nonempty[index - 1]] : []
  );
  if (tableHeadings.length > 1) {
    check(
      tableHeadings.every((heading) => /^### \S/.test(heading)),
      'each API table needs an H3 group heading'
    );
    const groups = tableHeadings.map((heading) => heading.slice(4));
    const anchors = groups.map((group) => '#' + headingSlug(group));
    const pageAnchors = lines.flatMap((line) => {
      const heading = /^#{1,6} (.+)$/.exec(line);
      return heading ? ['#' + headingSlug(heading[1])] : [];
    });
    check(
      anchors.every((anchor) => pageAnchors.filter((candidate) => candidate === anchor).length === 1),
      'API group headings must have unique anchors'
    );
    check(
      navigation === groups.map((group, index) => `[${group}](${anchors[index]})`).join(' · '),
      'API group jump links must follow the reference sentence and target every local group heading in order'
    );
    check(
      anchors.every((anchor) => !contentsTargets.includes(anchor)),
      'Contents must omit API group entries'
    );
  }
  const licenceSentence = lines.slice(licence + 1).find((line) => line.trim());
  check(
    licenceSentence === 'Licensed under the [MIT licence](LICENSE.md).' ||
      (template && licenceSentence === 'Licensed under the [{{LICENSE}} licence](LICENSE.md).'),
    'Licence sentence must be “Licensed under the [MIT licence](LICENSE.md).”'
  );
}

function checkReadmeFile(file) {
  const markdown = fs.readFileSync(file, 'utf8');
  checkReadme(markdown, file);
  return markdown;
}

function checkContributorLink(file) {
  const targets = linkTargets(proseLines(checkReadmeFile(file)));
  assert.ok(
    targets.some((target) =>
      /^https:\/\/github\.com\/[^/]+\/[^/]+\/blob\/[^/#]+\/CONTRIBUTING\.md(?:#.*)?$/.test(target)
    ),
    file + ': link to root CONTRIBUTING.md in the repository'
  );
}

function checkRepository(root) {
  const guide = path.join(root, 'CONTRIBUTING.md');
  assert.ok(fs.statSync(guide, { throwIfNoEntry: false })?.isFile(), root + ': missing root CONTRIBUTING.md');
  const copy = path.join(root, 'scripts', 'lib', 'check-library-readme.cjs');
  assert.ok(
    fs.existsSync(copy) &&
      fs.readFileSync(copy, 'utf8').replace(/\r\n/g, '\n') ===
        fs.readFileSync(require.resolve('./check-library-readme.cjs'), 'utf8').replace(/\r\n/g, '\n'),
    root + ': missing or stale copy of the shared README checker'
  );
  checkContributorLink(path.join(root, 'README.md'));
  const template = path.join(root, 'scripts', 'README.template.md');
  if (fs.existsSync(template)) {
    checkContributorLink(template);
  }

  const agents = path.join(root, 'AGENTS.md');
  if (!fs.existsSync(agents)) {
    return;
  }
  const targets = linkTargets(proseLines(fs.readFileSync(agents, 'utf8')));
  assert.ok(
    targets.some((target) => /^(?:\.\/)?CONTRIBUTING\.md(?:#.*)?$/.test(target)),
    agents + ': link to root CONTRIBUTING.md'
  );
  for (const target of targets) {
    if (/^(?:https?:|mailto:)/.test(target)) {
      continue;
    }
    const [file, fragment] = target.split('#');
    const destination = path.resolve(root, file || 'AGENTS.md');
    assert.ok(fs.existsSync(destination), agents + ': missing linked file ' + target);
    if (fragment) {
      const headings = proseLines(fs.readFileSync(destination, 'utf8')).filter((line) => /^#{1,6} /.test(line));
      assert.ok(
        headings.some((heading) => headingSlug(heading.replace(/^#+ /, '')) === fragment),
        agents + ': missing linked heading ' + target
      );
    }
  }
}

function checkPackage(root) {
  checkContributorLink(path.join(root, 'README.md'));
  for (const file of ['CONTRIBUTING.md', 'AGENTS.md']) {
    assert.ok(!fs.existsSync(path.join(root, file)), root + ': ' + file + ' must stay in the source repository');
  }
}

module.exports = checkReadme;
module.exports.checkRepository = checkRepository;
module.exports.checkPackage = checkPackage;

if (require.main === module) {
  const args = process.argv.slice(2);
  const mode = args[0];
  const check = mode === '--repository' ? checkRepository : mode === '--package' ? checkPackage : checkReadmeFile;
  const inputs = check === checkReadmeFile ? args : args.slice(1);
  assert.ok(inputs.length, 'Usage: node check-library-readme.cjs [--repository|--package] <path> [...]');
  for (const input of inputs) {
    check(input);
  }
  process.stdout.write('Shared documentation consistency checks passed for ' + inputs.length + ' input(s).\n');
}
