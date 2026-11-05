import O = require('go-objects');
// With exactOptionalPropertyTypes disabled, the compiler explicitly permits
// an optional property to be present with undefined. Match that configuration.
const optional: { n?: number } = {};
O.set(optional, 'n', undefined);
O.update(optional, 'n', () => undefined);
O.setEach(optional, ['n'], undefined);
O.replace(optional, 1, undefined);
O(optional).set('n', undefined);
const explicit: { n?: number | undefined } = {};
O.set(explicit, 'n', undefined);
const required = { n: 1 };
// @ts-expect-error Disabling exact optional types does not permit undefined in required numbers.
O.set(required, 'n', undefined);
const partial: { child?: { x: number; name: string } } = {};
// @ts-expect-error It must still be impossible to manufacture an incomplete child.
O.set(partial, ['child', 'x'], 1);
declare const union: { kind: 'a'; value: number } | { kind: 'b'; value: string };
// @ts-expect-error Config-dependent optional writes must not weaken union checking.
O.set(union, 'value', 'bad');

// Dictionary widening and no-op readonly preservation apply under this mode too.
const numericDictionary: Record<string, number> = {};
const updatedDictionary = O.setImmutable(numericDictionary, 'label', 'new');
declare const dictionaryKey: string;
// @ts-expect-error A dynamic read can see the new string in either optional mode.
updatedDictionary[dictionaryKey]?.toFixed();
const presentUndefined: { n?: number } = { n: undefined };
const optionalMerge = O.merge({ n: 1 }, presentUndefined);
const possibleUndefined: number | undefined = optionalMerge.n;
// @ts-expect-error Default optional semantics allow the override to store undefined.
const notAlwaysNumber: number = optionalMerge.n;
const readonlyInput = Object.freeze({ n: 1 as number });
const readonlyResult = O.setImmutable(readonlyInput, 'n', 1);
// @ts-expect-error No-op reuse still preserves readonly constraints.
readonlyResult.n = 2;
