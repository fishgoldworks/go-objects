import O = require('go-objects');

const bag: Record<string, unknown> = { a: 'text' };
const objects: Record<string, object> = { a: { n: 1 } };
const needle = { call: 1, apply: 'data', bind: true };
const tooNarrow = (value: number) => value.toFixed();
const replacement = (value: unknown) => String(value);
// @ts-expect-error Functions are callbacks, never identity literals; number cannot handle unknown values.
O.some(bag, tooNarrow);
O.some(bag, needle);
O.some(bag, (value) => typeof value === 'string');
// @ts-expect-error Functions are callbacks, never identity literals; number cannot handle unknown values.
O(bag).some(tooNarrow);
O(bag).some(needle);
O(bag).some((value) => typeof value === 'string');
// @ts-expect-error Functions are callbacks, never identity literals; number cannot handle unknown values.
O.every(bag, tooNarrow);
O.every(bag, needle);
O.every(bag, (value) => typeof value === 'string');
// @ts-expect-error Functions are callbacks, never identity literals; number cannot handle unknown values.
O(bag).every(tooNarrow);
O(bag).every(needle);
O(bag).every((value) => typeof value === 'string');
// @ts-expect-error Functions are callbacks, never identity literals; number cannot handle unknown values.
O.find(bag, tooNarrow);
O.find(bag, needle);
O.find(bag, (value) => typeof value === 'string');
// @ts-expect-error Functions are callbacks, never identity literals; number cannot handle unknown values.
O(bag).find(tooNarrow);
O(bag).find(needle);
O(bag).find((value) => typeof value === 'string');
// @ts-expect-error Functions are callbacks, never identity literals; number cannot handle unknown values.
O.findLast(bag, tooNarrow);
O.findLast(bag, needle);
O.findLast(bag, (value) => typeof value === 'string');
// @ts-expect-error Functions are callbacks, never identity literals; number cannot handle unknown values.
O(bag).findLast(tooNarrow);
O(bag).findLast(needle);
O(bag).findLast((value) => typeof value === 'string');
// @ts-expect-error Functions are callbacks, never identity literals; number cannot handle unknown values.
O.findAll(bag, tooNarrow);
O.findAll(bag, needle);
O.findAll(bag, (value) => typeof value === 'string');
// @ts-expect-error Functions are callbacks, never identity literals; number cannot handle unknown values.
O(bag).findAll(tooNarrow);
O(bag).findAll(needle);
O(bag).findAll((value) => typeof value === 'string');
// @ts-expect-error Functions are callbacks, never identity literals; number cannot handle unknown values.
O.findKey(bag, tooNarrow);
O.findKey(bag, needle);
O.findKey(bag, (value) => typeof value === 'string');
// @ts-expect-error Functions are callbacks, never identity literals; number cannot handle unknown values.
O(bag).findKey(tooNarrow);
O(bag).findKey(needle);
O(bag).findKey((value) => typeof value === 'string');
// @ts-expect-error Functions are callbacks, never identity literals; number cannot handle unknown values.
O.findEntry(bag, tooNarrow);
O.findEntry(bag, needle);
O.findEntry(bag, (value) => typeof value === 'string');
// @ts-expect-error Functions are callbacks, never identity literals; number cannot handle unknown values.
O(bag).findEntry(tooNarrow);
O(bag).findEntry(needle);
O(bag).findEntry((value) => typeof value === 'string');
// @ts-expect-error Functions are callbacks, never identity literals; number cannot handle unknown values.
O.count(bag, tooNarrow);
O.count(bag, needle);
O.count(bag, (value) => typeof value === 'string');
// @ts-expect-error Functions are callbacks, never identity literals; number cannot handle unknown values.
O(bag).count(tooNarrow);
O(bag).count(needle);
O(bag).count((value) => typeof value === 'string');
// @ts-expect-error Functions are callbacks, never identity literals; number cannot handle unknown values.
O.remove(bag, tooNarrow);
O.remove(bag, needle);
O.remove(bag, (value) => typeof value === 'string');
// @ts-expect-error Functions are callbacks, never identity literals; number cannot handle unknown values.
O(bag).remove(tooNarrow);
O(bag).remove(needle);
O(bag).remove((value) => typeof value === 'string');
// @ts-expect-error Functions are callbacks, never identity literals; number cannot handle unknown values.
O.removeLast(bag, tooNarrow);
O.removeLast(bag, needle);
O.removeLast(bag, (value) => typeof value === 'string');
// @ts-expect-error Functions are callbacks, never identity literals; number cannot handle unknown values.
O(bag).removeLast(tooNarrow);
O(bag).removeLast(needle);
O(bag).removeLast((value) => typeof value === 'string');
// @ts-expect-error Functions are callbacks, never identity literals; number cannot handle unknown values.
O.removeAll(bag, tooNarrow);
O.removeAll(bag, needle);
O.removeAll(bag, (value) => typeof value === 'string');
// @ts-expect-error Functions are callbacks, never identity literals; number cannot handle unknown values.
O(bag).removeAll(tooNarrow);
O(bag).removeAll(needle);
O(bag).removeAll((value) => typeof value === 'string');
// @ts-expect-error Functions are callbacks, never identity literals; number cannot handle unknown values.
O.deepFind(bag, tooNarrow);
O.deepFind(bag, needle);
O.deepFind(bag, (value) => typeof value === 'string');
// @ts-expect-error Functions are callbacks, never identity literals; number cannot handle unknown values.
O(bag).deepFind(tooNarrow);
O(bag).deepFind(needle);
O(bag).deepFind((value) => typeof value === 'string');
// @ts-expect-error Functions are callbacks, never identity literals; number cannot handle unknown values.
O.deepFindLast(bag, tooNarrow);
O.deepFindLast(bag, needle);
O.deepFindLast(bag, (value) => typeof value === 'string');
// @ts-expect-error Functions are callbacks, never identity literals; number cannot handle unknown values.
O(bag).deepFindLast(tooNarrow);
O(bag).deepFindLast(needle);
O(bag).deepFindLast((value) => typeof value === 'string');
// @ts-expect-error Functions are callbacks, never identity literals; number cannot handle unknown values.
O.deepFindAll(bag, tooNarrow);
O.deepFindAll(bag, needle);
O.deepFindAll(bag, (value) => typeof value === 'string');
// @ts-expect-error Functions are callbacks, never identity literals; number cannot handle unknown values.
O(bag).deepFindAll(tooNarrow);
O(bag).deepFindAll(needle);
O(bag).deepFindAll((value) => typeof value === 'string');
// @ts-expect-error Functions are callbacks, never identity literals; number cannot handle unknown values.
O.deepFindKey(bag, tooNarrow);
O.deepFindKey(bag, needle);
O.deepFindKey(bag, (value) => typeof value === 'string');
// @ts-expect-error Functions are callbacks, never identity literals; number cannot handle unknown values.
O(bag).deepFindKey(tooNarrow);
O(bag).deepFindKey(needle);
O(bag).deepFindKey((value) => typeof value === 'string');
// @ts-expect-error Functions are callbacks, never identity literals; number cannot handle unknown values.
O.deepFindEntry(bag, tooNarrow);
O.deepFindEntry(bag, needle);
O.deepFindEntry(bag, (value) => typeof value === 'string');
// @ts-expect-error Functions are callbacks, never identity literals; number cannot handle unknown values.
O(bag).deepFindEntry(tooNarrow);
O(bag).deepFindEntry(needle);
O(bag).deepFindEntry((value) => typeof value === 'string');
// @ts-expect-error Functions are callbacks, never identity literals; number cannot handle unknown values.
O.findPath(bag, tooNarrow);
O.findPath(bag, needle);
O.findPath(bag, (value) => typeof value === 'string');
// @ts-expect-error Functions are callbacks, never identity literals; number cannot handle unknown values.
O(bag).findPath(tooNarrow);
O(bag).findPath(needle);
O(bag).findPath((value) => typeof value === 'string');
// @ts-expect-error Functions are callbacks, never identity literals; number cannot handle unknown values.
O.deepCount(bag, tooNarrow);
O.deepCount(bag, needle);
O.deepCount(bag, (value) => typeof value === 'string');
// @ts-expect-error Functions are callbacks, never identity literals; number cannot handle unknown values.
O(bag).deepCount(tooNarrow);
O(bag).deepCount(needle);
O(bag).deepCount((value) => typeof value === 'string');
// @ts-expect-error Functions are callbacks, never identity literals; number cannot handle unknown values.
O.deepRemove(bag, tooNarrow);
O.deepRemove(bag, needle);
O.deepRemove(bag, (value) => typeof value === 'string');
// @ts-expect-error Functions are callbacks, never identity literals; number cannot handle unknown values.
O(bag).deepRemove(tooNarrow);
O(bag).deepRemove(needle);
O(bag).deepRemove((value) => typeof value === 'string');
// @ts-expect-error Functions are callbacks, never identity literals; number cannot handle unknown values.
O.deepRemoveLast(bag, tooNarrow);
O.deepRemoveLast(bag, needle);
O.deepRemoveLast(bag, (value) => typeof value === 'string');
// @ts-expect-error Functions are callbacks, never identity literals; number cannot handle unknown values.
O(bag).deepRemoveLast(tooNarrow);
O(bag).deepRemoveLast(needle);
O(bag).deepRemoveLast((value) => typeof value === 'string');
// @ts-expect-error Functions are callbacks, never identity literals; number cannot handle unknown values.
O.deepRemoveAll(bag, tooNarrow);
O.deepRemoveAll(bag, needle);
O.deepRemoveAll(bag, (value) => typeof value === 'string');
// @ts-expect-error Functions are callbacks, never identity literals; number cannot handle unknown values.
O(bag).deepRemoveAll(tooNarrow);
O(bag).deepRemoveAll(needle);
O(bag).deepRemoveAll((value) => typeof value === 'string');
// @ts-expect-error Matcher callbacks must accept the observed value type.
O.replace(bag, tooNarrow, needle);
// @ts-expect-error Replacement callbacks must accept the observed value type.
O.replace(bag, () => true, tooNarrow);
O.replace(bag, () => true, needle);
O.replace(bag, needle, replacement);
// @ts-expect-error Matcher callbacks must accept the observed value type.
O(bag).replace(tooNarrow, needle);
// @ts-expect-error Replacement callbacks must accept the observed value type.
O(bag).replace(() => true, tooNarrow);
O(bag).replace(() => true, needle);
O(bag).replace(needle, replacement);
// @ts-expect-error Matcher callbacks must accept the observed value type.
O.replaceLast(bag, tooNarrow, needle);
// @ts-expect-error Replacement callbacks must accept the observed value type.
O.replaceLast(bag, () => true, tooNarrow);
O.replaceLast(bag, () => true, needle);
O.replaceLast(bag, needle, replacement);
// @ts-expect-error Matcher callbacks must accept the observed value type.
O(bag).replaceLast(tooNarrow, needle);
// @ts-expect-error Replacement callbacks must accept the observed value type.
O(bag).replaceLast(() => true, tooNarrow);
O(bag).replaceLast(() => true, needle);
O(bag).replaceLast(needle, replacement);
// @ts-expect-error Matcher callbacks must accept the observed value type.
O.replaceAll(bag, tooNarrow, needle);
// @ts-expect-error Replacement callbacks must accept the observed value type.
O.replaceAll(bag, () => true, tooNarrow);
O.replaceAll(bag, () => true, needle);
O.replaceAll(bag, needle, replacement);
// @ts-expect-error Matcher callbacks must accept the observed value type.
O(bag).replaceAll(tooNarrow, needle);
// @ts-expect-error Replacement callbacks must accept the observed value type.
O(bag).replaceAll(() => true, tooNarrow);
O(bag).replaceAll(() => true, needle);
O(bag).replaceAll(needle, replacement);
// @ts-expect-error Matcher callbacks must accept the observed value type.
O.deepReplace(bag, tooNarrow, needle);
// @ts-expect-error Replacement callbacks must accept the observed value type.
O.deepReplace(bag, () => true, tooNarrow);
O.deepReplace(bag, () => true, needle);
O.deepReplace(bag, needle, replacement);
// @ts-expect-error Matcher callbacks must accept the observed value type.
O(bag).deepReplace(tooNarrow, needle);
// @ts-expect-error Replacement callbacks must accept the observed value type.
O(bag).deepReplace(() => true, tooNarrow);
O(bag).deepReplace(() => true, needle);
O(bag).deepReplace(needle, replacement);
// @ts-expect-error Matcher callbacks must accept the observed value type.
O.deepReplaceLast(bag, tooNarrow, needle);
// @ts-expect-error Replacement callbacks must accept the observed value type.
O.deepReplaceLast(bag, () => true, tooNarrow);
O.deepReplaceLast(bag, () => true, needle);
O.deepReplaceLast(bag, needle, replacement);
// @ts-expect-error Matcher callbacks must accept the observed value type.
O(bag).deepReplaceLast(tooNarrow, needle);
// @ts-expect-error Replacement callbacks must accept the observed value type.
O(bag).deepReplaceLast(() => true, tooNarrow);
O(bag).deepReplaceLast(() => true, needle);
O(bag).deepReplaceLast(needle, replacement);
// @ts-expect-error Matcher callbacks must accept the observed value type.
O.deepReplaceAll(bag, tooNarrow, needle);
// @ts-expect-error Replacement callbacks must accept the observed value type.
O.deepReplaceAll(bag, () => true, tooNarrow);
O.deepReplaceAll(bag, () => true, needle);
O.deepReplaceAll(bag, needle, replacement);
// @ts-expect-error Matcher callbacks must accept the observed value type.
O(bag).deepReplaceAll(tooNarrow, needle);
// @ts-expect-error Replacement callbacks must accept the observed value type.
O(bag).deepReplaceAll(() => true, tooNarrow);
O(bag).deepReplaceAll(() => true, needle);
O(bag).deepReplaceAll(needle, replacement);
// @ts-expect-error Broad object-valued collections must not admit incompatible callbacks either.
O.find(objects, tooNarrow);
const objectLiteral: object = needle;
O.deepFind(bag, objectLiteral);
O.find(bag, objectLiteral);
const mixed: string | typeof needle = Math.random() ? 'text' : needle;
O.deepFind(bag, mixed);
O.find(bag, mixed);
const narrowed: string | undefined = O.deepFind(bag, (value): value is string => typeof value === 'string');
const chainNarrowed: string | undefined = O(bag)
  .deepFind((value): value is string => typeof value === 'string')
  .unwrap();
O.deepFind({ a: 'text' }, (value) => {
  const check: unknown = value;
  return check === 'text';
});
