import O = require('go-objects');
import set = require('go-objects/set');
import unset = require('go-objects/unset');
import updateImmutable = require('go-objects/updateImmutable');

function equal(actual: unknown, expected: unknown): void {
  if (!Object.is(actual, expected)) throw new Error('Mutation runtime/type mismatch');
}

// A patterned string can be a parsed path. Inspect the observed value rather
// than trusting the parent dictionary's value type for every descendant.
function exerciseParsed(path: `item_${string}`): void {
  const input: Record<`item_${string}`, { n: number }> = { item_a: { n: 1 } };
  const value = O.get(input, path);
  if (typeof value !== 'number') throw new Error('Expected the nested numeric leaf');
  equal(value.toFixed(), '1');
  const result = updateImmutable(input, path, (previous) => {
    if (typeof previous !== 'number') throw new Error('Expected a number');
    return previous + 1;
  });
  equal(O.get(result, ['item_a', 'n']), 2);
  equal(input.item_a!.n, 1);
}
exerciseParsed('item_a.n');

function exerciseSegments(key: `item_${string}`): void {
  const original = Object.freeze({ item_a: 1, item_b: 2 });
  const result = O.setImmutable(original, [key], 'changed');
  const untouched = O.get(result, 'item_b');
  if (!O.hasProp(result, 'item_b') || typeof untouched !== 'number')
    throw new Error('An untouched item must remain numeric');
  equal(untouched.toFixed(), '2');
  equal(O.get(result, ['item_a']), 'changed');
  equal(original.item_a, 1);
  const deleted = O.unsetImmutable({ item_a: { name: 'A' }, item_b: { name: 'B' } }, [key, 'name']);
  equal(O.has(deleted, ['item_a', 'name']), false);
  equal(O.get(deleted, ['item_b', 'name']), 'B');
  const chain = O(original).setImmutable([key], 'wrapped');
  equal(chain.unwrap(), chain.result());
  equal(O.get(chain.unwrap(), ['item_a']), 'wrapped');
  equal(O.get(chain.unwrap(), ['item_b']), 2);
}
exerciseSegments('item_a');

// Broad literal segments remain useful for safe homogeneous dictionary data.
function exerciseMutable(key: string, nestedKey: string): void {
  const fields: Record<string, number> = { count: 1, untouched: 2 };
  set(fields, [key], 3);
  equal(fields.count, 3);
  equal(unset(fields, [key]), true);
  equal(fields.count, undefined);
  equal(fields.untouched, 2);
  const nested: Record<string, { optional?: number; required: string }> = {
    row: { optional: 1, required: 'keep' }
  };
  O.unset(nested, [nestedKey, 'optional']);
  equal(nested.row!.optional, undefined);
  equal(nested.row!.required, 'keep');
}
exerciseMutable('count', 'row');

const exact = O.setImmutable({ n: 1, stable: true }, ['n'], 'text');
equal(exact.n.toUpperCase(), 'TEXT');
equal(exact.stable, true);
const tuple: [number, number?] = [1, 2];
O.unset(tuple, [1]);
equal(tuple[0].toFixed(), '1');
equal(tuple[1], undefined);
equal(tuple.length, 2);

declare const numericIdBrand: unique symbol;
type NumericId = number & { readonly [numericIdBrand]: 'numeric-id' };
const firstId = 1 as NumericId;
const secondId = 2 as NumericId;
const numericDomain: Record<NumericId, number> = { [firstId]: 1, [secondId]: 2 };
const brandedSet = O.setImmutable(numericDomain, firstId, 'changed');
equal(O.get(brandedSet, firstId), 'changed');
equal(O.get(brandedSet, secondId), 2);
const brandedUpdate = O.updateImmutable(numericDomain, firstId, () => 'updated');
equal(O.get(brandedUpdate, firstId), 'updated');
equal(O.get(brandedUpdate, secondId), 2);
const brandedUnset = O.unsetImmutable(numericDomain, firstId);
equal(O.hasProp(brandedUnset, firstId), false);
equal(O.get(brandedUnset, secondId), 2);
equal(numericDomain[firstId], 1);
equal(numericDomain[secondId], 2);
