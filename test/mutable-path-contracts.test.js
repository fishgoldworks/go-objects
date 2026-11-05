'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const O = require('..');

const writers = {
  set: (object, path, value) => O.set(object, path, value),
  update: (object, path, value) => O.update(object, path, () => value),
  setEach: (object, path, value) => O.setEach(object, [path], value)
};

for (const [name, write] of Object.entries(writers)) {
  test(name + ' shadows inherited data and setter slots without reading or changing their owner', () => {
    let calls = 0;
    const inheritedChild = { n: 10 };
    const prototype = Object.create(null, {
      child: { value: inheritedChild, writable: false },
      selected: {
        get() {
          calls++;
          throw new Error('inherited getter');
        },
        set() {
          calls++;
          throw new Error('inherited setter');
        }
      }
    });
    const object = Object.create(prototype);
    write(object, 'child.n', 7);
    write(object, 'selected', 9);
    assert.equal(calls, 0);
    assert.deepEqual(inheritedChild, { n: 10 });
    assert.notEqual(object.child, inheritedChild);
    assert.deepEqual(Object.getOwnPropertyDescriptor(object, 'selected'), {
      value: 9,
      writable: true,
      enumerable: true,
      configurable: true
    });
  });

  test(name + ' preserves the descriptor of an undefined parent when creating its child', () => {
    const object = {};
    Object.defineProperty(object, 'child', { value: undefined, writable: true });
    Object.preventExtensions(object);
    write(object, 'child.n', 3);
    assert.deepEqual(Object.getOwnPropertyDescriptor(object, 'child'), {
      value: { n: 3 },
      writable: true,
      configurable: false,
      enumerable: false
    });
    assert.equal(Object.isExtensible(object), false);
  });

  test(name + ' follows finite own paths through cycles without changing alias identity', () => {
    const child = { n: 1 };
    const object = { child, alias: child };
    child.parent = object;
    write(object, ['child', 'parent', 'alias', 'n'], 8);
    assert.equal(object.child, child);
    assert.equal(object.alias, child);
    assert.equal(child.parent, object);
    assert.equal(child.n, 8);
  });

  test(name + ' uses descriptors rather than target get or set traps for ordinary data', () => {
    const target = { n: 1 };
    const object = new Proxy(target, {
      get() {
        throw new Error('unexpected read');
      },
      set() {
        throw new Error('unexpected assignment');
      }
    });
    write(object, 'n', 4);
    assert.equal(target.n, 4);
    write(object, ['child', 'n'], 6);
    assert.deepEqual(target.child, { n: 6 });
  });
}

for (const name of ['set', 'update', 'setEach', 'unset']) {
  test(name + ' rejects a decoded unsafe segment before target reflection or updater execution', () => {
    let traps = 0;
    const object = new Proxy(
      {},
      {
        getOwnPropertyDescriptor() {
          traps++;
          throw new Error('target read');
        },
        defineProperty() {
          traps++;
          throw new Error('target write');
        },
        deleteProperty() {
          traps++;
          throw new Error('target delete');
        },
        isExtensible() {
          traps++;
          throw new Error('target extensibility');
        }
      }
    );
    const path = 'safe["\\u0063onstructor"].n';
    if (name === 'unset') assert.throws(() => O.unset(object, path), TypeError);
    else if (name === 'update') {
      assert.throws(
        () =>
          O.update(object, path, () => {
            traps++;
            return 1;
          }),
        TypeError
      );
    } else assert.throws(() => writers[name](object, path, 1), TypeError);
    assert.equal(traps, 0);
  });
}

for (const [label, change] of [
  [
    'null parent',
    (object) => {
      object.child = null;
    }
  ],
  [
    'function parent',
    (object) => {
      object.child = () => {};
    }
  ],
  [
    'primitive parent',
    (object) => {
      object.child = 3;
    }
  ],
  [
    'accessor parent',
    (object) => {
      Object.defineProperty(object, 'child', {
        get() {
          throw new Error('getter');
        }
      });
    }
  ]
]) {
  test('update revalidates an intermediate changed by its updater: ' + label, () => {
    const oldChild = { n: 1 };
    const object = { child: oldChild };
    let calls = 0;
    assert.throws(
      () =>
        O.update(object, 'child.n', (previous) => {
          calls++;
          assert.equal(previous, 1);
          change(object);
          return 2;
        }),
      TypeError
    );
    assert.equal(calls, 1);
    assert.equal(oldChild.n, 1);
  });
}

test('update returns the pre-callback observation while writing to a replacement branch', () => {
  const oldChild = { n: 1 };
  const object = { child: oldChild };
  const newChild = { n: 50 };
  assert.equal(
    O.update(object, 'child.n', (n) => {
      object.child = newChild;
      return n + 1;
    }),
    1
  );
  assert.equal(oldChild.n, 1);
  assert.equal(newChild.n, 2);
  assert.equal(object.child, newChild);
});

test('update rechecks descriptor flags changed by its updater without undoing callback effects', () => {
  const object = { n: 1 };
  assert.equal(
    O.update(object, 'n', (n) => {
      Object.defineProperty(object, 'n', { value: 40, enumerable: false, configurable: false });
      Object.preventExtensions(object);
      return n + 1;
    }),
    1
  );
  assert.deepEqual(Object.getOwnPropertyDescriptor(object, 'n'), {
    value: 2,
    writable: true,
    enumerable: false,
    configurable: false
  });
  assert.equal(Object.isExtensible(object), false);
});

test('update cannot attach a missing parent when its updater prevents extensions', () => {
  const object = {};
  let calls = 0;
  assert.throws(
    () =>
      O.update(object, 'child.n', (previous) => {
        calls++;
        assert.equal(previous, undefined);
        Object.preventExtensions(object);
        return 1;
      }),
    TypeError
  );
  assert.equal(calls, 1);
  assert.deepEqual(Reflect.ownKeys(object), []);
});

test('update passes exactly the observed value and stores a returned thenable without observing it', () => {
  const value = Object.create(null, {
    then: {
      get() {
        throw new Error('then read');
      }
    }
  });
  const object = { n: 1 };
  const calls = [];
  assert.equal(
    O.update(object, 'n', function () {
      calls.push(Array.from(arguments));
      return value;
    }),
    1
  );
  assert.deepEqual(calls, [[1]]);
  assert.equal(object.n, value);
});

test('setEach snapshots every path before a write trap can change pending path arrays', () => {
  const last = ['b'];
  const paths = ['a', last];
  const target = { a: 1, b: 2, wrong: 3 };
  const object = new Proxy(target, {
    defineProperty(value, key, descriptor) {
      if (key === 'a') {
        last[0] = '__proto__';
        paths[1] = 'wrong';
        paths.push('constructor');
      }
      return Reflect.defineProperty(value, key, descriptor);
    }
  });
  assert.deepEqual(O.setEach(object, paths, 8), [1, 2]);
  assert.deepEqual(target, { a: 8, b: 8, wrong: 3 });
});

test('setEach preserves shared replacement identity and sequential values across aliases', () => {
  const child = { n: 1 };
  const object = { left: child, right: child };
  const replacement = { data: true };
  assert.deepEqual(O.setEach(object, ['left.n', 'right.n', 'other'], replacement), [1, replacement, undefined]);
  assert.equal(object.left.n, replacement);
  assert.equal(object.right.n, replacement);
  assert.equal(object.other, replacement);
});

test('setEach exhausts custom list iterators before inspecting or mutating the target', () => {
  const events = [];
  const paths = [];
  paths[Symbol.iterator] = function* () {
    events.push('first');
    yield 'a';
    events.push('second');
    yield ['b'];
    events.push('done');
  };
  const target = {};
  const object = new Proxy(target, {
    defineProperty(value, key, descriptor) {
      events.push(key);
      return Reflect.defineProperty(value, key, descriptor);
    }
  });
  assert.deepEqual(O.setEach(object, paths, 7), [undefined, undefined]);
  assert.deepEqual(events, ['first', 'second', 'done', 'a', 'b']);
  assert.deepEqual(target, { a: 7, b: 7 });
});

test('setEach closes its custom iterator after invalid paths and does not start target writes', () => {
  const error = new Error('iterator cleanup');
  let closed = 0;
  const paths = [];
  paths[Symbol.iterator] = function* () {
    try {
      yield 'a';
      yield 'constructor';
    } finally {
      closed++;
      // eslint-disable-next-line no-unsafe-finally -- Verify that iterator cleanup cannot replace path validation failure.
      throw error;
    }
  };
  const object = {};
  assert.throws(() => O.setEach(object, paths, 1), TypeError);
  assert.equal(closed, 1);
  assert.deepEqual(object, {});
});

test('setEach preserves earlier writes on a later scalar-branch error but skips following paths', () => {
  const object = { a: 1, b: null, c: 3 };
  assert.throws(() => O.setEach(object, ['a', 'b.n', 'c'], 9), TypeError);
  assert.deepEqual(object, { a: 9, b: null, c: 3 });
});

test('unset skips inherited branches and deletes a cyclic own path without reading values', () => {
  const inherited = { n: 1 };
  const object = Object.create({ child: inherited });
  assert.equal(O.unset(object, 'child.n'), true);
  assert.equal(inherited.n, 1);
  object.self = object;
  Object.defineProperty(object, 'n', {
    configurable: true,
    get() {
      throw new Error('terminal read');
    }
  });
  assert.equal(O.unset(object, 'self.self.n'), true);
  assert.equal(Object.hasOwn(object, 'n'), false);
  assert.equal(object.self, object);
});

test('mutable paths preserve existing cross-realm and null-prototype containers', () => {
  const object = vm.runInNewContext('({ rows: [Object.create(null)] })');
  const prototypes = [Object.getPrototypeOf(object), Object.getPrototypeOf(object.rows)];
  const row = object.rows[0];
  O.set(object, ['rows', 0, 'n'], 1);
  assert.equal(
    O.update(object, ['rows', 0, 'n'], (n) => n + 1),
    1
  );
  assert.equal(O.unset(object, ['rows', 0, 'n']), true);
  assert.equal(Object.getPrototypeOf(object), prototypes[0]);
  assert.equal(Object.getPrototypeOf(object.rows), prototypes[1]);
  assert.equal(Object.getPrototypeOf(row), null);
  assert.equal(object.rows[0], row);
  assert.deepEqual(Reflect.ownKeys(row), []);
});

for (const [name, run, trap] of [
  ['set descriptor', (object) => O.set(object, 'n', 2), 'getOwnPropertyDescriptor'],
  ['update extensibility', (object) => O.update(object, 'absent', () => 2), 'isExtensible'],
  ['set definition', (object) => O.set(object, 'n', 2), 'defineProperty'],
  ['unset deletion', (object) => O.unset(object, 'n'), 'deleteProperty']
]) {
  test('mutable path error identity is retained: ' + name, () => {
    const error = new Error(name);
    const target = { n: 1 };
    const object = new Proxy(target, {
      [trap]() {
        throw error;
      }
    });
    assert.throws(
      () => run(object),
      (actual) => actual === error
    );
    assert.deepEqual(target, { n: 1 });
  });
}

test('mutable array length writes follow native grow and shrink rules', () => {
  const array = [1, 2, 3];
  assert.equal(O.set(array, 'length', 5), 3);
  assert.equal(array.length, 5);
  assert.equal(Object.hasOwn(array, 4), false);
  assert.equal(
    O.update(array, 'length', () => 1),
    5
  );
  assert.deepEqual(array, [1]);
  assert.throws(() => O.unset(array, 'length'), TypeError);
  assert.deepEqual(array, [1]);
});

test('array length validation can fail after an updater without promising transactionality', () => {
  const array = [1, 2];
  let calls = 0;
  assert.throws(
    () =>
      O.update(array, 'length', () => {
        calls++;
        return -1;
      }),
    RangeError
  );
  assert.equal(calls, 1);
  assert.deepEqual(array, [1, 2]);
  const blocked = [0, 1, 2, 3];
  Object.defineProperty(blocked, 1, { configurable: false });
  assert.throws(() => O.set(blocked, 'length', 0), TypeError);
  assert.equal(blocked.length, 2);
  assert.deepEqual(Object.keys(blocked), ['0', '1']);
});

test('typed-array writes preserve native value coercion and old-value returns', () => {
  const view = new Uint8Array([250]);
  assert.equal(O.set(view, 0, 260), 250);
  assert.equal(view[0], 4);
  assert.equal(
    O.update(view, 0, (previous) => previous + 256),
    4
  );
  assert.equal(view[0], 4);
  assert.throws(() => O.unset(view, 0), TypeError);
});

test('typed-array index restrictions can reject a write after the updater has run', () => {
  const view = new Uint8Array([1]);
  let calls = 0;
  assert.throws(
    () =>
      O.update(view, [2], (previous) => {
        calls++;
        assert.equal(previous, undefined);
        return 9;
      }),
    TypeError
  );
  assert.equal(calls, 1);
  assert.deepEqual(Array.from(view), [1]);
  assert.equal(Object.hasOwn(view, 2), false);
});

test('ordinary string keys on native views are not confused with reserved integer indexes', () => {
  const view = new Uint8Array([1]);
  const symbol = Symbol('value');
  O.set(view, '01', 9);
  O.set(view, symbol, 4);
  assert.equal(
    O.update(view, '01', (n) => n + 1),
    9
  );
  assert.equal(view['01'], 10);
  assert.equal(view[symbol], 4);
  assert.equal(O.unset(view, '01'), true);
  assert.equal(Object.hasOwn(view, '01'), false);
  assert.equal(view[0], 1);
});

test('readonly boxed string data is rejected before an updater while ordinary properties remain writable', () => {
  const boxed = Object('a');
  let calls = 0;
  assert.throws(
    () =>
      O.update(boxed, 0, () => {
        calls++;
        return 'b';
      }),
    TypeError
  );
  assert.equal(calls, 0);
  O.set(boxed, 'extra', 1);
  assert.equal(
    O.update(boxed, 'extra', (n) => n + 1),
    1
  );
  assert.equal(boxed.extra, 2);
});

test('native module namespaces can reject replacement after descriptor preflight', async () => {
  const namespace = await import('data:text/javascript,export const a04Value = 1');
  let calls = 0;
  assert.throws(
    () =>
      O.update(namespace, 'a04Value', (previous) => {
        calls++;
        assert.equal(previous, 1);
        return 2;
      }),
    TypeError
  );
  assert.equal(calls, 1);
  assert.equal(namespace.a04Value, 1);
  assert.equal(
    O.update(namespace, 'a04Value', (previous) => previous),
    1
  );
});
