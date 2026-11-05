import O = require('go-objects');
import unsetImmutable = require('go-objects/unsetImmutable');
// These assertions must fail if nested immutable deletion is typed as the input.
const rows = [{ name: 'Michael', age: 42 }];
const nextRows = O.unsetImmutable(rows, [0, 'name']);
const row = nextRows[0]!;
// @ts-expect-error the selected array member no longer necessarily has name.
row.name.toUpperCase();
const age: number = row.age;
if ('name' in row && typeof row.name === 'string') row.name.toUpperCase();
const tuple: [{ name: string; age: number }, { name: string; age: number }] = [rows[0]!, rows[0]!];
const nextTuple = O.unsetImmutable(tuple, [0, 'name']);
// @ts-expect-error the numeric tuple index aliases the string index.
nextTuple[0].name.toUpperCase();
const tupleAge: number = nextTuple[0].age;
const siblingName: string = nextTuple[1].name;
const tupleLength: 2 = nextTuple.length;
const stringTuple = O.unsetImmutable(tuple, ['0', 'name']);
// @ts-expect-error numeric string tuple paths remove the field too.
stringTuple[0].name.toUpperCase();
const readonlyRows: readonly { readonly name: string; readonly age: number }[] = rows;
const nextReadonly = O.unsetImmutable(readonlyRows, [0, 'name']);
// @ts-expect-error no-op may retain the readonly input.
nextReadonly.push({ age: 3 });
// @ts-expect-error readonly modifiers on unchanged properties are retained.
nextReadonly[0]!.age = 1;
// @ts-expect-error selected readonly element can lack the deleted property.
nextReadonly[0]!.name.toUpperCase();
const users: Record<string, { name: string; age: number }> = { a: rows[0]! };
const nextUsers = O.unsetImmutable(users, ['a', 'name']);
// @ts-expect-error an overlapping dictionary indexer must include deletion.
nextUsers.a!.name.toUpperCase();
const userAge: number = nextUsers.a!.age;
const index: string = 'a';
// @ts-expect-error dynamic reads can find the modified record.
nextUsers[index]!.name.toUpperCase();
const numeric: Record<number, { name: string; age: number }> = { 0: rows[0]! };
const nextNumeric = O.unsetImmutable(numeric, ['0', 'name']);
// @ts-expect-error numeric index signatures include canonical string aliases.
nextNumeric[0]!.name.toUpperCase();
const symbol = Symbol('user');
const symbolic: Record<symbol, { name: string; age: number }> = { [symbol]: rows[0]! };
const nextSymbolic = O.unsetImmutable(symbolic, [symbol, 'name']);
// @ts-expect-error broad symbol indexers include the affected symbol.
nextSymbolic[symbol]!.name.toUpperCase();
const patterned: Record<`user_${string}`, { name: string; age: number }> = { user_a: rows[0]! };
const nextPatterned = O.unsetImmutable(patterned, ['user_a', 'name']);
// @ts-expect-error template-literal indexers include the changed record.
nextPatterned.user_a!.name.toUpperCase();
const nested = { groups: { a: rows } as Record<string, typeof rows>, stable: { name: 'untouched' } };
const nextNested = O.unsetImmutable(nested, ['groups', 'a', 0, 'name']);
// @ts-expect-error propagation must cross a record, dictionary and array.
nextNested.groups.a![0]!.name.toUpperCase();
const stable: string = nextNested.stable.name;
const nextWrapped = O(users).unsetImmutable(['a', 'name']).unwrap();
// @ts-expect-error wrappers must have the same conservative result.
nextWrapped.a!.name.toUpperCase();
const standalone = unsetImmutable(rows, [0, 'name']);
// @ts-expect-error standalone declarations must agree with the namespace.
standalone[0]!.name.toUpperCase();
const optional: { row?: { name: string; age: number } } = {};
const nextOptional = O.unsetImmutable(optional, ['row', 'name']);
const possibleAge: number | undefined = nextOptional.row?.age;
// @ts-expect-error optional parent is retained, but its name is removed if present.
nextOptional.row?.name.toUpperCase();
const numbered = { 0: { name: 'zero', age: 1 }, '01': { name: 'leading-zero', age: 2 } };
const nextNumbered = O.unsetImmutable(numbered, ['0', 'name']);
// @ts-expect-error numeric object keys and canonical string forms alias.
nextNumbered[0].name.toUpperCase();
const leadingZero: string = nextNumbered['01'].name;
const selectedKey = Math.random() > 0.5 ? 'left' : 'right';
const branched = O.unsetImmutable({ left: { name: 'left' }, right: { name: 'right' } }, [selectedKey, 'name']);
// @ts-expect-error neither branch is guaranteed to still have name.
branched.left.name.toUpperCase();
