import Objects = require('go-objects');
import get = require('go-objects/get');
import has = require('go-objects/src/has');
import update = require('go-objects/src/update.js');
import map = require('go-objects/map');
import bundle = require('go-objects/dist/go-objects.js');

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;
const profile = { id: 42, displayName: 'Michael', notes: 'Private' };
const picked = Objects.pick(profile, ['id', 'displayName']);
type Picked = Expect<Equal<typeof picked, { id: number; displayName: string }>>;
const omitted = Objects.omit(profile, ['notes']);
type Omitted = Expect<Equal<typeof omitted, { id: number; displayName: string }>>;
const numbers = { apples: 2, bread: 3 };
const mapped = map(numbers, (value, key, source) => {
  const n: number = value;
  const k: 'apples' | 'bread' = key;
  const same: typeof numbers = source;
  return String(n + same[k]);
});
type Mapped = Expect<Equal<typeof mapped, { apples: string; bread: string }>>;
const filtered = Objects.filter(numbers, (value) => value > 2);
type Filtered = Expect<Equal<typeof filtered, { apples?: number; bread?: number }>>;
const sum: number = Objects.reduce(numbers, (total, n) => total + n, 0);
const text: string = Objects.reduceRight(numbers, (total, n) => total + n, '');
const maybeSum: number = Objects.reduce(numbers, (total, n) => total + n);
const name: string | undefined = get(profile, 'displayName');
const defaulted: string = get(profile, 'displayName', 'Guest');
const optional: { profile?: { name: string | null } } = {};
const nested: string | null | undefined = get(optional, ['profile', 'name'] as const);
const nestedDefault: string | null = get(optional, ['profile', 'name'], 'Guest');
const root: typeof profile = get(profile, []);
const undefinedRoot: undefined = get(undefined, [], 'ignored');
// eslint-disable-next-line prefer-const -- A widened string models a path selected at runtime.
let dynamicPath: string = 'profile.name';
const dynamic: unknown = get(optional, dynamicPath);
// @ts-expect-error An unknown dynamic path must not leak any.
const unsafe: number = get(optional, dynamicPath);
const dotKey = { 'a.b': 1, a: { b: 'nested' } };
// @ts-expect-error A dotted string must not incorrectly infer the literal dotted property.
const wrongDot: number = get(dotKey, 'a.b');
const literalDot: number | undefined = get(dotKey, ['a.b']);
const symbol = Symbol('id');
const symbols = { [symbol]: 42 };
const symbolValue: number | undefined = get(symbols, [symbol]);
const symbolKeys: (typeof symbol)[] = Objects.keys(symbols);
const numeric = { 1: 'one' };
const numericKeys: '1'[] = Objects.keys(numeric);
const numericValue: string | undefined = get(numeric, '1');
const present: boolean = has(optional, ['profile', 'name']);
const previous: number | undefined = update(numbers, 'apples', (n) => (n ?? 0) + 1);
// @ts-expect-error Known numeric values cannot be replaced with a string.
update(numbers, 'apples', () => 'invalid');
// @ts-expect-error Known keys must not accept incompatible writes.
Objects.set(numbers, 'apples', 'invalid');
// @ts-expect-error Invalid key type.
Objects.has(numbers, [{}]);
// @ts-expect-error A callback is required.
Objects.update(numbers, 'apples', null);
const match: boolean = Objects.some(numbers, (n) => n > 1);
const all: boolean = Objects.every(numbers, 2);
const explicitUndefined: boolean = Objects.some({ x: undefined }, undefined);
// @ts-expect-error Quantifiers require a matcher argument.
Objects.some(numbers);
const entry = Objects.findEntry(profile, (v): v is number => typeof v === 'number');
if (entry?.[0] === 'id') {
  const id: number = entry[1];
}
// The numeric guard removes the nonnumeric entry alternatives.
// @ts-expect-error No displayName entry can satisfy this numeric predicate.
if (entry?.[0] === 'displayName') {
}
const zero: number = Objects.count(numbers);
const selectedCount: number = Objects.count({ x: undefined }, undefined);
const renamed = Objects.mapKeys(numbers, (n, k) => k.toUpperCase(), { onCollision: 'throw' });
const renamedValue: number | undefined = renamed['APPLES'];
Objects.deepMapKeys({ a: { A: 1 } }, (v, k, parent, path) => String(k).toLowerCase(), {
  onCollision: 'throw',
  maxDepth: 2,
  shouldDescend: (v, k, parent, path) => path.length < 3
});
// @ts-expect-error Unsupported collision policy.
Objects.mapKeys(numbers, (n, k) => k, { onCollision: 'ignore' });
// @ts-expect-error Collision policy belongs to key-mapping, not deepMap.
Objects.deepMap(numbers, (v) => v, { onCollision: 'throw' });
const transformed = Objects(numbers)
  .map((n) => String(n))
  .pick(['apples'])
  .unwrap();
type Transformed = Expect<Equal<typeof transformed, { apples: string }>>;
const mutating = Objects(numbers).update('apples', (n) => (n ?? 0) + 1);
const current: typeof numbers = mutating.unwrap();
const old: number | undefined = mutating.result();
const query = mutating.has('apples');
const boolCurrent: boolean = query.unwrap();
const boolResult: boolean = query.result();
// @ts-expect-error An object transformation cannot follow a boolean query.
query.map((v) => v);
const constructed = new Objects(numbers);
const viaNew: typeof numbers = constructed.unwrap();
const constructMap: { apples: string; bread: string } = constructed.map((n) => String(n)).unwrap();
const mutableClone: typeof optional = Objects.deepClone(optional, { unsupported: 'throw' });
// @ts-expect-error Invalid clone options are rejected at compile time.
Objects.clone(optional, { unsupported: 'skip' });
const arrayMap: string[] = Objects.map([1, 2] as const, (n) => String(n));
const arrayFilter: number[] = Objects.filter([1, 2], (n) => n > 1);
const arrayPick: { '0'?: number } = Objects.pick([1, 2], [0]);
const tuplePick: { '0': 1 } = Objects.pick([1, 2] as const, [0]);
const merged: { a: string; b: number } = Objects.merge({ a: 1 }, { a: 'new', b: 2 });
const partial: { a?: number } = Objects.intersect({ a: 1 }, { a: 1 });
const readBatch: [number | undefined, string | undefined] = Objects.getEach(profile, ['id', 'displayName']);
const writeBatch: [number | undefined, number | undefined] = Objects.setEach(numbers, ['apples', 'bread'], 4);
const browser: boolean = bundle.has({}, 'x');
const path: Objects.Path = ['profile', symbol];
const options: Objects.MapKeysOptions = { onCollision: 'throw' };

// @ts-expect-error A batch write cannot invalidate a known numeric property.
Objects.setEach(numbers, ['apples'], 'bad');
// @ts-expect-error A single replacement must fit both paths in a heterogeneous batch.
Objects.setEach({ x: 1, y: 's' }, ['x', 'y'], 1);
const unknownObject: unknown = {};
const unknownEntries: [string | symbol, unknown][] = Objects.entries(unknownObject);
// @ts-expect-error Unknown object entries must not be claimed to be impossible.
const neverEntries: never[] = Objects.entries(unknownObject);
const readonlyInput: Readonly<{ a: number; b?: string }> = { a: 1 };
const optionalPicked: { a: number; b?: string } = Objects.pick(readonlyInput, ['a', 'b']);
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Missing selected keys produce an empty structural result.
const noFields: {} = Objects.pick(numbers, ['missing']);
const dynamicKeys: string[] = ['apples'];
const dynamicPicked: Partial<typeof numbers> = Objects.pick(numbers, dynamicKeys);
const arrayLength: number | undefined = Objects.get([1, 2], 'length');
const directSymbol: number | undefined = Objects.get(symbols, symbol);
Objects.deepFind({ a: { b: 1 } }, (value, key, parent, path) => {
  const unknownValue: unknown = value;
  const keys: (string | symbol)[] = path;
  return unknownValue === 1 && keys.length > 0;
});
const absentUndefined: number = Objects.count({ a: 1 }, undefined);
const noMatchLiteral: boolean = Objects.some({ a: 1 } as const, 2);
const invalidKey: unknown = {};
const rejectedKey: boolean = Objects.hasKey({}, invalidKey);
const rejectedProp: boolean = Objects.hasProp({}, invalidKey);
// @ts-expect-error A numeric record's predicate cannot require strings.
Objects.some(numbers, (n: string) => n.length > 0);
const functionRecord = { handler: () => 1 };
// @ts-expect-error Match-based replacement functions are invoked, not stored literally.
Objects.replace(
  functionRecord,
  () => true,
  () => 2
);
Objects.replace(
  functionRecord,
  () => true,
  () => () => 2
);
const dynamicRecord: Record<string, unknown> = {};
Objects.some(dynamicRecord, (value) => {
  // @ts-expect-error Unknown record values must not become implicit any.
  const leaked: number = value;
  return typeof value === 'number';
});
Objects.findEntry(dynamicRecord, (value) => {
  // @ts-expect-error Predicate context remains unknown, not any.
  const leaked: string = value;
  return value === undefined;
});
Objects.replace(
  dynamicRecord,
  () => true,
  (value) => {
    // @ts-expect-error Replacement context remains unknown, not any.
    const leaked: number = value;
    return value;
  }
);
Objects(dynamicRecord).every((value) => {
  // @ts-expect-error Fluent predicates preserve unknown callback values.
  const leaked: number = value;
  return value !== undefined;
});
