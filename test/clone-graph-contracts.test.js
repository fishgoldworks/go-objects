'use strict';
// graph identity, descriptor ownership and backing memory (not type admission).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const O = require('..');

for (const method of ['clone', 'deepClone']) {
  test(`${method} preserves setter/getter descriptors and binds later access to the copy`, () => {
    let gets = 0,
      sets = 0;
    const source = { stored: { n: 1 } };
    const getter = function () {
      gets++;
      return this.stored;
    };
    const setter = function (value) {
      sets++;
      this.stored = value;
    };
    Object.defineProperty(source, 'access', { get: getter, set: setter, enumerable: false, configurable: false });
    const copy = O[method](source, { unsupported: 'throw' });
    assert.equal(gets, 0);
    assert.equal(sets, 0);
    assert.deepEqual(
      Object.getOwnPropertyDescriptor(copy, 'access'),
      Object.getOwnPropertyDescriptor(source, 'access')
    );
    assert.equal(copy.access, copy.stored);
    assert.equal(copy.stored === source.stored, method === 'clone');
    copy.access = { n: 7 };
    assert.equal(copy.stored.n, 7);
    assert.equal(source.stored.n, 1);
    assert.equal(gets, 1);
    assert.equal(sets, 1);
  });

  test(`${method} restores own __proto__, constructor and prototype data without changing the copy prototype`, () => {
    const shared = { n: 1 },
      symbol = Symbol('alias'),
      source = Object.create(null);
    for (const key of ['__proto__', 'constructor', 'prototype', symbol])
      Object.defineProperty(source, key, { value: shared, writable: false, configurable: false, enumerable: false });
    Object.preventExtensions(source);
    const copy = O[method](source, { unsupported: 'throw' });
    assert.equal(Object.getPrototypeOf(copy), null);
    assert.equal(Object.isFrozen(copy), true);
    assert.deepEqual(Reflect.ownKeys(copy), Reflect.ownKeys(source));
    for (const key of Reflect.ownKeys(source)) {
      assert.equal(copy[key], copy[symbol]);
      assert.deepEqual(Object.getOwnPropertyDescriptor(copy, key), {
        ...Object.getOwnPropertyDescriptor(source, key),
        value: copy[symbol]
      });
    }
    assert.equal(copy[symbol] === shared, method === 'clone');
  });

  test(`${method} copies RegExp object-valued lastIndex and reconnects it only in deep mode`, () => {
    const source = /state/gy,
      state = { owner: source };
    source.lastIndex = state;
    Object.freeze(source);
    const copy = O[method](source, { unsupported: 'throw' });
    assert.notEqual(copy, source);
    assert.equal(copy.source, 'state');
    assert.equal(copy.flags, 'gy');
    assert.equal(copy.lastIndex === state, method === 'clone');
    assert.equal(copy.lastIndex.owner, method === 'clone' ? source : copy);
    assert.equal(Object.isFrozen(copy), true);
    assert.equal(Object.getOwnPropertyDescriptor(copy, 'lastIndex').writable, false);
    assert.equal(state.owner, source);
  });

  test(`${method} copies Map native entries without consulting shadowed iteration or mutation members`, () => {
    const key = { n: 1 },
      source = new Map([[key, key]]),
      marker = Symbol('key');
    let reads = 0;
    const getter = () => {
      reads++;
      throw new Error('own member is not a native operation');
    };
    for (const name of ['entries', 'set', 'size', Symbol.iterator])
      Object.defineProperty(source, name, { get: getter });
    Object.defineProperty(source, marker, { value: key });
    Object.freeze(source);
    const copy = O[method](source, { unsupported: 'throw' });
    const entries = [...Map.prototype.entries.call(copy)];
    assert.equal(entries.length, 1);
    assert.equal(entries[0][0], copy[marker]);
    assert.equal(entries[0][1], copy[marker]);
    assert.equal(copy[marker] === key, method === 'clone');
    assert.equal(Object.isFrozen(copy), true);
    assert.equal(reads, 0);
    assert.equal(Object.getOwnPropertyDescriptor(copy, 'entries').get, getter);
  });

  test(`${method} copies Set native members and own descriptors without invoking a custom iterator`, () => {
    const item = { n: 1 },
      source = new Set([item]);
    let reads = 0;
    const getter = () => {
      reads++;
      throw new Error('do not invoke');
    };
    for (const name of ['values', 'add', Symbol.iterator]) Object.defineProperty(source, name, { get: getter });
    Object.defineProperty(source, 'item', { value: item });
    const copy = O[method](source, { unsupported: 'throw' });
    assert.equal(Set.prototype.has.call(copy, copy.item), true);
    assert.equal(copy.item === item, method === 'clone');
    assert.equal([...Set.prototype.values.call(copy)].length, 1);
    assert.equal(reads, 0);
    assert.equal(Object.getOwnPropertyDescriptor(copy, Symbol.iterator).get, getter);
  });

  test(`${method} copies every backing byte of a Float64 subview without canonicalising NaN payloads`, () => {
    const buffer = new ArrayBuffer(32),
      bytes = new Uint8Array(buffer),
      view = new Float64Array(buffer, 8, 2);
    for (let index = 0; index < bytes.length; index++) bytes[index] = (index * 29 + 7) % 256;
    // Two distinct NaN payloads. Copy bytes rather than comparing numeric NaNs.
    const data = new DataView(buffer);
    data.setBigUint64(8, 0x7ff0000000000001n, true);
    data.setBigUint64(16, 0xfff80000000000a5n, true);
    const expected = Array.from(bytes);
    const copy = O[method](view);
    assert.notEqual(copy.buffer, buffer);
    assert.equal(copy.byteOffset, 8);
    assert.equal(copy.length, 2);
    assert.deepEqual(Array.from(new Uint8Array(copy.buffer)), expected);
    new Uint8Array(copy.buffer)[0] = 99;
    new Uint8Array(copy.buffer)[31] = 55;
    assert.deepEqual(Array.from(bytes), expected, 'bytes outside the visible subview must also be isolated');
  });

  test(`${method} preserves non-index numeric-looking typed-array keys while copying indexed bytes`, () => {
    const source = new Uint8Array([3, 7]),
      child = { n: 1 };
    for (const key of ['01', '+0', '1e0', ' 0', '1.0'])
      Object.defineProperty(source, key, { value: child, enumerable: false });
    const copy = O[method](source, { unsupported: 'throw' });
    assert.deepEqual(Array.from(copy), [3, 7]);
    assert.deepEqual(Reflect.ownKeys(copy), Reflect.ownKeys(source));
    for (const key of ['01', '+0', '1e0', ' 0', '1.0']) {
      assert.equal(copy[key], copy['01']);
      assert.equal(copy[key] === child, method === 'clone');
      assert.equal(Object.getOwnPropertyDescriptor(copy, key).writable, false);
    }
  });

  test(`${method} copies buffer metadata and view bounds without following accessor values`, () => {
    const buffer = new ArrayBuffer(16),
      view = new DataView(buffer, 4, 6),
      child = { view };
    let gets = 0;
    Object.defineProperty(buffer, 'child', { value: child, enumerable: false });
    Object.defineProperty(buffer, 'computed', {
      get() {
        gets++;
        throw new Error('accessor value not part of graph');
      }
    });
    Object.preventExtensions(buffer);
    const copy = O[method](view, { unsupported: 'throw' });
    assert.notEqual(copy.buffer, buffer);
    assert.equal(copy.byteOffset, 4);
    assert.equal(copy.byteLength, 6);
    assert.equal(Object.isExtensible(copy.buffer), false);
    assert.equal(copy.buffer.child === child, method === 'clone');
    assert.equal(copy.buffer.child.view, method === 'clone' ? view : copy);
    assert.equal(Object.getOwnPropertyDescriptor(copy.buffer, 'child').enumerable, false);
    assert.equal(
      Object.getOwnPropertyDescriptor(copy.buffer, 'computed').get,
      Object.getOwnPropertyDescriptor(buffer, 'computed').get
    );
    assert.equal(gets, 0);
  });

  test(`${method} propagates descriptor failures and does not reuse a partial copy in later calls`, () => {
    const error = new Error('descriptor lookup failed'),
      target = { first: { n: 1 }, later: { n: 2 } };
    let failing = true;
    const input = new Proxy(target, {
      getOwnPropertyDescriptor(object, key) {
        if (key === 'later' && failing) throw error;
        return Reflect.getOwnPropertyDescriptor(object, key);
      }
    });
    assert.throws(
      () => O[method](input),
      (thrown) => thrown === error
    );
    assert.equal(target.first.n, 1);
    assert.equal(target.later.n, 2);
    failing = false;
    const copy = O[method](input);
    assert.notEqual(copy, input);
    assert.deepEqual(copy, target);
    assert.equal(copy.first === target.first, method === 'clone');
    assert.equal(copy.later === target.later, method === 'clone');
  });

  test(`${method} skips a disappeared own property without reading or resurrecting its value`, () => {
    const source = { first: 1, gone: 2 };
    let gets = 0;
    const input = new Proxy(source, {
      getOwnPropertyDescriptor(object, key) {
        if (key === 'first') delete object.gone;
        return Reflect.getOwnPropertyDescriptor(object, key);
      },
      get() {
        gets++;
        throw new Error('cloning should use descriptors');
      }
    });
    const copy = O[method](input);
    assert.deepEqual(copy, { first: 1 });
    assert.equal(Object.hasOwn(copy, 'gone'), false);
    assert.equal(gets, 0);
  });
}

test('deepClone reconnects two backing buffers, multiple views and metadata cycles from a view root', () => {
  const first = new ArrayBuffer(24),
    second = new ArrayBuffer(24),
    root = new Uint8Array(first, 4, 8),
    peer = new DataView(second, 2, 8);
  first.peer = second;
  second.peer = first;
  first.view = root;
  second.view = peer;
  root.peer = peer;
  peer.root = root;
  Object.defineProperty(second, 'hidden', { value: root });
  new Uint8Array(first).fill(3);
  new Uint8Array(second).fill(7);
  const copy = O.deepClone(root, { unsupported: 'throw' });
  assert.notEqual(copy, root);
  assert.notEqual(copy.buffer, first);
  assert.notEqual(copy.peer.buffer, second);
  assert.equal(copy.buffer.peer, copy.peer.buffer);
  assert.equal(copy.peer.buffer.peer, copy.buffer);
  assert.equal(copy.buffer.view, copy);
  assert.equal(copy.peer.buffer.view, copy.peer);
  assert.equal(copy.peer.root, copy);
  assert.equal(copy.peer.buffer.hidden, copy);
  copy[0] = 99;
  copy.peer.setUint8(0, 88);
  assert.equal(root[0], 3);
  assert.equal(peer.getUint8(0), 7);
});

test('deepClone never coalesces equal buffers, equal views or equal record nodes', () => {
  const a = new Uint8Array([1, 2]),
    b = new Uint8Array([1, 2]),
    first = { n: 1 },
    second = { n: 1 };
  const copy = O.deepClone({ a, b, first, second, again: a, sharedView: new Uint8Array(a.buffer) });
  assert.notEqual(copy.a, copy.b);
  assert.notEqual(copy.a.buffer, copy.b.buffer);
  assert.notEqual(copy.first, copy.second);
  assert.equal(copy.again, copy.a);
  assert.notEqual(copy.sharedView, copy.a);
  assert.equal(copy.sharedView.buffer, copy.a.buffer);
  copy.a[0] = 9;
  assert.equal(copy.sharedView[0], 9);
  assert.equal(copy.b[0], 1);
  assert.equal(a[0], 1);
});

test('deepClone preserves one identity through Map keys, Set members, RegExp state and descriptors', () => {
  const root = {},
    symbol = Symbol('hidden'),
    item = Object.create(null),
    map = new Map(),
    set = new Set(),
    regex = /graph/g;
  Object.defineProperty(root, symbol, { value: item });
  Object.assign(root, { map, set, regex });
  item.root = root;
  item.map = map;
  item.set = set;
  regex.lastIndex = item;
  map.set(item, set);
  map.set(map, root);
  set.add(item);
  set.add(map);
  set.add(set);
  for (const value of [root, item, map, set, regex]) Object.freeze(value);
  const copy = O.deepClone(root, { unsupported: 'throw' });
  assert.equal(copy.regex.lastIndex, copy[symbol]);
  assert.equal(copy.map.get(copy[symbol]), copy.set);
  assert.equal(copy.map.get(copy.map), copy);
  assert.equal(copy.set.has(copy[symbol]), true);
  assert.equal(copy.set.has(copy.map), true);
  assert.equal(copy.set.has(copy.set), true);
  assert.equal(copy[symbol].root, copy);
  assert.equal(copy[symbol].map, copy.map);
  assert.equal(copy[symbol].set, copy.set);
  for (const value of [copy, copy[symbol], copy.map, copy.set, copy.regex]) assert.equal(Object.isFrozen(value), true);
  assert.equal(Object.getPrototypeOf(copy[symbol]), null);
});

test('deepClone preserves raw mixed Buffer, BigInt and DataView bytes even when the Buffer is encountered first', () => {
  const backing = new ArrayBuffer(32),
    node = Buffer.from(backing, 8, 12),
    big = new BigUint64Array(backing, 8, 2),
    view = new DataView(backing, 4, 24);
  new Uint8Array(backing).fill(0x96);
  node.owner = backing;
  const source = new Map([[node, { node, big, view, backing }]]);
  const copy = O.deepClone(source, { unsupported: 'throw' });
  const [[key, value]] = [...copy];
  assert.equal(Buffer.isBuffer(key), true);
  assert.equal(value.node, key);
  assert.equal(key.owner, value.backing);
  assert.equal(key.buffer, value.backing);
  assert.equal(value.big.buffer, value.backing);
  assert.equal(value.view.buffer, value.backing);
  assert.notEqual(value.backing, backing);
  assert.deepEqual([...new Uint8Array(value.backing)], [...new Uint8Array(backing)]);
  value.big[0] = 0n;
  assert.equal(key[0], 0);
  assert.equal(node[0], 0x96);
});

test('deepClone joins cross-realm buffer/view descriptors to local Map and Set references', () => {
  const foreign = vm.runInNewContext(`(() => {
    const buffer = new ArrayBuffer(16), view = new DataView(buffer, 4, 8), root = {buffer, view};
    buffer.root = root; view.root = root;
    Object.defineProperty(root, 'hidden', {value: view});
    Object.preventExtensions(root);
    return root;
  })()`);
  const root = { foreign, map: new Map([[foreign.view, foreign.buffer]]), set: new Set([foreign, foreign.view]) };
  const copy = O.deepClone(root, { unsupported: 'throw' });
  assert.equal(copy.foreign.view.buffer, copy.foreign.buffer);
  assert.equal(copy.foreign.buffer.root, copy.foreign);
  assert.equal(copy.foreign.hidden, copy.foreign.view);
  assert.equal(copy.foreign.view.root, copy.foreign);
  assert.equal(copy.map.get(copy.foreign.view), copy.foreign.buffer);
  assert.equal(copy.set.has(copy.foreign), true);
  assert.equal(copy.set.has(copy.foreign.view), true);
  assert.equal(Object.isExtensible(copy.foreign), false);
  assert.equal(Object.getPrototypeOf(copy.foreign), Object.getPrototypeOf(foreign));
  assert.notEqual(copy.foreign.buffer, foreign.buffer);
});

test('deepClone connects native Error stack-hook results into the same copied graph', () => {
  const previous = Object.getOwnPropertyDescriptor(Error, 'prepareStackTrace');
  const source = new Error('structured stack');
  const shared = { source };
  source.cause = shared;
  let calls = 0;
  try {
    Error.prepareStackTrace = () => {
      calls++;
      return shared;
    };
    const copy = O.deepClone({ source, shared });
    assert.equal(calls, 1);
    assert.equal(copy.source.stack, copy.shared);
    assert.equal(copy.source.cause, copy.shared);
    assert.equal(copy.shared.source, copy.source);
    assert.notEqual(copy.shared, shared);
    assert.equal(source.stack, shared, 'native materialisation is an intentional source-side observation');
  } finally {
    if (previous) Object.defineProperty(Error, 'prepareStackTrace', previous);
    else delete Error.prepareStackTrace;
  }
});

test('deepClone keeps reentrant stack-hook cloning in a separate graph context', () => {
  const previous = Object.getOwnPropertyDescriptor(Error, 'prepareStackTrace');
  const shared = { n: 1 };
  shared.self = shared;
  const error = new Error('reentrant');
  let nested;
  try {
    Error.prepareStackTrace = () => {
      nested = O.deepClone(shared);
      return 'stack';
    };
    const copy = O.deepClone({ shared, error });
    assert.equal(copy.error.stack, 'stack');
    assert.notEqual(nested, shared);
    assert.notEqual(nested, copy.shared);
    assert.equal(nested.self, nested);
    assert.equal(copy.shared.self, copy.shared);
  } finally {
    if (previous) Object.defineProperty(Error, 'prepareStackTrace', previous);
    else delete Error.prepareStackTrace;
  }
});

test('deepClone copies non-enumerable AggregateError lists with shared causes and opaque leaves', () => {
  const opaque = () => 1,
    shared = { opaque },
    error = new AggregateError([shared, shared], 'many', { cause: shared });
  delete error.stack; // The contract tested here is descriptor/entry identity, not stack preparation.
  error.errors.push(error);
  const copy = O.deepClone(error);
  assert.equal(copy.cause, copy.errors[0]);
  assert.equal(copy.errors[0], copy.errors[1]);
  assert.equal(copy.errors[2], copy);
  assert.equal(copy.cause.opaque, opaque);
  assert.equal(Object.hasOwn(copy, 'stack'), false);
  assert.equal(Object.getOwnPropertyDescriptor(copy, 'errors').enumerable, false);
  assert.throws(() => O.deepClone(error, { unsupported: 'throw' }), TypeError);
  const shallow = O.clone(error, { unsupported: 'throw' });
  assert.equal(shallow.errors, error.errors);
  assert.equal(shallow.cause, shared);
});

test('deepClone contains failures in a hidden child and can retry without stale shells', () => {
  const failure = new Error('child keys');
  let fail = true;
  const child = new Proxy(
    { n: 1 },
    {
      ownKeys(target) {
        if (fail) throw failure;
        return Reflect.ownKeys(target);
      }
    }
  );
  const root = {};
  Object.defineProperty(root, 'child', { value: child });
  assert.throws(
    () => O.deepClone(root),
    (error) => error === failure
  );
  assert.equal(root.child, child);
  fail = false;
  const first = O.deepClone(root),
    second = O.deepClone(root);
  assert.notEqual(first.child, child);
  assert.notEqual(first.child, second.child);
  assert.equal(first.child.n, 1);
  assert.equal(Object.getOwnPropertyDescriptor(first, 'child').writable, false);
});

test('deepClone keeps opaque internals unexpanded even when another path copies the same child', () => {
  const child = { n: 1 };
  class Opaque {
    constructor() {
      this.child = child;
    }
  }
  const opaque = new Opaque(),
    source = { child, opaque, again: opaque },
    copy = O.deepClone(source);
  assert.notEqual(copy.child, child);
  assert.equal(copy.opaque, opaque);
  assert.equal(copy.again, opaque);
  assert.equal(copy.opaque.child, child);
  copy.child.n = 2;
  assert.equal(opaque.child.n, 1);
});

test('deepClone handles a deep alternating Map/Set chain iteratively and closes its back-reference', () => {
  const depth = 12000,
    root = new Map();
  let tail = root;
  for (let index = 0; index < depth; index++) {
    const next = index % 2 ? new Map() : new Set();
    if (tail instanceof Map) tail.set('next', next);
    else tail.add(next);
    tail = next;
  }
  if (tail instanceof Map) tail.set('root', root);
  else tail.add(root);
  const copy = O.deepClone(root, { unsupported: 'throw' });
  let original = root,
    current = copy;
  for (let index = 0; index < depth; index++) {
    assert.ok(current !== original, 'each chain container must be independent');
    const map = original instanceof Map;
    original = map ? original.get('next') : original.values().next().value;
    current = map ? current.get('next') : current.values().next().value;
  }
  assert.ok(current !== original, 'the terminal chain container must be independent');
  const backReference = current instanceof Map ? current.get('root') : current.values().next().value;
  assert.ok(backReference === copy, 'terminal cycle must close onto the copy');
});

test('deepClone preserves wide distinct nodes and shared metadata without leaking mutable sources', () => {
  const meta = { n: 1 },
    nodes = Array.from({ length: 2000 }, (_, id) => ({ id, meta })),
    root = { nodes, meta, keys: new Map(nodes.map((node) => [node, meta])) };
  meta.root = root;
  const copy = O.deepClone(root);
  assert.equal(new Set(copy.nodes).size, nodes.length);
  // Keep failures bounded: formatting this entire cyclic graph can exhaust the test worker.
  assert.ok(copy.meta.root === copy, 'shared metadata must point to the copied root');
  for (let index = 0; index < nodes.length; index++) {
    const item = copy.nodes[index];
    assert.ok(item !== nodes[index], 'wide node ' + index + ' must be independent');
    assert.equal(item.id, index);
    assert.ok(item.meta === copy.meta, 'wide node ' + index + ' must share cloned metadata');
    assert.ok(copy.keys.get(item) === copy.meta, 'Map key ' + index + ' must be the cloned node');
    assert.equal(copy.keys.has(nodes[index]), false);
  }
  copy.meta.n = 2;
  assert.equal(meta.n, 1);
});
