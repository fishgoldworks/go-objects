// These are runnable, safe consumers of the counterexamples in regressions.cts.
import O = require('go-objects');
function equal(actual: unknown, expected: unknown): void {
  if (!Object.is(actual, expected)) throw new Error('Runtime/type regression: unexpected result');
}
const selected: ('name' | 'age')[] = ['name'];
const picked = O.pick({ name: 'Michael', age: 42 }, selected);
equal(picked.name, 'Michael');
equal(picked.age, undefined);
if (picked.age !== undefined) equal(picked.age.toFixed(0), '42');
const override: { port?: string } = {};
const merged = O.merge({ port: 8080 }, override);
equal(merged.port, 8080);
if (typeof merged.port === 'number') equal(merged.port.toFixed(0), '8080');
const dynamicSources: { port: string }[] = [{ port: 'auto' }];
const spread = O.merge({ port: 8080 }, ...dynamicSources);
equal(spread.port, 'auto');
const profile = { age: 42, name: 'Michael' };
O.replace(profile, 42, 43);
equal(profile.age.toFixed(0), '43');
const original = O(profile),
  names = original.keys();
equal(original.unwrap(), profile);
equal(names.unwrap().includes('age'), true);
const state = { profile, untouched: { n: 1 } };
const changed = O.setImmutable(state, ['profile', 'age'] as const, 'unknown');
equal(changed.profile.age.toUpperCase(), 'UNKNOWN');
equal(state.profile.age.toFixed(0), '43');
equal(changed.untouched, state.untouched);
const entry = O.findEntry(profile, (v): v is number => typeof v === 'number');
if (entry) {
  equal(entry[0], 'age');
  equal(entry[1].toFixed(0), '43');
} else throw new Error('Expected a narrowed entry');
const deep = O.deepFindEntry(state, (v): v is number => typeof v === 'number');
if (deep) equal(deep[1].toFixed(0), '43');
else throw new Error('Expected a deep entry');

// Optional intermediate creation is safe when the whole required shape is supplied.
const optionalSettings: { settings?: { email: boolean; locale: string } } = {};
O.set(optionalSettings, ['settings'], { email: true, locale: 'en' });
equal(optionalSettings.settings?.locale.toUpperCase(), 'EN');
const completeSettings: { settings?: { email: boolean; locale?: string } } = {};
O.set(completeSettings, ['settings', 'email'], true);
equal(completeSettings.settings?.email, true);
const optionalNumber: { n?: number } = {};
O.update(optionalNumber, 'n', (n) => (n ?? 0) + 1);
if ('n' in optionalNumber) equal(optionalNumber.n.toFixed(0), '1');
O.unset(optionalNumber, 'n');
equal('n' in optionalNumber, false);
function exerciseUnion(record: { kind: 'a'; n: number } | { kind: 'b'; n: number }) {
  const original = O(record),
    changed = original.update('n', (n) => (n ?? 0) + 1);
  equal(changed.unwrap(), record);
  equal(original.unwrap(), record);
  equal(record.n.toFixed(0), '2');
  equal(changed.result(), 1);
}
exerciseUnion({ kind: 'a', n: 1 });
exerciseUnion({ kind: 'b', n: 1 });
function exerciseMatch(record: { kind: 'a'; n: number } | { kind: 'b'; n: string }) {
  O.replace(record, 1, 2);
  if (record.kind === 'a') equal(record.n.toFixed(0), '2');
  else equal(record.n.toUpperCase(), 'ONE');
}
exerciseMatch({ kind: 'a', n: 1 });
exerciseMatch({ kind: 'b', n: 'one' });

// Follow-up review: emitted safe counterparts for dictionary and readonly typing.
{
  const dictionary: Record<string, number> = { n: 1 };
  const label = O.setImmutable(dictionary, 'label', 'new');
  const key: string = 'label';
  const dynamicValue = label[key];
  if (typeof dynamicValue === 'string') equal(dynamicValue.toUpperCase(), 'NEW');
  else throw new Error('Expected the newly written string');
  equal(dictionary.n, 1);
  equal(dictionary[key], undefined);
  const mergedDictionary = O.merge(dictionary, { label: 'merged' });
  const mergedValue = mergedDictionary[key];
  if (typeof mergedValue === 'string') equal(mergedValue.toUpperCase(), 'MERGED');
  else throw new Error('Expected the overriding string');
  const numericAliases = O.merge({ 0: 'old' }, { '0': 3 });
  equal(numericAliases[0].toFixed(0), '3');
  const symbols: Record<symbol, number> = {};
  const id = Symbol('id');
  const symbolResult = O.setImmutable(symbols, id, 'symbol');
  equal(symbolResult[id].toUpperCase(), 'SYMBOL');
  const optionalAlias: { '0'?: number } = {};
  const optionalMerge = O.merge({ 0: 'old' }, optionalAlias);
  if (typeof optionalMerge[0] === 'string') equal(optionalMerge[0].toUpperCase(), 'OLD');
  const frozen = Object.freeze({ n: 1 });
  const noOp = O.setImmutable(frozen, 'n', 1);
  equal(noOp, frozen);
  equal(Object.isFrozen(noOp), true);
  const changed = O.updateImmutable(frozen, 'n', (n) => (n ?? 0) + 1);
  equal(changed.n, 2);
  equal(frozen.n, 1);
}

// Final review: deleting through array/dictionary index domains changes the
// child's shape, while untouched fields and off-path references survive.
const finalRows = [
  { name: 'Michael', age: 42 },
  { name: 'Other', age: 30 }
];
const finalDeleted = O.unsetImmutable(finalRows, [0, 'name']);
equal(Object.hasOwn(finalDeleted[0]!, 'name'), false);
equal(finalDeleted[0]!.age, 42);
equal(finalRows[0]!.name, 'Michael');
equal(finalDeleted[1], finalRows[1]);
const finalUsers: Record<string, { name: string; age: number }> = { a: finalRows[0]! };
const finalUserDeleted = O.unsetImmutable(finalUsers, ['a', 'name']);
equal(Object.hasOwn(finalUserDeleted.a!, 'name'), false);
equal(finalUserDeleted.a!.age, 42);
const finalWrapped = O(finalUsers).unsetImmutable(['a', 'name']);
equal(finalWrapped.result(), finalWrapped.unwrap());
equal(Object.hasOwn(finalWrapped.unwrap().a!, 'name'), false);
const finalTuple: [{ name: string; age: number }, { name: string; age: number }] = [finalRows[0]!, finalRows[1]!];
const finalTupleDeleted = O.unsetImmutable(finalTuple, [0, 'name']);
equal(finalTupleDeleted[0].age, 42);
equal(finalTupleDeleted[1].name, 'Other');

type OwnershipVariant = { item: number } | { other: string };
function checkedOwnership(value: OwnershipVariant): string {
  if (!O.hasProp(value, 'item')) {
    // A false ownership result does not exclude the inherited item variant.
    return 'other' in value ? value.other.toUpperCase() : value.item.toFixed();
  }
  return 'item' in value ? value.item.toFixed() : value.other;
}
class InheritedItem {
  get item() {
    return 1;
  }
}
equal(checkedOwnership(new InheritedItem()), '1');
equal(checkedOwnership({ item: 2 }), '2');
equal(checkedOwnership({ other: 'valid' }), 'VALID');
const hiddenItem = { item: 3 };
Object.defineProperty(hiddenItem, 'item', { enumerable: false });
equal(O.hasKey(hiddenItem, 'item'), false);
equal(checkedOwnership(hiddenItem), '3');

// The imported fixture runs before the parent completion marker.
import './read-transform-runtime.cjs';
import './mutation-runtime.cjs';

console.log('TypeScript runtime regression fixture completed');
