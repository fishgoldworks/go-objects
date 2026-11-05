import O from 'go-objects';
import setImmutable from 'go-objects/setImmutable';
import updateImmutable from 'go-objects/updateImmutable';
import merge from 'go-objects/merge';

// A precise written property must also be reflected by its covering indexers.
const numbers: Record<string, number> = { n: 1 };
const labels = setImmutable(numbers, 'label', 'new');
const stringKey: string = 'label';
// @ts-expect-error Dynamic reads may observe the new string, not only numbers.
labels[stringKey]?.toFixed();
const label: string = labels.label;
const dynamicLabel: number | string | undefined = labels[stringKey];
const updatedLabels = updateImmutable(numbers, 'label', () => 'new');
// @ts-expect-error updater results must widen the containing dictionary too.
updatedLabels[stringKey]?.toFixed();
const wrappedLabels = O(numbers).setImmutable('label', 'new').unwrap();
// @ts-expect-error wrappers must retain the same widened indexer.
wrappedLabels[stringKey]?.toFixed();

const numeric: Record<number, number> = { 1: 2 };
const numberedLabels = O.setImmutable(numeric, '3', 'three');
declare const numberKey: number;
// @ts-expect-error numeric reads alias canonical numeric string keys.
numberedLabels[numberKey]?.toFixed();
const knownNumericLabel: string = numberedLabels[3];
const known = Symbol('known');
const symbolic: Record<symbol, number> = {};
const symbolLabels = O.setImmutable(symbolic, known, 'symbol');
declare const symbolKey: symbol;
// @ts-expect-error symbol-indexed dictionaries are not exempt.
symbolLabels[symbolKey]?.toFixed();
const knownSymbolLabel: string = symbolLabels[known];

const patterned: Record<`field_${string}`, number> = {};
const patternLabels = O.setImmutable(patterned, 'field_label', 'pattern');
declare const patternKey: `field_${string}`;
// @ts-expect-error template-literal index signatures can contain the written field.
patternLabels[patternKey]?.toFixed();
const knownPatternLabel: string = patternLabels.field_label;
const nested: Record<string, { n: number }> = {};
const nestedLabels = O.updateImmutable(nested, ['row', 'n'], () => 'new');
// @ts-expect-error the outer dictionary can contain a changed child record.
nestedLabels[stringKey]?.n.toFixed();
const nestedKnown: string = nestedLabels.row.n;

// Preserve unaffected explicit fields and independent key domains.
const mixed: { count: 1 } & Record<string, number> = { count: 1 };
const mixedLabels = O.setImmutable(mixed, 'label', 'new');
const unchangedLiteral: 1 = mixedLabels.count;
const symbolAndText = O.setImmutable(symbolic, 'label', 'new');
const stillNumber: number | undefined = symbolAndText[symbolKey];
const numberAndSymbol = O.setImmutable(numeric, known, 'new');
const stillNumeric: number | undefined = numberAndSymbol[numberKey];
const plain = O.setImmutable({ n: 1 }, 'label', 'new');
const plainNumber: number = plain.n;
const plainLabel: string = plain.label;

// Any source with indexed keys can overlap later fixed or indexed properties.
const merged = merge(numbers, { label: 'new' });
// @ts-expect-error first-source index signatures must include override value types.
merged[stringKey]?.toFixed();
const mergedValue: number | string | undefined = merged[stringKey];
const wrappedMerged = O(numbers).merge({ label: 'new' }).unwrap();
// @ts-expect-error same guarantee through the persistent wrapper.
wrappedMerged[stringKey]?.toFixed();
const mergedPattern = O.merge(patterned, { field_label: 'new' });
// @ts-expect-error template indexers also overlap literal overrides.
mergedPattern[patternKey]?.toFixed();
const mergedSymbols = O.merge(symbolic, { [known]: 'new' });
// @ts-expect-error indexed symbol overrides cannot retain number-only reads.
mergedSymbols[symbolKey]?.toFixed();

// Numeric and canonical numeric-string keys identify the same runtime property.
const mergedAlias = O.merge({ 0: 'old' }, { '0': 3 });
const aliasNumber: number = mergedAlias[0];
const aliasStringIndex: number = mergedAlias['0'];
const reversedAlias = O.merge({ '0': 3 }, { 0: 'new' });
const reverseString: string = reversedAlias[0];
const separateKeys = O.merge({ '01': 3 }, { 1: 'new' });
const separateLeadingZero: number = separateKeys['01'];
const separateNumber: string = separateKeys[1];
const optionalAlias: { '0'?: number } = {};
const optionalMerged = O.merge({ 0: 'old' }, optionalAlias);
const optionalAliasValue: number | string = optionalMerged[0];
const plainMerge = O.merge({ n: 1 }, { n: 'new', active: true });
const newString: string = plainMerge.n;
const newFlag: boolean = plainMerge.active;

// No-op immutable calls may return the original frozen/readonly input. Do not
// advertise writable properties or array methods which then fail at runtime.
const frozen = Object.freeze({ n: 1 as number, other: { ok: true } });
const noOpSet = O.setImmutable(frozen, 'n', 1);
// @ts-expect-error The reused input's readonly property remains readonly.
noOpSet.n = 2;
// @ts-expect-error Unchanged readonly properties are not made writable either.
noOpSet.other = { ok: false };
const noOpUpdate = O(frozen)
  .updateImmutable('n', (n) => n)
  .unwrap();
// @ts-expect-error updater/wrapper results follow the same readonly contract.
noOpUpdate.n = 2;
const noOpUnset = O.unsetImmutable(frozen, 'absent');
// @ts-expect-error Deleting an absent field can reuse the frozen root.
noOpUnset.n = 2;
const readonlyRows = Object.freeze([1, 2]);
const noOpArray = O.setImmutable(readonlyRows, 0, 1);
// @ts-expect-error A returned readonly array cannot be promised mutable.
noOpArray.push(3);
const noOpArrayUnset = O.unsetImmutable(readonlyRows, 100);
// @ts-expect-error Same for an array deletion that does not find its element.
noOpArrayUnset.push(3);
const readonlyNested: { readonly child?: { n: number } } = {};
const readonlyUnset = O.unsetImmutable(readonlyNested, ['child', 'n']);
// @ts-expect-error Missing intermediate nodes may preserve readonly ancestors.
readonlyUnset.child = {};
const writable = O.setImmutable({ n: 1 }, 'n', 1);
writable.n = 2;
const writableArray = O.setImmutable([1, 2], 0, 3);
writableArray.push(4);
const addedProperty = O.setImmutable(frozen, 'newField', 4);
addedProperty.newField = 5;

// Runtime-rejected immutable paths should also be rejected when statically obvious.
// @ts-expect-error Array length is structural, not an immutable mutation path.
O.setImmutable([1, 2], 'length', 1);
// @ts-expect-error Same restriction through updateImmutable.
O.updateImmutable([1, 2], ['length'], () => 1);
// @ts-expect-error Same restriction through unsetImmutable.
O.unsetImmutable([1, 2], 'length');
// @ts-expect-error Prototype-sensitive segments are always rejected at runtime.
O.setImmutable({ safe: 1 }, '__proto__', {});
// @ts-expect-error Nested segment arrays also reject prototype-sensitive keys.
O.setImmutable({ nested: { safe: 1 } }, ['nested', 'constructor'], {});
