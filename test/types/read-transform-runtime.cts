// Executed, safely narrowed counterparts of the rejected type-checking examples.
import O = require('go-objects');
import pick = require('go-objects/pick');
function equal(actual: unknown, expected: unknown): void {
  if (!Object.is(actual, expected)) throw new Error('Read/transform runtime/type mismatch');
}
function assertAbsent(object: object, key: PropertyKey): void {
  equal(Object.hasOwn(object, key), false);
}
const dictionary: Record<string, number> = {};
const selected = O.pick(dictionary, ['missing']);
assertAbsent(selected, 'missing');
equal(selected.missing?.toFixed(), undefined);
const rows: number[] = [];
const selectedRows = pick(rows, [0]);
assertAbsent(selectedRows, '0');
equal(selectedRows[0]?.toFixed(), undefined);
const numeric: Record<number, string> = {};
equal(pick(numeric, [12])[12]?.toUpperCase(), undefined);
const templates: Record<`item_${string}`, { size: number }> = {};
equal(O.pick(templates, ['item_none']).item_none?.size, undefined);
const symbol = Symbol('absent');
const symbolic: Record<symbol, number> = {};
equal(O.pick(symbolic, [symbol])[symbol]?.toFixed(), undefined);
const wrapped = O(dictionary).pick(['missing']);
equal(wrapped.unwrap().missing?.toFixed(), undefined);
equal(wrapped.result(), wrapped.unwrap());
equal(O(dictionary).unwrap(), dictionary);

const present: { required: number; [key: string]: number } = { required: 7 };
const requested = pick(present, ['required', 'missing']);
equal(requested.required.toFixed(), '7');
equal(requested.missing?.toFixed(), undefined);
const tuple: readonly [number, string?] = [2];
const selectedTuple = pick(tuple, [0, 1]);
equal(selectedTuple[0].toFixed(), '2');
equal(selectedTuple[1]?.toUpperCase(), undefined);
const extra = Object.assign([] as number[], { label: 'present' });
const extras = pick(extra, ['label', 0]);
equal(extras.label.toUpperCase(), 'PRESENT');
equal(extras[0]?.toFixed(), undefined);
const optional: { required: number; optional?: number } = { required: 1 };
equal(pick(optional, ['optional']).optional?.toFixed(), undefined);

const mixed = { name: 'Michael', age: 42 };
const firstNumber = O.find(mixed, (value): value is number => typeof value === 'number');
equal(firstNumber?.toFixed(), '42');
const entry = O.findEntry(mixed, (value): value is string => typeof value === 'string');
if (!entry) throw new Error('Expected a string entry');
equal(entry[0], 'name');
equal(entry[1].toUpperCase(), 'MICHAEL');
const mapped = O.map(mixed, String);
equal(mapped.name, 'Michael');
equal(mapped.age, '42');
const sum = O.reduce({ a: 1, b: 2 }, (accumulator, value) => accumulator + value, 0);
equal(sum.toFixed(), '3');
// Key spelling stays literal: these requests must not select the required '1'.
const aliases: { 1: string; [key: number]: string } = { 1: 'present' };
for (const spelling of ['01', '1.0', '1e0'] as const) {
  const result = pick(aliases, [spelling]);
  equal(result[1]?.toUpperCase(), undefined);
  assertAbsent(result, '1');
}
equal(pick(aliases, ['1'])[1].toUpperCase(), 'PRESENT');

function selectUnion(source: { name: string } | Record<string, string>): string | undefined {
  return O.pick(source, ['name']).name?.toUpperCase();
}
equal(selectUnion({}), undefined);
equal(selectUnion({ name: 'present' }), 'PRESENT');
function selectArrayUnion(source: readonly [string] | readonly string[]): string | undefined {
  return pick(source, [0])[0]?.toUpperCase();
}
equal(selectArrayUnion([]), undefined);
equal(selectArrayUnion(['present']), 'PRESENT');

console.log('Read and transformation runtime fixture completed');
