'use strict';
// immutable engine boundaries; parser algorithms and broad type inference have other owners.
// These assert observable results/ownership, not the exact internal copy sequence.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const O = require('..');
const methods = ['setImmutable', 'updateImmutable', 'unsetImmutable'];

function invoke(method, input, path, replacement = 7) {
  if (method === 'unsetImmutable') return O[method](input, path);
  if (method === 'updateImmutable') return O[method](input, path, () => replacement);
  return O[method](input, path, replacement);
}

for (const method of methods) {
  test(method + ' retains each prototype in a frozen mixed-realm/null-prototype spine', () => {
    const root = vm.runInNewContext('({})');
    const rows = vm.runInNewContext('new Array(3)');
    const field = Symbol('field');
    const stable = Object.freeze({ id: 'stable' });
    const item = Object.create(null);
    Object.defineProperty(item, field, { value: 1, enumerable: false });
    Object.defineProperty(item, 'stable', { value: stable, enumerable: true });
    Object.defineProperty(rows, '1', { value: item, enumerable: false });
    Object.defineProperty(root, 'rows', { value: rows, enumerable: false });
    Object.defineProperty(root, 'alias', { value: item, enumerable: true });
    for (const value of [root, rows, item]) Object.freeze(value);
    const originals = [root, rows, item];
    const before = originals.map((value) => Object.getOwnPropertyDescriptors(value));

    const result = invoke(method, root, ['rows', 1, field]);
    const copies = [result, result.rows, result.rows[1]];
    for (let index = 0; index < originals.length; index++) {
      assert.notEqual(copies[index], originals[index]);
      assert.equal(Object.getPrototypeOf(copies[index]), Object.getPrototypeOf(originals[index]));
      assert.deepEqual(Object.getOwnPropertyDescriptors(originals[index]), before[index]);
      assert.equal(Object.isExtensible(copies[index]), true);
    }
    assert.equal(result.alias, item);
    assert.equal(result.rows[1].stable, stable);
    assert.equal(result.rows.length, 3);
    assert.equal(Object.hasOwn(result.rows, '0'), false);
    assert.equal(Object.hasOwn(result.rows, '2'), false);
    for (const [parent, key] of [
      [result, 'rows'],
      [result.rows, '1']
    ]) {
      const descriptor = Object.getOwnPropertyDescriptor(parent, key);
      assert.equal(descriptor.enumerable, false);
      assert.equal(descriptor.writable, true);
      assert.equal(descriptor.configurable, true);
    }
    const descriptor = Object.getOwnPropertyDescriptor(result.rows[1], field);
    if (method === 'unsetImmutable') assert.equal(descriptor, undefined);
    else assert.deepEqual(descriptor, { value: 7, enumerable: false, writable: true, configurable: true });
  });

  test(method + ' copies constructor accessors and prototype-named off-path data without invoking them', () => {
    const input = { value: 1 };
    const prototypeData = Object.freeze({ marker: 'own data' });
    let calls = 0;
    const getConstructor = () => {
      calls++;
      throw new Error('constructor must not be read');
    };
    Object.defineProperty(input, 'constructor', { get: getConstructor, configurable: false });
    Object.defineProperty(input, '__proto__', { value: prototypeData, enumerable: true });
    const result = invoke(method, input, ['value']);
    assert.equal(calls, 0);
    assert.equal(Object.getPrototypeOf(result), Object.prototype);
    assert.deepEqual(
      Object.getOwnPropertyDescriptor(result, 'constructor'),
      Object.getOwnPropertyDescriptor(input, 'constructor')
    );
    assert.deepEqual(Object.getOwnPropertyDescriptor(result, '__proto__'), {
      value: prototypeData,
      enumerable: true,
      writable: true,
      configurable: true
    });
    assert.equal(Object.getPrototypeOf(input), Object.prototype);
    assert.equal(input.value, 1);
  });

  test(method + ' allows an unsupported instance as the terminal value without traversing it', () => {
    class Payload {
      constructor() {
        this.n = 1;
      }
    }
    const payload = Object.freeze(new Payload());
    const input = Object.freeze({ value: payload, alias: payload });
    let calls = 0;
    const result =
      method === 'updateImmutable'
        ? O.updateImmutable(input, 'value', (current) => {
            calls++;
            assert.equal(current, payload);
            return 7;
          })
        : invoke(method, input, 'value');
    assert.equal(calls, method === 'updateImmutable' ? 1 : 0);
    assert.equal(Object.hasOwn(result, 'value'), method !== 'unsetImmutable');
    if (method !== 'unsetImmutable') assert.equal(result.value, 7);
    assert.equal(result.alias, payload);
    assert.equal(input.value, payload);
    assert.equal(payload.n, 1);
  });

  test(method + ' leaves every original intact if an ancestor copy fails after visiting the child', () => {
    const failure = new Error('ancestor reflection');
    const child = Object.freeze({ value: 1, sibling: Object.freeze({ id: 1 }) });
    const target = Object.freeze({ child });
    const before = Object.getOwnPropertyDescriptors(target);
    let writes = 0;
    const source = new Proxy(target, {
      ownKeys() {
        throw failure;
      },
      set() {
        writes++;
        throw new Error('input write');
      },
      defineProperty() {
        writes++;
        throw new Error('input definition');
      },
      deleteProperty() {
        writes++;
        throw new Error('input deletion');
      }
    });
    assert.throws(
      () => invoke(method, source, ['child', 'value']),
      (error) => error === failure
    );
    assert.equal(writes, 0);
    assert.deepEqual(Object.getOwnPropertyDescriptors(target), before);
    assert.deepEqual(child, { value: 1, sibling: { id: 1 } });
  });

  test(method + ' handles the largest array index without treating an adjacent ordinary key as an index', () => {
    const input = [];
    Object.defineProperty(input, '4294967294', { value: 1, enumerable: false });
    input['4294967295'] = 'ordinary key';
    Object.freeze(input);
    const result = invoke(method, input, [4294967294]);
    assert.equal(Array.isArray(result), true);
    assert.equal(result.length, 4294967295);
    assert.equal(input.length, 4294967295);
    assert.equal(result['4294967295'], 'ordinary key');
    assert.equal(Object.hasOwn(result, '4294967293'), false);
    assert.equal(Object.hasOwn(result, '4294967294'), method !== 'unsetImmutable');
    if (method !== 'unsetImmutable') assert.equal(result['4294967294'], 7);
    assert.equal(input['4294967294'], 1);
    assert.equal(Object.getOwnPropertyDescriptor(input, 'length').writable, false);
    assert.equal(Object.getOwnPropertyDescriptor(result, 'length').writable, true);
  });

  test(method + ' rejects the complete path before reflecting on the input or invoking callbacks', () => {
    let reflections = 0,
      callbacks = 0;
    const source = new Proxy(
      {},
      {
        getPrototypeOf() {
          reflections++;
          throw new Error('input reflected too soon');
        }
      }
    );
    for (const path of [['missing', 'constructor', 'x'], ['missing', {}], []]) {
      assert.throws(
        () => O[method](source, path, method === 'updateImmutable' ? () => ++callbacks : 7),
        path.length === 0 ? RangeError : TypeError
      );
    }
    assert.equal(reflections, 0);
    assert.equal(callbacks, 0);
  });
}

test('inherited array-index accessors are not consulted when setting a missing own branch', () => {
  const context = vm.createContext({});
  const source = vm.runInContext(
    `
    globalThis.calls = 0;
    Object.defineProperty(Array.prototype, '0', {
      get() { calls++; throw Error('inherited getter'); },
      set(_) { calls++; throw Error('inherited setter'); }, configurable: true
    });
    new Array(2);
  `,
    context
  );
  for (const method of ['setImmutable', 'updateImmutable']) {
    const result = invoke(method, source, [0, 'value']);
    assert.equal(result[0].value, 7);
    assert.equal(Object.getPrototypeOf(result), Object.getPrototypeOf(source));
    assert.equal(result.length, 2);
    assert.equal(Object.hasOwn(result, '1'), false);
  }
  assert.equal(O.unsetImmutable(source, [0, 'value']), source);
  assert.equal(vm.runInContext('calls', context), 0);
  assert.equal(Object.hasOwn(source, '0'), false);
});

test('updater receives exactly one observed value and is called once for a new branch', () => {
  const input = Object.freeze({ branch: undefined });
  let calls = 0;
  const result = O.updateImmutable(input, ['branch', 1, 'value'], function (previous) {
    calls++;
    assert.equal(arguments.length, 1);
    assert.equal(previous, undefined);
    return 7;
  });
  assert.equal(calls, 1);
  assert.equal(input.branch, undefined);
  assert.equal(Array.isArray(result.branch), true);
  assert.equal(result.branch.length, 2);
  assert.equal(Object.hasOwn(result.branch, '0'), false);
  assert.equal(result.branch[1].value, 7);
});

test('reentrant immutable updates and caller path edits cannot redirect an active operation', () => {
  const input = Object.freeze({ branch: Object.freeze({ value: 1 }), stable: Object.freeze({ id: 2 }) });
  const path = ['branch', 'value'];
  let nested,
    calls = 0;
  const result = O.updateImmutable(input, path, (previous) => {
    calls++;
    path.splice(0, path.length, 'stable', 'id');
    nested = O.updateImmutable(input, path, (n) => n + 10);
    return previous + 1;
  });
  assert.equal(calls, 1);
  assert.equal(result.branch.value, 2);
  assert.equal(result.stable, input.stable);
  assert.equal(nested.branch, input.branch);
  assert.equal(nested.stable.id, 12);
  assert.equal(input.branch.value, 1);
  assert.equal(input.stable.id, 2);
});

test('returned thenables are stored without reading then or awaiting them', () => {
  let reads = 0;
  const thenable = Object.defineProperty({}, 'then', {
    get() {
      reads++;
      throw new Error('then must not be read');
    }
  });
  const source = Object.freeze({ field: 1 });
  const updated = O.updateImmutable(source, 'field', () => thenable);
  const set = O.setImmutable(source, 'field', thenable);
  assert.equal(updated.field, thenable);
  assert.equal(set.field, thenable);
  assert.equal(reads, 0);
  assert.equal(source.field, 1);
});

test('throwing updaters retain non-extensible undefined parents without attaching missing containers', () => {
  const source = Object.create(null);
  Object.defineProperty(source, 'branch', { value: undefined, enumerable: false });
  Object.preventExtensions(source);
  const before = Object.getOwnPropertyDescriptors(source);
  const failure = new Error('updater');
  assert.throws(
    () =>
      O.updateImmutable(source, ['branch', 0, 'value'], () => {
        throw failure;
      }),
    (error) => error === failure
  );
  assert.deepEqual(Object.getOwnPropertyDescriptors(source), before);
  assert.equal(Object.getPrototypeOf(source), null);
  assert.equal(Object.isExtensible(source), false);
});

test('unchanged immutable updates return the original even when enumeration would throw', () => {
  const value = new Map([['key', 1]]);
  const source = new Proxy(Object.freeze({ value }), {
    ownKeys() {
      throw new Error('a no-op must not copy');
    }
  });
  let calls = 0;
  const result = O.updateImmutable(source, 'value', (previous) => {
    calls++;
    assert.equal(previous, value);
    return previous;
  });
  assert.equal(result, source);
  assert.equal(calls, 1);
});

test('a callback can freeze the original without preventing a separate structural copy', () => {
  const source = { branch: { value: 1 }, stable: {} };
  const result = O.updateImmutable(source, ['branch', 'value'], (value) => {
    Object.freeze(source.branch);
    Object.freeze(source);
    return value + 1;
  });
  assert.equal(Object.isFrozen(source), true); // Callback effects are not rolled back.
  assert.equal(source.branch.value, 1);
  assert.equal(result.branch.value, 2);
  assert.equal(result.stable, source.stable);
  assert.equal(Object.isFrozen(result.branch), false);
});

test('finite cyclic deletion copies each addressed occurrence without retargeting unrelated aliases', () => {
  const root = { value: 1 };
  root.self = root;
  Object.freeze(root);
  const result = O.unsetImmutable(root, ['self', 'self', 'value']);
  assert.notEqual(result, root);
  assert.notEqual(result.self, root);
  assert.notEqual(result.self.self, root);
  assert.notEqual(result.self, result.self.self);
  assert.equal(result.value, 1);
  assert.equal(result.self.value, 1);
  assert.equal(Object.hasOwn(result.self.self, 'value'), false);
  assert.equal(result.self.self.self, root);
  assert.equal(root.self, root);
  assert.equal(root.value, 1);
});

test('immutable array copying does not consult an own constructor or species accessor', () => {
  let reads = 0;
  const input = [1, 2];
  const getConstructor = () => {
    reads++;
    throw new Error('own constructor read');
  };
  Object.defineProperty(input, 'constructor', { get: getConstructor });
  Object.defineProperty(input, Symbol.species, {
    get() {
      reads++;
      throw new Error('own species read');
    }
  });
  for (const method of methods) {
    const result = invoke(method, input, [0]);
    assert.equal(Array.isArray(result), true);
    assert.equal(result.length, 2);
    assert.deepEqual(
      Object.getOwnPropertyDescriptor(result, 'constructor'),
      Object.getOwnPropertyDescriptor(input, 'constructor')
    );
    assert.deepEqual(
      Object.getOwnPropertyDescriptor(result, Symbol.species),
      Object.getOwnPropertyDescriptor(input, Symbol.species)
    );
  }
  assert.equal(reads, 0);
  assert.equal(input[0], 1);
});

test('record length keys remain ordinary data while array length paths are rejected before the updater', () => {
  const source = Object.freeze({ length: Object.freeze({ value: 1 }) });
  const result = O.updateImmutable(source, ['length', 'value'], (n) => n + 1);
  assert.equal(result.length.value, 2);
  assert.equal(source.length.value, 1);
  assert.equal(O.setImmutable({}, ['length'], 0).length, 0);
  assert.equal(Object.hasOwn(O.unsetImmutable(source, 'length'), 'length'), false);
  let calls = 0;
  assert.throws(() => O.updateImmutable({ rows: [] }, ['rows', 'length', 'value'], () => ++calls), TypeError);
  assert.equal(calls, 0);
});

test('only canonical array indexes cause missing ancestors to become arrays', () => {
  const symbol = Symbol('entry');
  for (const [key, arrayExpected] of [
    [0, true],
    ['0', true],
    ['01', false],
    ['-0', false],
    [4294967295, false],
    [symbol, false]
  ]) {
    const source = Object.freeze({});
    const result = O.updateImmutable(source, ['entries', key, 'value'], () => 7);
    assert.equal(Array.isArray(result.entries), arrayExpected);
    assert.equal(result.entries[key].value, 7);
    assert.equal(Object.hasOwn(source, 'entries'), false);
  }
});

test('copied off-path accessors preserve their descriptor and use the result as receiver', () => {
  let calls = 0;
  const source = { value: 1 };
  Object.defineProperty(source, 'mirror', {
    get() {
      calls++;
      return this.value;
    },
    enumerable: false,
    configurable: false
  });
  Object.freeze(source);
  for (const method of methods) {
    const before = calls;
    const result = invoke(method, source, 'value');
    assert.equal(calls, before);
    assert.deepEqual(
      Object.getOwnPropertyDescriptor(result, 'mirror'),
      Object.getOwnPropertyDescriptor(source, 'mirror')
    );
    assert.equal(result.mirror, method === 'unsetImmutable' ? undefined : 7);
    assert.equal(source.mirror, 1);
    assert.equal(calls, before + 2);
  }
});
