'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os'),
  assert = require('node:assert/strict');
const { run, npm } = require('./consumer-tools');
const root = path.resolve(__dirname, '..');
function packPackage(destination = path.join(root, 'artifacts')) {
  destination = path.resolve(destination);
  run(process.execPath, [path.join(__dirname, 'build.js')], root, true);
  fs.mkdirSync(destination, { recursive: true });
  // Retained local experiments are not publishable inputs. Pack a filtered copy,
  // leaving the complete generated output and the user's experiments in place.
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'go-objects-pack-'));
  try {
    const packageRoot = path.join(root, 'package');
    const consumer = path.join(temporary, 'package');
    fs.cpSync(packageRoot, consumer, {
      recursive: true,
      filter: (file) => !require('./package-layout').isTemporaryPath(path.relative(packageRoot, file))
    });
    const [packed] = JSON.parse(
      npm(['pack', '--ignore-scripts', '--json', '--pack-destination', destination], consumer)
    );
    const tarball = path.join(destination, packed.filename);
    console.log('Packed consumer candidate: ' + tarball);
    return tarball;
  } finally {
    assert.equal(path.dirname(temporary), path.resolve(os.tmpdir()));
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}
module.exports = packPackage;
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length && !(args.length === 2 && args[0] === '--destination' && args[1] && !args[1].startsWith('--')))
    throw Error('Usage: node scripts/pack-package.js [--destination DIRECTORY]');
  packPackage(args[1]);
}
