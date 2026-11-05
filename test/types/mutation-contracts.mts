import O, { set, unset, setImmutable } from 'go-objects';
// compile-only failures and safe counterparts; do not execute negative cases.
type Same<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;
declare const stringKey: string;
declare const numberKey: number;
declare const symbolKey: symbol;
declare const patternKey: `item_${string}`;
declare const numberPattern: `${number}`;
declare const bigintPattern: `id_${bigint}`;
declare const uppercaseKey: Uppercase<string>;

// GOBJ-008: a string pattern can contain path delimiters; it is not one literal key.
const numbers: Record<`item_${string}`, number> = { item_a: 1, item_b: 2 };
// @ts-expect-error A parsed patterned string can manufacture a wrongly shaped dictionary member.
O.set(numbers, patternKey, 3);
// @ts-expect-error Batch writes must not bypass the same parsed-string restriction.
O.setEach(numbers, [patternKey], 3);
// @ts-expect-error An updater result cannot make an unknown parsed destination safe.
O.update(numbers, patternKey, () => 3);
// @ts-expect-error Wrapper calls retain parsed-path safety.
O(numbers).set(patternKey, 3);
// @ts-expect-error Standalone calls retain parsed-path safety.
set(numbers, patternKey, 3);
const optionalNamed: { item_a?: { n: number } } = {};
// @ts-expect-error This parsed pattern could delete a required descendant (item_a.n).
O.unset(optionalNamed, patternKey);
const nestedNumbers: Record<`item_${string}`, { n: number }> = { item_a: { n: 1 } };
const read = O.get(nestedNumbers, patternKey);
// @ts-expect-error The parser can return a descendant, not the literal-key value type.
read?.n.toFixed();
type ReadUnknown = Assert<Same<typeof read, unknown>>;
const defaultRead = O.get(nestedNumbers, patternKey, { n: 0 });
type DefaultReadUnknown = Assert<Same<typeof defaultRead, unknown>>;
const batchRead = O.getEach(nestedNumbers, [patternKey]);
type BatchReadUnknown = Assert<Same<typeof batchRead, [unknown]>>;
const wrappedRead = O(nestedNumbers).get(patternKey).result();
type WrappedReadUnknown = Assert<Same<typeof wrappedRead, unknown>>;
const parsedUpdate = O.updateImmutable(nestedNumbers, patternKey, (previous) => {
  // @ts-expect-error Callback-body inference must not claim a known literal-key value.
  previous?.n.toFixed();
  return typeof previous === 'number' ? previous + 1 : previous;
});
type ParsedUpdateUnknown = Assert<Same<typeof parsedUpdate, unknown>>;

const parsedSet = O.setImmutable(numbers, patternKey, 'changed');
// @ts-expect-error Parsed patterned strings cannot describe every matching entry as updated.
parsedSet.item_b!.toUpperCase();
type ParsedSetUnknown = Assert<Same<typeof parsedSet, unknown>>;
const parsedUnset = O.unsetImmutable(nestedNumbers, patternKey);
type ParsedUnsetUnknown = Assert<Same<typeof parsedUnset, unknown>>;

// GOBJ-009: a non-singleton segment may address any overlapping required key.
const required = { name: 'Michael', age: 42 };
// @ts-expect-error Broad string tuple keys can delete required known properties.
O.unset(required, [stringKey]);
// @ts-expect-error Requiredness also holds through wrappers.
O(required).unset([stringKey]);
// @ts-expect-error Standalone deletion has the same restriction.
unset(required, [stringKey]);
const requiredAndIndex: { name: string; [key: string]: string } = { name: 'Michael' };
// @ts-expect-error An index signature must not hide an overlapping required property.
O.unset(requiredAndIndex, [stringKey]);
const tuple: [number, number?] = [1];
// @ts-expect-error An unknown numeric index can address required tuple index 0.
O.unset(tuple, [numberKey]);
// @ts-expect-error Numeric strings can address the same required tuple index.
O.unset(tuple, [numberPattern]);
const requiredSymbol = Symbol('required');
const symbolRecord = { [requiredSymbol]: 1 };
// @ts-expect-error A broad symbol can be the required symbol.
O.unset(symbolRecord, [symbolKey]);
const requiredPatterns = { item_a: { name: 'A' }, item_b: { name: 'B' } };
// @ts-expect-error Patterned keys may address an existing required member.
O.unset(requiredPatterns, [patternKey]);
// @ts-expect-error Requiredness must hold at a descendant reached by a patterned key.
O.unset(requiredPatterns, [patternKey, 'name']);
// @ts-expect-error The broad string case must also follow potential descendants.
O.unset(requiredPatterns, [stringKey, 'name']);
const rows: { name: string }[] = [{ name: 'A' }];
// @ts-expect-error Broad array indices do not make required element fields optional.
O.unset(rows, [numberKey, 'name']);
declare const unionRecord: { left: { n: number } } | { right: { n?: number } };
// @ts-expect-error One possible destination contains a required descendant.
O.unset(unionRecord, [stringKey, 'n']);

// Non-singleton immutable segments must not retag every possible slot or ignore real edits.
const changed = O.setImmutable(numbers, [patternKey], 'changed');
// @ts-expect-error Untouched item_b can still contain a number.
changed.item_b!.toUpperCase();
type PatternSetUnknown = Assert<Same<typeof changed, unknown>>;
const updated = O.updateImmutable(numbers, [patternKey], (previous) => {
  const n: number | undefined = previous;
  // @ts-expect-error A tuple segment is literal indexing, not an untyped callback.
  const wrong: string = previous;
  return String(n ?? 0);
});
type PatternUpdateUnknown = Assert<Same<typeof updated, unknown>>;
const deleted = O.unsetImmutable(requiredPatterns, [patternKey, 'name']);
// @ts-expect-error The selected known member can have lost its required name.
deleted.item_a.name.toUpperCase();
type PatternUnsetUnknown = Assert<Same<typeof deleted, unknown>>;
const standaloneChanged = setImmutable(numbers, [patternKey], 'changed');
type StandalonePatternUnknown = Assert<Same<typeof standaloneChanged, unknown>>;
const chained = O(numbers).updateImmutable([patternKey], (n) => String(n));
type WrapperPatternUnknown = Assert<Same<ReturnType<typeof chained.unwrap>, unknown>>;
type WrapperPatternResultUnknown = Assert<Same<ReturnType<typeof chained.result>, unknown>>;
const chainedDeletion = O(requiredPatterns).unsetImmutable([patternKey, 'name']).unwrap();
type WrapperDeletionUnknown = Assert<Same<typeof chainedDeletion, unknown>>;
const numericRecord: Record<`${number}`, number> = { 0: 1, 1: 2 };
const numericChanged = O.setImmutable(numericRecord, [numberPattern], 'changed');
type NumericPatternUnknown = Assert<Same<typeof numericChanged, unknown>>;
const bigintRecord: Record<`id_${bigint}`, number> = {};
const bigintChanged = O.setImmutable(bigintRecord, [bigintPattern], 'changed');
type BigintPatternUnknown = Assert<Same<typeof bigintChanged, unknown>>;
const upperRecord: Record<Uppercase<string>, number> = { A: 1, B: 2 };
const upperChanged = O.setImmutable(upperRecord, [uppercaseKey], 'changed');
type UppercasePatternUnknown = Assert<Same<typeof upperChanged, unknown>>;
const parentChanged = O.setImmutable({ rows: numbers, stable: true }, ['rows', patternKey], 'changed');
type OuterField = Assert<Same<typeof parentChanged.stable, boolean>>;
type InnerPatternUnknown = Assert<Same<typeof parentChanged.rows, unknown>>;
const parentDeleted = O.unsetImmutable({ rows: requiredPatterns, stable: true }, ['rows', patternKey, 'name']);
type DeletedOuterField = Assert<Same<typeof parentDeleted.stable, boolean>>;
type DeletedInnerUnknown = Assert<Same<typeof parentDeleted.rows, unknown>>;

// Valid-use controls: preserve literal reads/writes and safe broad tuple deletion.
const literalRead: number | undefined = O.get(numbers, ['item_a']);
const patternTupleRead: number | undefined = O.get(numbers, [patternKey]);
const literalNested: number | undefined = O.get(nestedNumbers, ['item_a', 'n']);
O.set(numbers, [patternKey], 3);
O.update(numbers, [patternKey], (previous) => {
  const n: number | undefined = previous;
  return (n ?? 0) + 1;
});
O.setEach(numbers, [[patternKey], ['item_a']], 3);
O.unset(numbers, [patternKey]);
O.unset(numbers, [stringKey]);
const optionalOnly: { maybe?: number } = {};
O.unset(optionalOnly, [stringKey]);
O.unset(required, [symbolKey]); // A symbol cannot address these string properties.
O.unset({ name: 'M', 0: 1 } as { name: string; 0?: number }, [numberKey]);
O.unset(tuple, [1]); // The fixed optional tuple slot remains deletable.
O.unset([1, 2] as number[], [numberKey]);
O.unset({ left: { n: 1 }, right: {} } as { left: { n?: number }; right: { n?: number } }, [stringKey, 'n']);
O.unset({ 1: { n: 1 } }, ['01', 'n']); // Not a canonical alias of the required key.
O.unset({ name: 'M' }, ['not-present']);
const dynamic: Record<string, unknown> = {};
O.unset(dynamic, patternKey);
O.set(dynamic, patternKey, { arbitrary: true });
O.deepRemoveAll(dynamic, () => false);
O.deepReplaceAll(dynamic, undefined, 1);
// @ts-expect-error A known deep schema cannot be erased by inference.
O.deepReplaceAll(requiredPatterns, () => true, 1);
const literalChanged = O.setImmutable(numbers, ['item_a'], 'changed');
const literalText: string = literalChanged.item_a;
const literalUnchanged: number | string | undefined = literalChanged.item_b;
const singletonPattern: `item_${'a'}` = 'item_a';
const singleton = O.setImmutable(numbers, [singletonPattern], 'changed');
const singletonText: string = singleton.item_a;
declare const finiteKey: `item_${'a' | 'b'}`;
const finite = O.setImmutable({ item_a: 1, item_b: 2 }, [finiteKey], 'changed');
const finiteValue: number | string = finite.item_a;
// @ts-expect-error One finite alternative does not change both properties.
const finiteAlwaysString: string = finite.item_b;
const finiteDeleted = O.unsetImmutable(requiredPatterns, [finiteKey, 'name']);
// @ts-expect-error Either selected child can have lost its name.
finiteDeleted.item_a.name.toUpperCase();
const frozen = Object.freeze({ n: 1 as number });
const noOp = O.setImmutable(frozen, ['n'], 1);
// @ts-expect-error A no-op can retain the frozen input.
noOp.n = 2;
const optionalExplicit: { n?: number | undefined } = {};
O.set(optionalExplicit, 'n', undefined);
O.update(optionalExplicit, 'n', (n) => n);
O.unset(optionalExplicit, 'n');
// @ts-expect-error Required numbers do not accept undefined writes.
O.update({ n: 1 }, 'n', () => undefined);
const incomplete: { settings?: { email: boolean; locale: string } } = {};
// @ts-expect-error A new intermediate must satisfy every required field.
O.set(incomplete, ['settings', 'email'], true);
O.set(incomplete, ['settings'], { email: true, locale: 'en' });
const mutationChain = O({ n: 1 }).update('n', (n) => (n ?? 0) + 1);
type MutationCurrent = Assert<Same<ReturnType<typeof mutationChain.unwrap>, { n: number }>>;
type MutationResult = Assert<Same<ReturnType<typeof mutationChain.result>, number | undefined>>;
const replacement = O.replace(
  { n: 1, name: 'M' },
  (v): v is number => typeof v === 'number',
  (n, key, object) => {
    const value: number = n;
    const original: { n: number; name: string } = object;
    const k: 'n' | 'name' = key;
    return value + original.n + k.length;
  }
);
const replacementValue: number | string | undefined = replacement;
// @ts-expect-error A replacement cannot put text into a matched numeric field.
O.replace({ n: 1, name: 'M' }, 1, 'new');

// Critical-pass controls: broad indexers must not erase stricter declared children.
const narrowedIndex: { fixed: { n: number }; [key: string]: { n?: number } } = { fixed: { n: 1 } };
// @ts-expect-error A broad segment may reach the stricter declared child.
O.unset(narrowedIndex, [stringKey, 'n']);
const optionalNarrowedIndex: { fixed?: { n: number }; [key: string]: { n?: number } | undefined } = {};
// @ts-expect-error An optional named parent can still own a required descendant.
O.unset(optionalNarrowedIndex, [stringKey, 'n']);
const numericNarrowedIndex: { 0: { n: number }; [key: number]: { n?: number } } = { 0: { n: 1 } };
// @ts-expect-error Numeric indexers must retain stricter declared children.
O.unset(numericNarrowedIndex, [numberKey, 'n']);
const symbolicNarrowedIndex: { [requiredSymbol]: { n: number }; [key: symbol]: { n?: number } } = {
  [requiredSymbol]: { n: 1 }
};
// @ts-expect-error Symbol indexers must retain stricter declared children.
O.unset(symbolicNarrowedIndex, [symbolKey, 'n']);
const patternedNarrowedIndex: { item_a: { n: number }; [key: `item_${string}`]: { n?: number } } = {
  item_a: { n: 1 }
};
// @ts-expect-error Pattern indexers must retain stricter declared children.
O.unset(patternedNarrowedIndex, [patternKey, 'n']);
// @ts-expect-error Wrapper deletion must share the indexer-child protection.
O(narrowedIndex).unset([stringKey, 'n']);
const safeIndexedChildren: { fixed: { n?: number }; [key: string]: { n?: number } } = { fixed: {} };
O.unset(safeIndexedChildren, [stringKey, 'n']);
O.unset(narrowedIndex, ['another', 'n']); // A known different key cannot address fixed.

// Branded domains are also not single keys, even though they are narrower than string/number.
declare const idBrand: unique symbol;
type Id = string & { readonly [idBrand]: 'id' };
declare const branded: Id;
const brandedResult = O.setImmutable({} as Record<Id, number>, [branded], 'text');
type BrandedUnknown = Assert<Same<typeof brandedResult, unknown>>;

// Scalar branded numeric domains are as uncertain as their tuple counterparts.
declare const numericIdBrand: unique symbol;
type NumericId = number & { readonly [numericIdBrand]: 'numeric-id' };
declare const firstId: NumericId;
declare const secondId: NumericId;
const numericDomain: Record<NumericId, number> = {};
const scalarBrandedSet = O.setImmutable(numericDomain, firstId, 'changed');
type ScalarBrandedSetUnknown = Assert<Same<typeof scalarBrandedSet, unknown>>;
// @ts-expect-error An untouched numeric ID has not been changed to a string.
scalarBrandedSet[secondId]!.toUpperCase();
const scalarBrandedUpdate = O.updateImmutable(numericDomain, firstId, () => 'changed');
type ScalarBrandedUpdateUnknown = Assert<Same<typeof scalarBrandedUpdate, unknown>>;
const scalarBrandedUnset = O.unsetImmutable(numericDomain, firstId);
type ScalarBrandedUnsetUnknown = Assert<Same<typeof scalarBrandedUnset, unknown>>;
const tupleBrandedSet = O.setImmutable(numericDomain, [firstId], 'changed');
type TupleBrandedSetUnknown = Assert<Same<typeof tupleBrandedSet, unknown>>;
const wrappedBrandedSet = O(numericDomain).setImmutable(firstId, 'changed').unwrap();
type WrappedBrandedSetUnknown = Assert<Same<typeof wrappedBrandedSet, unknown>>;
const literalNumericSet = O.setImmutable({ 1: 1, 2: 2 }, 1, 'changed');
const literalNumericChanged: string = literalNumericSet[1];
const literalNumericUntouched: number = literalNumericSet[2];
