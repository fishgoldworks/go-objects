'use strict';
const c = require('./common');
const p = require('./path');

function assertContainer(value) {
  if (!c.traversable(value)) throw new TypeError('Immutable paths require ordinary records or arrays.');
  if (Array.isArray(value)) {
    const proto = Object.getPrototypeOf(value);
    if (proto !== null && !c.isNativeArrayPrototype(proto)) {
      throw new TypeError('Arrays with non-native prototypes are not immutable path containers.');
    }
  }
}
function descriptorAt(node, key) {
  if (Array.isArray(node) && key === 'length')
    throw new TypeError('Array length cannot be an immutable mutation path.');
  const descriptor = Object.getOwnPropertyDescriptor(node, key);
  if (descriptor && !c.own(descriptor, 'value'))
    throw new TypeError('Immutable paths cannot traverse or replace accessors.');
  return descriptor;
}
/** Copy one container, not its graph. Do not evaluate any accessor. */
function copyContainer(node) {
  let output;
  if (Array.isArray(node)) {
    output = new Array(node.length);
    const proto = Object.getPrototypeOf(node);
    // Structural sharing should preserve the exact supported realm prototype,
    // not silently normalise cross-realm arrays into the current realm.
    if (proto !== Array.prototype) Object.setPrototypeOf(output, proto);
  } else {
    // assertContainer already restricted records to ordinary/null-prototype
    // objects, so retaining their exact prototype is safe and keeps realm
    // identity consistent across the copied spine.
    output = Object.create(Object.getPrototypeOf(node));
  }
  for (const key of Reflect.ownKeys(node)) {
    if (Array.isArray(node) && key === 'length') continue;
    const descriptor = Object.getOwnPropertyDescriptor(node, key);
    if (!descriptor) continue; // Proxy side effects are not transactional.
    if (c.own(descriptor, 'value')) {
      descriptor.writable = true;
      descriptor.configurable = true;
    }
    Object.defineProperty(output, key, descriptor);
  }
  return output;
}
function change(obj, path, valueOrUpdater, mode) {
  const segments = p.mutablePath(path);
  if (mode === 'update') c.assertFunction(valueOrUpdater);
  assertContainer(obj);
  const spine = [];
  let node = obj;
  for (let index = 0; index < segments.length; index++) {
    const key = segments[index],
      descriptor = descriptorAt(node, key);
    if (mode === 'unset' && !descriptor) return obj;
    spine.push({ node, key, descriptor });
    if (index === segments.length - 1) break;
    if (!descriptor || descriptor.value === undefined) {
      if (mode === 'unset') return obj;
      node = c.indexKey(segments[index + 1]) ? [] : {};
    } else {
      assertContainer(descriptor.value);
      node = descriptor.value;
    }
  }
  const last = spine[spine.length - 1];
  const previous = last.descriptor ? last.descriptor.value : undefined;
  let next = mode === 'update' ? valueOrUpdater(previous) : valueOrUpdater;
  if (mode !== 'unset' && last.descriptor && Object.is(previous, next)) return obj;
  // Build back toward the root. Revisited graph nodes are path occurrences,
  // not shared clone identities; off-path edges intentionally retain originals.
  for (let index = spine.length - 1; index >= 0; index--) {
    const { node: parent, key, descriptor } = spine[index],
      output = copyContainer(parent);
    if (mode === 'unset' && index === spine.length - 1) {
      if (!Reflect.deleteProperty(output, key)) throw new TypeError('Cannot delete copied property.');
    } else {
      Object.defineProperty(output, key, {
        value: next,
        writable: true,
        configurable: true,
        enumerable: descriptor ? descriptor.enumerable : true
      });
    }
    next = output;
  }
  return next;
}
function setImmutable(obj, path, value) {
  c.requireArgs(arguments, 3);
  return change(obj, path, value, 'set');
}
function updateImmutable(obj, path, updater) {
  c.requireArgs(arguments, 3);
  return change(obj, path, updater, 'update');
}
function unsetImmutable(obj, path) {
  c.requireArgs(arguments, 2);
  return change(obj, path, undefined, 'unset');
}
module.exports = { setImmutable, updateImmutable, unsetImmutable };
