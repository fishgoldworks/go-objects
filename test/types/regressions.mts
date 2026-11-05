import O from 'go-objects';
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;
const person = { name: 'Michael', age: 42, active: true };
const dynamic: ('name' | 'age')[] = ['name'];
const picked = O.pick(person, dynamic);
// @ts-expect-error A possible key is not a guaranteed selected key.
picked.age.toFixed();
const certain = O.pick(person, ['name', 'age'] as const);
type Certain = Expect<Equal<typeof certain, { name: string; age: number }>>;
const unionTuple: readonly ['name' | 'age'] = ['name'];
const uncertainTuple = O.pick(person, unionTuple);
// @ts-expect-error A union tuple slot selects only one key.
uncertainTuple.age.toFixed();
const optionalTuple: readonly ['name', 'age'?] = ['name'];
const optionalPick = O.pick(person, optionalTuple);
const yesName: string = optionalPick.name;
// @ts-expect-error Optional tuple slots do not guarantee presence.
optionalPick.age.toFixed();
const omitted = O.omit(person, dynamic);
const retained: boolean = omitted.active;
// @ts-expect-error Dynamic omissions may or may not remove age.
const definitelyAbsent: undefined = omitted.age;
const missingOptional: { port?: string } = {};
const optionalMerge = O.merge({ port: 8080 }, missingOptional);
// @ts-expect-error An absent override leaves a number.
optionalMerge.port?.toUpperCase();
const optionalPort: number | string | undefined = optionalMerge.port;
const sources: { port: string }[] = [{ port: 'auto' }];
const spread = O.merge({ port: 8080 }, ...sources);
// @ts-expect-error A runtime spread may overwrite the number.
spread.port.toFixed();
const spreadPort: number | string | undefined = spread.port;
const merged = O.merge({ a: 1 }, { a: 'x', b: 2 });
const requiredString: string = merged.a;
const overrides: readonly [{ port?: string }?] = [];
const optionalRest = O.merge({ port: 1 }, ...overrides.filter((x): x is { port?: string } => !!x));
const optionalRestPort: number | string | undefined = optionalRest.port;
const dictionary: Record<string, string> = {};
const indexed = O.merge({ port: 1 }, dictionary);
// @ts-expect-error Index-signature sources may leave the numeric base value intact.
indexed.port?.toUpperCase();
const hetero = { age: 42, name: 'Michael' };
// @ts-expect-error Matching a number cannot permit overwriting it with a string.
O.replace(hetero, 42, 'unknown');
O.replace(hetero, 42, 43);
// @ts-expect-error Broad predicates cannot type-safely replace heterogeneous values.
O.replaceAll(hetero, () => true, 'unknown');
const isNumber = (v: string | number): v is number => typeof v === 'number';
O.replaceAll(hetero, isNumber, (v) => v + 1);
// @ts-expect-error Predicate narrowing must constrain replacement output.
O.replaceAll(hetero, isNumber, () => 'wrong');
const literalFields = { a: 42 as const, b: 1 };
// @ts-expect-error A broad number matcher may hit a field restricted to 42.
O.replaceAll(literalFields, (v): v is number => typeof v === 'number', 43);
const numeric = { a: 1, b: 2 };
O.replaceAll(
  numeric,
  (v) => v > 0,
  (v) => v + 1
);
// @ts-expect-error Required fields cannot safely be deleted through a mutable typed alias.
O.unset(person, 'age');
const optionalFields: { age?: number; name: string } = { name: 'M' };
O.unset(optionalFields, 'age');
// @ts-expect-error Match-based deletion could remove required schema fields.
O.removeAll(person, () => true);
const optionalData: Partial<{ a: number; b: number }> = { a: 1 };
O.removeAll(optionalData, 1);
const dynamicData: Record<string, unknown> = {};
O.deepRemoveAll(dynamicData, undefined);
O.deepReplaceAll(dynamicData, undefined, 3);
// @ts-expect-error Arbitrary deep mutation cannot promise an unchanged known schema.
O.deepReplaceAll({ a: { n: 1 } }, 1, 'string');
// eslint-disable-next-line prefer-const -- A widened string models a path selected at runtime.
let unknownPath: string = 'age';
// @ts-expect-error Dynamic paths must not invalidate a known schema.
O.set(person, unknownPath, 'bad');
O.set(dynamicData, unknownPath, 'ok');
const possiblePath: 'age' | 'name' = Math.random() ? 'age' : 'name';
// @ts-expect-error A write must fit every possible destination.
O.set(person, possiblePath, 'bad');
const batchPaths: ('age' | 'name')[] = ['age'];
// @ts-expect-error Dynamic batch keys must not collapse into a union of allowed values.
O.setEach(person, batchPaths, 'bad');
const mixed: Record<string, string | number | null> = { a: 'x', b: 2, c: null };
const isString = (v: string | number | null): v is string => typeof v === 'string';
const one: string | undefined = O.find(mixed, isString);
const last: string | undefined = O.findLast(mixed, isString);
const many: string[] = O.findAll(mixed, isString);
const filtered: Partial<Record<string, string>> = O.filter(mixed, isString);
const entry: [string, string] | undefined = O.findEntry(mixed, isString);
const chainFound: string | undefined = O(mixed).find(isString).unwrap();
const chainFiltered: Partial<Record<string, string>> = O(mixed).filter(isString).unwrap();
const typedEntry = O.findEntry(person, (v): v is number => typeof v === 'number');
if (typedEntry) {
  const key: 'age' = typedEntry[0];
  const number: number = typedEntry[1];
}
const input: unknown = { id: 1 };
if (O.hasProp(input, 'id') && typeof input === 'object' && input !== null && 'id' in input) {
  const id: unknown = input.id;
}
if (O.hasKey(input, 'id') && typeof input === 'object' && input !== null && 'id' in input) {
  const id: unknown = input.id;
}
const branch = O(person);
const keys = branch.keys();
keys.count();
const stillPerson: typeof person = branch.unwrap();
const stillKeys: ('name' | 'age' | 'active')[] = keys.unwrap();
const old = { n: 1, child: { name: 'M' }, untouched: { x: 1 } };
const immutable = O.setImmutable(old, ['child', 'name'] as const, 42);
const newName: number = immutable.child.name;
const oldName: string = old.child.name;
const updated = O.updateImmutable(old, ['n'] as const, (n) => (n ?? 0) + 1);
const updatedN: number = updated.n;
const deleted = O.unsetImmutable(old, ['n'] as const);
// @ts-expect-error Removed field does not remain a required number.
const stillThere: number = deleted.n;
const deepEntry = O.deepFindEntry({ a: { n: 1 } }, (v): v is number => typeof v === 'number');
if (deepEntry) {
  const path: (string | symbol)[] = deepEntry[0];
  const n: number = deepEntry[1];
}
const keymapArray: unknown[] = O.deepMapKeys([{ a_b: 1 }], (_, k) => k, { arrays: 'preserve' });
const keymapRecord: Partial<Record<string | symbol, unknown>> = O.deepMapKeys([{ a_b: 1 }], (_, k) => k);
const dynamicImmutable: unknown = O.setImmutable(old, unknownPath, 42);
// @ts-expect-error A dynamic path does not promise the original shape.
const fakeShape: typeof old = O.setImmutable(old, unknownPath, 42);
const schemaWithIndex: { name: string; [key: string]: unknown } = { name: 'M' };
// @ts-expect-error A broad index signature must not hide a known schema field.
O.set(schemaWithIndex, unknownPath, 42);
// @ts-expect-error An index signature must not permit arbitrary deep schema mutation.
O.deepReplaceAll(schemaWithIndex, 'M', 42);
const shapeWithIndex: { required: number; [key: string]: number } = { required: 1 };
// @ts-expect-error Deletion could remove a declared required field despite the index signature.
O.removeAll(shapeWithIndex, 1);
const innerKey: string = 'name';
const indirect = O.setImmutable({ profile: { name: 'M' } }, ['profile', innerKey], 42);
// @ts-expect-error A dynamic tuple segment must not leave a false original field type.
indirect.profile.name.toUpperCase();
const indirectDeleted = O.unsetImmutable({ profile: { name: 'M' } }, ['profile', innerKey]);
// @ts-expect-error A dynamic deletion cannot guarantee the field remains.
indirectDeleted.profile.name.toUpperCase();
