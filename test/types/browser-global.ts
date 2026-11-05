// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- A script consumer tests the UMD global without importing a module.
/// <reference path="../../node_modules/go-objects/dist/go-objects.d.ts" />
const found: boolean = Objects.has({ a: 1 }, 'a');
const mapped: { a: string } = Objects({ a: 1 })
  .map((n) => String(n))
  .unwrap();
// @ts-expect-error A boolean query is not still the original record.
const original: { a: number } = Objects({ a: 1 }).has('a').unwrap();

const dictionary: Record<string, number> = {};
const selection = Objects.pick(dictionary, ['missing']);
// @ts-expect-error The browser-global declaration must not invent an indexed entry.
selection.missing.toFixed();
const ordinary: number = Objects.pick({ n: 1 }, ['n']).n;

// the browser global uses the same path-domain protections.
declare const dynamicKey: string;
declare const patternedKey: `item_${string}`;
const requiredRecord = { name: 'Michael' };
// @ts-expect-error A broad literal segment can address the required field.
Objects.unset(requiredRecord, [dynamicKey]);
const patternedData: Record<`item_${string}`, number> = {};
// @ts-expect-error A patterned parsed path is not a known schema destination.
Objects.set(patternedData, patternedKey, 3);
const patternedResult = Objects.setImmutable(patternedData, [patternedKey], 'changed');
// @ts-expect-error Untouched entries cannot all become strings by declaration.
patternedResult.item_b.toUpperCase();
Objects.set(patternedData, [patternedKey], 3);
Objects.unset(patternedData, [patternedKey]);
const stillPrecise: string = Objects.setImmutable({ n: 1 }, ['n'], 'text').n;
