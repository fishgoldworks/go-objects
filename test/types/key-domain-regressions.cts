import O = require('go-objects');
import set = require('go-objects/set');
import update = require('go-objects/update');
import unset = require('go-objects/unset');
// Negative cases are compile-only: reproduced defects plus guards retained while fixing them.
const optional: { n?: number } = {};
// @ts-expect-error Optional means absent OR number, not a present undefined under exact optional types.
set(optional, 'n', undefined);
// @ts-expect-error Updaters must preserve the declared present-property type.
update(optional, 'n', () => undefined);
// @ts-expect-error Batches must obey the same optional write rule.
O.setEach(optional, ['n'], undefined);
// @ts-expect-error Wrappers must obey the same optional write rule.
O(optional).set('n', undefined);
// @ts-expect-error Replacement of a present optional number cannot write undefined.
O.replace(optional, 1, undefined);

const incomplete: { settings?: { email: boolean; locale: string } } = {};
// @ts-expect-error This would manufacture settings without its required locale.
set(incomplete, ['settings', 'email'], true);
// @ts-expect-error Updaters cannot manufacture incomplete intermediate records either.
update(incomplete, ['settings', 'email'], () => true);
// @ts-expect-error Batches are sequential, not transactional construction of a complete schema.
O.setEach(incomplete, [['settings', 'email']], true);
// @ts-expect-error Nested wrapper writes are subject to the same creation check.
O(incomplete).update(['settings', 'email'], () => true);
const indexed: { users: { name: string; id: number }[] } = { users: [] };
// @ts-expect-error An absent array element would be created without id.
set(indexed, ['users', 0, 'name'], 'Michael');
const dictionary: Record<string, { name: string; id: number }> = {};
// @ts-expect-error An absent dictionary entry would be created without id.
set(dictionary, ['new', 'name'], 'Michael');

declare const union: { kind: 'number'; value: number } | { kind: 'text'; value: string };
// @ts-expect-error A not-yet-narrowed union cannot receive a value invalid for one branch.
set(union, 'value', 'new');
// @ts-expect-error The update callback must return a value valid for every possible branch.
update(union, 'value', () => 2);
// @ts-expect-error Literal matching a number may not replace it with text.
O.replace(union, 1, 'new');
O.replaceAll(
  union,
  (v): v is number => typeof v === 'number',
  // @ts-expect-error Same rule for replacement callbacks.
  () => 'new'
);
declare const deletable: { kind: 'required'; n: number } | { kind: 'optional'; n?: number };
// @ts-expect-error Deletion is unsafe when even one possible branch requires n.
unset(deletable, 'n');
declare const disjoint: { x?: number } | { y: number };
// @ts-expect-error Disjoint union keys must not be mistaken for an erased schema.
O.removeAll(disjoint, () => true);
// @ts-expect-error Typed disjoint unions are not arbitrary dynamic deep data.
O.deepRemoveAll(disjoint, () => true);
// @ts-expect-error Mutating a known field in one disjoint alternative must preserve its type.
set(disjoint, 'x', 'new');

// Positive cases keep ordinary writes useful.
set(optional, 'n', 1);
update(optional, 'n', (previous) => (previous ?? 0) + 1);
unset(optional, 'n');
const explicit: { n?: number | undefined } = {};
set(explicit, 'n', undefined);
O.replace(explicit, 1, undefined);
const complete: { settings?: { email: boolean; locale?: string } } = {};
set(complete, ['settings', 'email'], true);
const existing = { settings: { email: true, locale: 'en' } };
set(existing, ['settings', 'email'], false);
const oneField: { users: { name: string }[] } = { users: [] };
set(oneField, ['users', 0, 'name'], 'Michael');
set(incomplete, ['settings'], { email: true, locale: 'en' });
const next = O.setImmutable(incomplete, ['settings', 'email'], true);
const possibleLocale: string | undefined = 'locale' in next.settings ? next.settings.locale : undefined;
if (union.kind === 'number') {
  set(union, 'value', 2);
  O.replace(union, 2, 3);
}
O.replace(union, 1, 2); // A numeric match only mutates numeric slots.
declare const sharedType: { kind: 'a'; n: number } | { kind: 'b'; n: number };
set(sharedType, 'n', 3);
declare const optionalUnion: { kind: 'a'; n?: number } | { kind: 'b'; n?: string };
unset(optionalUnion, 'n');
const dynamic: Record<string, unknown> = {};
set(dynamic, ['a', 'b'], true);
O.deepRemoveAll(dynamic, () => false);

// Safe union-backed wrappers were incorrectly rejected by a distributive `this` constraint.
O(sharedType).set('n', 3);
O(sharedType).update('n', (previous) => (previous ?? 0) + 1);
O(sharedType).map((value) => String(value));
O(sharedType).find((value) => typeof value === 'number');
O(optionalUnion).unset('n');
// @ts-expect-error Fixing union wrapper usability must not allow incompatible writes.
O(union).set('value', 3);
// @ts-expect-error Literal replacement must retain the matched slot's type on wrappers.
O(union).replace(1, 'new');
// @ts-expect-error Optional writes through wrappers cannot install undefined.
O(optional).replace(1, undefined);
// @ts-expect-error Disjoint union wrappers must protect required fields.
O(disjoint).removeAll(() => true);
// @ts-expect-error Deep operations cannot erase a known union schema through wrappers.
O(disjoint).deepRemoveAll(() => true);
declare const nullableCollection: { x: number } | null;
// @ts-expect-error Every possible wrapper value must be a collection.
O(nullableCollection).map((v) => v);

// Preserve useful, complete initialization through ordinary literal array indices.
const rows: { rows?: { name: string; id: number }[] } = {};
O.set(rows, ['rows', 0], { name: 'Michael', id: 1 });
O.set(rows, ['rows', '3'], { name: 'Michael', id: 2 });
const digitKey: { branch?: { '01': string } } = {};
O.set(digitKey, ['branch', '01'], 'literal, not an array index');
const negativeKey: { branch?: { '-1': string } } = {};
O.set(negativeKey, ['branch', -1], 'literal');
// @ts-expect-error A negative index would create a record, not the required array.
O.set(rows, ['rows', -1], { name: 'M', id: 3 });
// @ts-expect-error Building a sparse element must still supply all its required fields.
O.set(rows, ['rows', 0, 'name'], 'incomplete');
