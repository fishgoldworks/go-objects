import assert from 'assert';
import O, { get, deepClone } from 'go-objects';
import check from './contracts.js';
import bundle from 'go-objects/dist/go-objects.mjs';
assert.strictEqual(get, O.get);
assert.strictEqual(deepClone, O.deepClone);
check(O);
check(bundle);
async function main() {
  for (const name of Object.keys(O))
    for (const suffix of [name, 'src/' + name, 'src/' + name + '.js', 'esm/' + name + '.mjs']) {
      const imported = await import('go-objects/' + suffix);
      assert.strictEqual(imported.default, O[name], suffix);
      assert.strictEqual(imported[name], O[name], suffix);
    }
  console.log(process.version + ': native default/named ESM and standalone ESM consumer contracts passed');
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
