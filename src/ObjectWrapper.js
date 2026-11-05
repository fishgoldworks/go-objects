'use strict';
const api = {
  unsetImmutable: require('./unsetImmutable'),
  updateImmutable: require('./updateImmutable'),
  setImmutable: require('./setImmutable'),
  deepFindEntry: require('./deepFindEntry'),
  has: require('./has'),
  update: require('./update'),
  some: require('./some'),
  every: require('./every'),
  findEntry: require('./findEntry'),
  clone: require('./clone'),
  count: require('./count'),
  deepClone: require('./deepClone'),
  deepCount: require('./deepCount'),
  deepFilter: require('./deepFilter'),
  deepFind: require('./deepFind'),
  deepFindAll: require('./deepFindAll'),
  deepFindKey: require('./deepFindKey'),
  deepFindLast: require('./deepFindLast'),
  deepForEach: require('./deepForEach'),
  deepMap: require('./deepMap'),
  deepMapKeys: require('./deepMapKeys'),
  deepRemove: require('./deepRemove'),
  deepRemoveAll: require('./deepRemoveAll'),
  deepRemoveLast: require('./deepRemoveLast'),
  deepReplace: require('./deepReplace'),
  deepReplaceAll: require('./deepReplaceAll'),
  deepReplaceLast: require('./deepReplaceLast'),
  entries: require('./entries'),
  except: require('./except'),
  filter: require('./filter'),
  find: require('./find'),
  findAll: require('./findAll'),
  findKey: require('./findKey'),
  findLast: require('./findLast'),
  findPath: require('./findPath'),
  forEach: require('./forEach'),
  get: require('./get'),
  getEach: require('./getEach'),
  hasKey: require('./hasKey'),
  hasProp: require('./hasProp'),
  hasValue: require('./hasValue'),
  intersect: require('./intersect'),
  keys: require('./keys'),
  map: require('./map'),
  mapKeys: require('./mapKeys'),
  merge: require('./merge'),
  omit: require('./omit'),
  pick: require('./pick'),
  reduce: require('./reduce'),
  reduceRight: require('./reduceRight'),
  remove: require('./remove'),
  removeAll: require('./removeAll'),
  removeLast: require('./removeLast'),
  replace: require('./replace'),
  replaceAll: require('./replaceAll'),
  replaceLast: require('./replaceLast'),
  set: require('./set'),
  setEach: require('./setEach'),
  unset: require('./unset'),
  values: require('./values')
};
const mutations = new Set([
  'set',
  'update',
  'unset',
  'setEach',
  'remove',
  'removeLast',
  'removeAll',
  'replace',
  'replaceLast',
  'replaceAll',
  'deepRemove',
  'deepRemoveLast',
  'deepRemoveAll',
  'deepReplace',
  'deepReplaceLast',
  'deepReplaceAll'
]);

/**
 * Creates a fresh wrapper for a value and starts an independent pipeline.
 * Each utility call executes immediately and returns a new wrapper. Explicit
 * mutators still share and change the underlying input data.
 * @param value The initial pipeline value, retained by reference.
 * @returns A fresh wrapper whose current value and last result equal the input.
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#objectsvalue
 */
function ObjectWrapper(value) {
  // Factory calls ignore their receiver; only actual construction initializes it.
  if (!new.target) return new ObjectWrapper(value);
  this._value = value;
  this._result = value;
}
Object.defineProperties(ObjectWrapper.prototype, {
  unwrap: {
    value: function () {
      return this._value;
    }
  },
  result: {
    value: function () {
      return this._result;
    }
  }
});
for (const [name, fn] of Object.entries(api)) {
  Object.defineProperty(ObjectWrapper, name, { value: fn, enumerable: true });
  Object.defineProperty(ObjectWrapper.prototype, name, {
    value: function (...args) {
      const result = fn(this._value, ...args);
      // Persist chain bookkeeping; explicit mutators still share the input data.
      const next = new ObjectWrapper(mutations.has(name) ? this._value : result);
      next._result = result;
      return next;
    }
  });
}
module.exports = ObjectWrapper;
