import O from 'go-objects';
// Compile-only positive/negative scenarios. Negative examples are never executed.
type Same<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;
const id = Symbol('id');
const record = { count: 1, name: 'Michael', [id]: 2 };
const numbers: Record<string, number> = { first: 1 };
const data: Record<string, unknown> = {};
const optional: { name?: string; count: number } = { count: 1 };

const symbols = O.pick(record, [id]);
type SymbolPicked = Assert<Same<typeof symbols, { [id]: number }>>;
const renamed = O.mapKeys(record, () => id);
const renamedValue: number | string | undefined = renamed[id];
const empty = O.pick(record, []);
// @ts-expect-error No selected keys does not preserve required input fields.
empty.count.toFixed();
const dynamicNames: ('count' | 'name')[] = ['name'];
const dynamicSelected = O.pick(record, dynamicNames);
// @ts-expect-error A dynamic list does not guarantee count was selected.
const definiteCount: number = dynamicSelected.count;
const maybeCount: number | undefined = dynamicSelected.count;
const dynamicOmitted = O.omit(record, dynamicNames);
// @ts-expect-error A possible omission does not guarantee count remains present.
const definiteRetained: number = dynamicOmitted.count;
const symbolRetained: number = dynamicOmitted[id];

const optionalOverride: { count?: string | undefined } = { count: undefined };
const merged = O.merge({ count: 1 }, optionalOverride);
const possibleCount: number | string | undefined = merged.count;
// @ts-expect-error An optional override can leave the earlier number or write undefined.
const alwaysString: string = merged.count;
const sources: { count: string }[] = [];
const spread = O.merge({ count: 1 }, ...sources);
// @ts-expect-error Empty or populated dynamic spreads can produce different value types.
const alwaysNumber: number = spread.count;
const possibleSpread: number | string | undefined = spread.count;

const mixed = { name: 'Michael', age: 42, absent: null };
const isNumber = (v: string | number | null): v is number => typeof v === 'number';
const firstNumber: number | undefined = O.find(mixed, isNumber);
const lastNumber: number | undefined = O.findLast(mixed, isNumber);
const allNumbers: number[] = O.findAll(mixed, isNumber);
const filtered = O.filter(mixed, isNumber);
const age: number | undefined = filtered.age;
// @ts-expect-error A numeric guard excludes the string property.
filtered.name;
const entry = O.findEntry(mixed, isNumber);
if (entry) {
  const key: 'age' = entry[0];
  const n: number = entry[1];
  // @ts-expect-error A guard cannot produce the rejected property's key.
  const wrong: 'name' = entry[0];
}
const wrappedNumbers: number[] = O(mixed).findAll(isNumber).unwrap();
const wrappedNumber: number | undefined = O(mixed).findLast(isNumber).result();
const wrappedFiltered: { age?: number } = O(mixed).filter(isNumber).unwrap();
const deepGuard = (value: unknown): value is string => typeof value === 'string';
const deepFirst: string | undefined = O.deepFind(data, deepGuard);
const deepLast: string | undefined = O.deepFindLast(data, deepGuard);
const deepAll: string[] = O.deepFindAll(data, deepGuard);
const deepEntry = O.deepFindEntry(data, deepGuard);
if (deepEntry) {
  const path: (string | symbol)[] = deepEntry[0];
  const text: string = deepEntry[1];
}
const wrappedDeep: string[] = O(data).deepFindAll(deepGuard).result();
// @ts-expect-error Without a guard, arbitrary nested values stay unknown.
const assumedDeepNumber: number = O.deepFind(data, 1);

const literalDot = { 'a.b': 7, a: { b: 'nested' } };
const direct: number | undefined = O.get(literalDot, ['a.b']);
const nested: string | undefined = O.get(literalDot, ['a', 'b']);
// @ts-expect-error A parsed string path must not falsely describe the literal dotted key.
const parsedAsLiteral: number = O.get(literalDot, 'a.b');
const reads = O.getEach(record, ['count', id, 'name'] as const);
type Reads = Assert<Same<typeof reads, [number | undefined, number | undefined, string | undefined]>>;
const fallback: number | null = O.get(record, 'count', null);
const unknownPath: string = 'count';
// @ts-expect-error A dynamic path with a default does not manufacture a known result type.
const unsafeDynamic: number = O.get(record, unknownPath, 1);
const noWrites: [] = O.setEach(record, [], 'ignored');

O.unset(optional, 'name');
// @ts-expect-error Deleting a required known field invalidates existing aliases.
O.unset(optional, 'count');
// @ts-expect-error A batch value must satisfy every addressed field type.
O.setEach(record, ['count', 'name'], 1);
// @ts-expect-error Omission of a replacement is not an implicit undefined write.
O.replaceAll(data, () => true);
// @ts-expect-error Typed existing numeric slots cannot receive undefined.
O.update(record, 'count', () => undefined);
// @ts-expect-error A numeric matcher cannot safely replace a numeric field with text.
O.replace(record, 1, 'unknown');
O.replace(record, 1, 2);
O.set(data, 'arbitrary.path', true);
O.update(data, ['nested', id], (previous) => {
  // @ts-expect-error Erased schema values remain unknown.
  const number: number = previous;
  return previous;
});
O.deepRemoveAll(data, () => false);
// @ts-expect-error Arbitrary deep deletion is unsafe for a known required schema.
O.deepRemoveAll(record, () => true);

const frozen = Object.freeze({ nested: Object.freeze({ n: 1 }), offPath: { label: 'same' } });
const immutable = O.setImmutable(frozen, ['nested', 'n'], 'new');
const nextText: string = immutable.nested.n;
const oldNumber: number = frozen.nested.n;
const sharedBranch: typeof frozen.offPath = immutable.offPath;
const updated = O.updateImmutable(frozen, ['nested', 'n'], (previous) => String(previous ?? 0));
const updatedText: string = updated.nested.n;
const deleted = O.unsetImmutable(frozen, ['nested', 'n']);
// @ts-expect-error Immutable deletion removes the addressed field from the returned type.
deleted.nested.n;
const missingIndex = O.unsetImmutable([1, 2], [0]);
const indexValue: number | undefined = missingIndex[0];
const mappedArray: string[] = O.map([1, 2] as const, (n) => String(n));
const retainedArray: unknown[] = O.deepMapKeys([{ first_name: 'Michael' }], (_, key) => key, { arrays: 'preserve' });
// @ts-expect-error Array preservation is not a shallow mapKeys option.
O.mapKeys(record, (_, key) => key, { arrays: 'preserve' });
// @ts-expect-error Only documented collision policies are valid.
O.deepMapKeys(data, (_, key) => key, { onCollision: 'first' });
// @ts-expect-error Descent callback receives a path, not a string.
O.deepForEach(data, () => {}, { shouldDescend: (value, key, parent, path: string) => true });

const original = O(record),
  names = original.keys(),
  mutation = original.set('count', 2);
const stillRecord: typeof record = original.unwrap();
const justNames: ('count' | 'name' | typeof id)[] = names.unwrap();
const previous: number | undefined = mutation.result();
const current: typeof record = mutation.unwrap();
const flag: boolean = original.has('count').unwrap();
// @ts-expect-error Queries advance the new wrapper to a boolean, not an object collection.
original.has('count').map((value) => value);
const erased: unknown = {};
if (O.hasProp(erased, id) && typeof erased === 'object' && erased !== null && id in erased) {
  const property: unknown = erased[id];
  // @ts-expect-error Existence does not prove a numeric value.
  const guessed: number = erased[id];
}
