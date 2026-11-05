import O = require('go-objects');
import pick = require('go-objects/pick');
import get = require('go-objects/get');
// Compile-only contracts: negative cases must be rejected, not executed.
type Same<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Check<T extends true> = T;

const numbers: Record<string, number> = {};
const selected = O.pick(numbers, ['missing']);
type IndexedPick = Check<Same<typeof selected, { missing?: number }>>;
// @ts-expect-error A known requested name does not prove a dictionary entry exists.
selected.missing.toFixed();
const standalone = pick(numbers, ['missing']);
// @ts-expect-error The standalone import must retain dictionary absence.
standalone.missing.toFixed();
const wrapped = O(numbers).pick(['missing']);
// @ts-expect-error Wrapper unwrap must not manufacture property presence.
wrapped.unwrap().missing.toFixed();
// @ts-expect-error Wrapper result must not manufacture property presence either.
wrapped.result().missing.toFixed();

const rows: readonly number[] = [];
const selectedRow = pick(rows, [0]);
type ArrayPick = Check<Same<typeof selectedRow, { '0'?: number }>>;
// @ts-expect-error Arrays can have absent indices, even with an exact selector tuple.
selectedRow[0].toFixed();
const numeric: Record<number, string> = {};
const numericSelection = O.pick(numeric, [12]);
// @ts-expect-error Numeric dictionary entries may not exist.
numericSelection[12].toUpperCase();
const templates: Record<`item_${string}`, { size: number }> = {};
const templateSelection = O.pick(templates, ['item_missing']);
// @ts-expect-error A template index signature is not a guaranteed individual entry.
templateSelection.item_missing.size.toFixed();
const symbol = Symbol('field');
const symbolic: Record<symbol, number> = {};
const symbolSelection = O.pick(symbolic, [symbol]);
// @ts-expect-error A symbol dictionary does not guarantee the requested symbol.
symbolSelection[symbol].toFixed();
const signed = O.pick(numeric, [-2, 1.5]);
// @ts-expect-error Signed numeric keys still come from an unpopulated index domain.
signed[-2].toUpperCase();
// @ts-expect-error Fractional numeric keys still come from an unpopulated index domain.
signed[1.5].toUpperCase();

// Do not turn declared required properties into optional ones while fixing indices.
const explicit: { required: number; optional?: number; [key: string]: number | undefined } = { required: 1 };
const explicitSelection = pick(explicit, ['required', 'optional', 'missing']);
const required: number = explicitSelection.required;
const optional: number | undefined = explicitSelection.optional;
const possible: number | undefined = explicitSelection.missing;
// @ts-expect-error An explicitly optional property does not become required.
explicitSelection.optional.toFixed();
// @ts-expect-error Nor does an undeclared indexed property.
explicitSelection.missing.toFixed();
const requiredNumeric: { 0: string; [key: number]: string } = { 0: 'present' };
const exactNumeric = pick(requiredNumeric, [0, '0', 12]);
const zero: string = exactNumeric[0];
const maybeTwelve: string | undefined = exactNumeric[12];
const requiredSymbol: { [symbol]: string; [key: symbol]: string } = { [symbol]: 'present' };
const exactSymbol: string = pick(requiredSymbol, [symbol])[symbol];
const requiredTemplate: { item_known: string; [key: `item_${string}`]: string } = { item_known: 'present' };
const templateKnown: string = pick(requiredTemplate, ['item_known']).item_known;

const person = { name: 'Michael', age: 42, [symbol]: true };
const exact = pick(person, ['name', symbol]);
type ExactPick = Check<Same<typeof exact, { name: string; [symbol]: boolean }>>;
const tuple: readonly [string, number?] = ['first'];
const tupleSelection = pick(tuple, [0, '1']);
const first: string = tupleSelection[0];
const second: number | undefined = tupleSelection[1];
const variadic: readonly [string, ...number[]] = ['head'];
const head: string = pick(variadic, [0])[0];
// @ts-expect-error A variadic tail is an index domain, not a guaranteed slot.
pick(variadic, [9])[9].toString();
const optionalArray: readonly [number?] = [];
// @ts-expect-error An optional tuple element remains optional.
pick(optionalArray, [0])[0].toFixed();
const extra = Object.assign([] as number[], { label: 'known' });
const extraPicked = pick(extra, ['label', 0]);
const label: string = extraPicked.label;
// @ts-expect-error Required array metadata does not prove an element exists.
extraPicked[0].toFixed();
const requested: ('name' | 'age')[] = ['name'];
const dynamic = pick(person, requested);
// @ts-expect-error A dynamic finite union is not a list of every member.
dynamic.age.toFixed();
const selectedEmpty = pick(person, []);
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Empty selection is an intentional structural result.
type EmptyPick = Check<Same<typeof selectedEmpty, {}>>;
const omitted = O.omit(person, ['age']);
type ExactOmit = Check<Same<typeof omitted, { name: string; [symbol]: boolean }>>;
const maybeOmitted = O.omit(person, requested);
const keptSymbol: boolean = maybeOmitted[symbol];
// @ts-expect-error A dynamic omission can remove name.
maybeOmitted.name.toUpperCase();

// Read results, including callback bodies, not just successful imports.
const tree: { child?: { value: number }; present: number | undefined } = { present: undefined };
const read = O.get(tree, ['child', 'value']);
type NestedRead = Check<Same<typeof read, number | undefined>>;
const defaulted = get(tree, ['child', 'value'], 'missing' as const);
type Defaulted = Check<Same<typeof defaulted, number | 'missing'>>;
const root = O.get(tree, [], false);
type RootRead = Check<Same<typeof root, typeof tree>>;
const readList = O.getEach(tree, [['child', 'value'], 'present'], null);
type ReadList = Check<Same<typeof readList, [number | null, number | null]>>;
const readPath: string = 'child.value';
// @ts-expect-error Parsed dynamic paths are not statically proven values.
O.get(tree, readPath).toFixed();
const ownKeys = O.keys(person);
type OwnKeys = Check<Same<typeof ownKeys, ('name' | 'age' | typeof symbol)[]>>;
const ownValues = O.values(person);
type OwnValues = Check<Same<typeof ownValues, (string | number | boolean)[]>>;
const ownEntries = O.entries(person);
type OwnEntries = Check<Same<typeof ownEntries, (['name', string] | ['age', number] | [typeof symbol, boolean])[]>>;

type OwnershipInput = { item: number } | { other: string };
function ownershipBranches(value: OwnershipInput, unknownValue: unknown) {
  if (O.hasKey(value, 'item')) {
    // @ts-expect-error Ownership checks cannot safely narrow both structural branches.
    value.item.toFixed();
  } else {
    // @ts-expect-error A non-enumerable item still belongs to the item variant.
    value.other.toUpperCase();
  }
  if (O.hasProp(value, 'item')) {
    // @ts-expect-error Use an explicit structural/value check after the ownership result.
    value.item.toFixed();
  } else {
    // @ts-expect-error An inherited item still belongs to the item variant.
    value.other.toUpperCase();
  }
  if (O.hasProp(unknownValue, 'item')) {
    // @ts-expect-error A boolean ownership result does not narrow an unknown value.
    unknownValue.item;
  }
  if (O.hasKey(unknownValue, 'item')) {
    // @ts-expect-error A boolean enumerability result does not narrow an unknown value.
    unknownValue.item;
  }
  if (O.hasProp(value, 'item') && 'item' in value) {
    const item: number = value.item;
    item.toFixed();
  }
  if (
    typeof unknownValue === 'object' &&
    unknownValue !== null &&
    O.hasProp(unknownValue, 'item') &&
    'item' in unknownValue &&
    typeof unknownValue.item === 'number'
  ) {
    unknownValue.item.toFixed();
  }
}

const input: unknown = {};
if (O.hasProp(input, symbol) && typeof input === 'object' && input !== null && symbol in input) {
  const unknownValue: unknown = input[symbol];
  // @ts-expect-error Existence proves no particular value type.
  input[symbol].toFixed();
}
if (O.hasKey(input, 'name') && typeof input === 'object' && input !== null && 'name' in input) {
  const unknownName: unknown = input.name;
  // @ts-expect-error Existence does not prove the property is text.
  input.name.toUpperCase();
}
const mapped = O.map(person, function (value, key, object) {
  type MapValue = Check<Same<typeof value, string | number | boolean>>;
  type MapKey = Check<Same<typeof key, 'name' | 'age' | typeof symbol>>;
  // eslint-disable-next-line @typescript-eslint/no-this-alias -- Assert the inferred callback receiver type.
  const receiver: typeof person = this;
  const original: typeof person = object;
  return String(value);
});
type Mapped = Check<Same<typeof mapped, { name: string; age: string; [symbol]: string }>>;
O.forEach(person, function (value, key, object) {
  // eslint-disable-next-line @typescript-eslint/no-this-alias -- Assert the inferred callback receiver type.
  const receiver: typeof person = this;
  const original: typeof person = object;
  // @ts-expect-error Inferred union values require narrowing.
  value.toFixed();
});
const renamed = O.mapKeys(person, (_, key) => (typeof key === 'symbol' ? key : 'renamed'));
const renamedValue: string | number | boolean | undefined = renamed.renamed;
const mixed: Record<string, number | string | null> = { a: 'text', b: 1, c: null };
const isString = (value: number | string | null): value is string => typeof value === 'string';
const one: string | undefined = O.find(mixed, isString);
const last: string | undefined = O.findLast(mixed, isString);
const all: string[] = O.findAll(mixed, isString);
const filtered: Partial<Record<string, string>> = O.filter(mixed, isString);
const stringEntry: [string, string] | undefined = O.findEntry(mixed, isString);
const wrapperStrings: string[] = O(mixed).findAll(isString).unwrap();
const wrapperFiltered: Partial<Record<string, string>> = O(mixed).filter(isString).unwrap();
const wrapperEntry: [string, string] | undefined = O(mixed).findEntry(isString).unwrap();
O.some(mixed, (value, key, object) => {
  type MatchValue = Check<Same<typeof value, number | string | null>>;
  const parent: typeof mixed = object;
  return key === 'a' && value === 'text';
});
// @ts-expect-error A function cannot bypass predicate checking as an object literal.
O.every(mixed, (value: number) => value.toFixed());
const total = O.reduce(
  mixed,
  function (accumulator, value, key, object) {
    type Accumulator = Check<Same<typeof accumulator, number>>;
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- Assert the inferred callback receiver type.
    const receiver: typeof mixed = this;
    return accumulator + (typeof value === 'number' ? value : 0);
  },
  0
);
type Total = Check<Same<typeof total, number>>;
const right: string = O(mixed)
  .reduceRight((accumulator, value) => accumulator + String(value), '')
  .unwrap();
const merged = O.merge({ code: 1 }, { code: 'text', enabled: true });
type Merge = Check<Same<typeof merged, { code: 'text'; enabled: true }>>;
const override: { code?: string } = {};
const possibleMerge = O.merge({ code: 1 }, override);
// @ts-expect-error An optional override may leave a number.
possibleMerge.code?.toUpperCase();
const indexedMerge = O.merge(numbers, { name: 'text' });
const dynamicKey: string = 'name';
// @ts-expect-error Merged index reads may contain the new text value.
indexedMerge[dynamicKey]?.toFixed();
const subset: Partial<typeof person> = O.intersect(person, { age: 42 });
const difference: Partial<typeof person> = O.except(person, { name: 'Michael' });

const isNumber = (value: unknown): value is number => typeof value === 'number';
const deepOne: number | undefined = O.deepFind(tree, isNumber);
const deepLast: number | undefined = O.deepFindLast(tree, isNumber);
const deepAll: number[] = O.deepFindAll(tree, isNumber);
const deepEntry: [(string | symbol)[], number] | undefined = O(tree).deepFindEntry(isNumber).unwrap();
O.deepForEach(tree, function (value, key, parent, path) {
  type DeepValue = Check<Same<typeof value, unknown>>;
  // eslint-disable-next-line @typescript-eslint/no-this-alias -- Assert the inferred callback receiver type.
  const receiver: object = this;
  const parts: (string | symbol)[] = path;
  // @ts-expect-error Deep callbacks observe unknown, not an assumed schema value.
  value.toFixed();
});
O.deepMap(tree, (value) => value, {
  shouldDescend(value, key, parent, path) {
    const container: object = value;
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- Assert the inferred callback receiver type.
    const receiver: object = this;
    const parts: (string | symbol)[] = path;
    return true;
  }
});
const deepArray: unknown[] = O.deepMapKeys([{ a: 1 }], (_, key) => key, { arrays: 'preserve' });
const deepRecord: Partial<Record<string | symbol, unknown>> = O.deepMapKeys(tree, (_, key) => key);
const pruned: Record<string | symbol, unknown> | unknown[] = O.deepFilter(tree, () => true);
const foundPath: (string | symbol)[] | undefined = O.findPath(tree, isNumber);
const foundKey: string | symbol | undefined = O.deepFindKey(tree, isNumber);
const deepCount: number = O.deepCount(tree, isNumber);
const cloned: typeof tree = O.deepClone(tree, { unsupported: 'reference' });
// @ts-expect-error Do not invent unsupported cloning policies.
O.clone(tree, { unsupported: 'copy' });
// @ts-expect-error A traversal callback must accept arbitrary containers.
O.deepMap(tree, (value) => value, { shouldDescend: (value: { number: number }) => value.number > 0 });

// Non-canonical numeric strings are literal names, not other required numeric keys.
const aliasSource: { 1: string; [key: number]: string } = { 1: 'present' };
const leadingZero = O.pick(aliasSource, ['01']);
// @ts-expect-error Selecting '01' must not guarantee a different property '1'.
leadingZero[1].toUpperCase();
const decimalSpelling = O.pick(aliasSource, ['1.0']);
// @ts-expect-error Numeric parsing is not runtime key normalisation.
decimalSpelling[1].toUpperCase();
const exponentSpelling = O.pick(aliasSource, ['1e0']);
// @ts-expect-error Exponential spelling must not manufacture the required canonical key.
exponentSpelling[1].toUpperCase();
const canonicalAlias: string = O.pick(aliasSource, ['1'])[1];
const literalSpellings = { '01': 1, '1.0': 2, '1e0': 3 };
const selectedSpellings = O.pick(literalSpellings, ['01', '1.0', '1e0']);
const zeroSpelling: number = selectedSpellings['01'];
const decimalValue: number = selectedSpellings['1.0'];
const exponentValue: number = selectedSpellings['1e0'];
function selectPattern(key: `item_${string}`) {
  const known: { item_known: number; [key: `item_${string}`]: number } = { item_known: 1 };
  const possibleSelection = O.pick(known, [key]);
  // @ts-expect-error A pattern-valued request need not select the explicit known field.
  possibleSelection.item_known.toFixed();
}

// A guarantee in one input alternative cannot make a dictionary entry present.
function selectUnion(source: { name: string } | Record<string, string>) {
  const selected = O.pick(source, ['name']);
  // @ts-expect-error The dictionary alternative may be empty.
  selected.name.toUpperCase();
  const maybeName: string | undefined = selected.name;
  // @ts-expect-error Standalone imports share the union absence contract.
  pick(source, ['name']).name.toUpperCase();
  // @ts-expect-error Wrapped selection also requires a presence check.
  O(source).pick(['name']).unwrap().name.toUpperCase();
  return maybeName;
}
selectUnion({});
function selectArrayUnion(source: readonly [string] | readonly string[]) {
  const selected = O.pick(source, [0]);
  // @ts-expect-error An ordinary array alternative may have no first element.
  selected[0].toUpperCase();
  return selected[0]?.toUpperCase();
}
selectArrayUnion([]);
function selectNumericUnion(source: { 1: string } | Record<number, string>) {
  // @ts-expect-error A required slot in another alternative does not populate the dictionary.
  O.pick(source, [1])[1].toUpperCase();
}
selectNumericUnion({});
function selectPatternUnion(source: { item_a: string } | Record<`item_${string}`, string>) {
  // @ts-expect-error A pattern dictionary alternative may be empty.
  O.pick(source, ['item_a']).item_a.toUpperCase();
}
selectPatternUnion({});
function selectRequiredUnion(source: { name: string; count: number } | { name: string; active: boolean }) {
  const name: string = O.pick(source, ['name']).name;
  return name;
}
function selectCorrelatedUnion(source: { kind: 'text'; value: string } | { kind: 'count'; value: number }) {
  const selected = O.pick(source, ['kind', 'value']);
  if (selected.kind === 'text') return selected.value.toUpperCase();
  return selected.value.toFixed();
}
