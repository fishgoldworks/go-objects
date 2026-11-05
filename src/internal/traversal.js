'use strict';
const c = require('./common');
const STOP = Symbol('stop traversal');
function optionsOf(options, keyMapping = false) {
  if (options === undefined)
    return {
      maxDepth: Infinity,
      shouldDescend: undefined,
      ...(keyMapping ? { onCollision: 'overwrite', arrays: 'record' } : {})
    };
  if (!c.isPlainRecord(options)) throw new TypeError('Expected traversal options.');
  for (const key of Reflect.ownKeys(options))
    if (key !== 'maxDepth' && key !== 'shouldDescend' && !(keyMapping && (key === 'onCollision' || key === 'arrays')))
      throw new TypeError('Unknown traversal option.');
  const maxDepth = c.own(options, 'maxDepth') ? options.maxDepth : Infinity;
  const shouldDescend = c.own(options, 'shouldDescend') ? options.shouldDescend : undefined;
  if (maxDepth !== Infinity && (!Number.isSafeInteger(maxDepth) || maxDepth < 0))
    throw new TypeError('maxDepth must be a non-negative safe integer or Infinity.');
  if (shouldDescend !== undefined) c.assertFunction(shouldDescend);
  const arrays = keyMapping && c.own(options, 'arrays') ? options.arrays : 'record';
  if (arrays !== 'record' && arrays !== 'preserve') throw new TypeError('arrays must be "record" or "preserve".');
  return { maxDepth, shouldDescend, ...(keyMapping ? { onCollision: c.collisionMode(options), arrays } : {}) };
}
function toPath(link) {
  const result = new Array(link.depth);
  for (let node = link; node; node = node.previous) result[node.depth - 1] = node.key;
  return result;
}
function descend(value, key, parent, link, options) {
  return (
    link.depth < options.maxDepth &&
    c.traversable(value) &&
    (options.shouldDescend === undefined ||
      Reflect.apply(options.shouldDescend, parent, [value, key, parent, toPath(link)]))
  );
}
function frame(node, link, output) {
  return { node, link, output, keys: c.keys(node), index: 0 };
}
function walk(obj, visitor, options) {
  c.assertObject(obj);
  if (options.maxDepth === 0) return;
  const expanded = new WeakSet([obj]),
    stack = [frame(obj, null)];
  while (stack.length) {
    const current = stack[stack.length - 1];
    if (current.index >= current.keys.length) {
      stack.pop();
      continue;
    }
    const key = current.keys[current.index++];
    if (!c.enumerable(current.node, key)) continue;
    const value = current.node[key];
    const link = { key, previous: current.link, depth: (current.link?.depth || 0) + 1 };
    const entry = { value, key, parent: current.node, link };
    const decision = visitor(entry);
    if (decision === STOP) return;
    if (decision !== false && !expanded.has(value) && descend(value, key, current.node, link, options)) {
      expanded.add(value);
      stack.push(frame(value, link));
    }
  }
}
module.exports = { STOP, optionsOf, toPath, descend, frame, walk };
