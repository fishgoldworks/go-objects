'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const O = require('..');

// Expectations describe public results and mutation effects, not helper implementation.
const expectations = {
  count: [2, ['a', 'b', 'c'], { a: 1, b: 2, c: 1 }],
  some: [true, ['a'], { a: 1, b: 2, c: 1 }],
  every: [false, ['a', 'b'], { a: 1, b: 2, c: 1 }],
  find: [1, ['a'], { a: 1, b: 2, c: 1 }],
  findLast: [1, ['c'], { a: 1, b: 2, c: 1 }],
  findAll: [[1, 1], ['a', 'b', 'c'], { a: 1, b: 2, c: 1 }],
  findKey: ['a', ['a'], { a: 1, b: 2, c: 1 }],
  findEntry: [['a', 1], ['a'], { a: 1, b: 2, c: 1 }],
  remove: [1, ['a'], { b: 2, c: 1 }],
  removeLast: [1, ['c'], { a: 1, b: 2 }],
  removeAll: [[1, 1], ['a', 'b', 'c'], { b: 2 }],
  replace: [1, ['a'], { a: 7, b: 2, c: 1 }],
  replaceLast: [1, ['c'], { a: 1, b: 2, c: 7 }],
  replaceAll: [[1, 1], ['a', 'b', 'c'], { a: 7, b: 2, c: 7 }]
};
const replacementNames = ['replace', 'replaceLast', 'replaceAll'];
const variants = {
  'null-prototype callable': (callback) => Object.setPrototypeOf(callback, null),
  'shadowed call member': (callback) => Object.assign(callback, { call: () => false }),
  'throwing call accessor': (callback) =>
    Object.defineProperty(callback, 'call', {
      get() {
        throw new Error('unrelated call accessor');
      }
    }),
  'callable Proxy rejecting metadata reads': (callback) =>
    new Proxy(callback, {
      get() {
        throw new Error('unrelated function metadata');
      },
      apply(target, receiver, args) {
        return Reflect.apply(target, receiver, args);
      }
    })
};

function exercisePredicate(name, decorate) {
  const input = { a: 1, b: 2, c: 1 };
  const visited = [];
  const predicate = decorate(function (value, key, parent) {
    assert.equal(this, input);
    assert.equal(parent, input);
    assert.equal(arguments.length, 3);
    assert.equal(value, key === 'b' ? 2 : 1);
    visited.push(key);
    return value === 1;
  });
  const result = replacementNames.includes(name) ? O[name](input, predicate, 7) : O[name](input, predicate);
  const [expectedResult, expectedKeys, expectedInput] = expectations[name];
  assert.deepEqual(result, expectedResult);
  assert.deepEqual(visited, expectedKeys);
  assert.deepEqual(input, expectedInput);
}
function exerciseReplacement(name, decorate) {
  const input = { a: 1, b: 2, c: 1 };
  const visited = [];
  const replacement = decorate(function (value, key, parent) {
    assert.equal(this, input);
    assert.equal(parent, input);
    assert.equal(arguments.length, 3);
    assert.equal(value, 1);
    visited.push(key);
    return value + 6;
  });
  const [expectedResult, , expectedInput] = expectations[name];
  assert.deepEqual(O[name](input, 1, replacement), expectedResult);
  assert.deepEqual(visited, name === 'replaceAll' ? ['a', 'c'] : [name === 'replaceLast' ? 'c' : 'a']);
  assert.deepEqual(input, expectedInput);
}

for (const name of Object.keys(expectations)) {
  test(`${name}: ordinary predicate receiver, arguments, order, result and mutation control`, () => {
    exercisePredicate(name, (callback) => callback);
  });
  for (const [label, decorate] of Object.entries(variants)) {
    test(`${name}: predicate invokes the ${label} itself`, () => exercisePredicate(name, decorate));
  }
}
for (const name of replacementNames) {
  test(`${name}: ordinary replacement receiver, arguments and observed previous values`, () => {
    exerciseReplacement(name, (callback) => callback);
  });
  for (const [label, decorate] of Object.entries(variants)) {
    test(`${name}: replacement invokes the ${label} itself`, () => exerciseReplacement(name, decorate));
  }
}

test('bound matcher and replacement retain their bound receivers and leading arguments', () => {
  const context = { threshold: 2, delta: 10 };
  const input = { a: 1, b: 2, c: 3 };
  const predicate = function (prefix, value, key, parent) {
    assert.equal(this, context);
    assert.equal(prefix, 'match');
    assert.equal(parent, input);
    assert.equal(arguments.length, 4);
    assert.equal(input[key], value);
    return value >= this.threshold;
  }.bind(context, 'match');
  const replacement = function (prefix, value, key, parent) {
    assert.equal(this, context);
    assert.equal(prefix, 'write');
    assert.equal(parent, input);
    assert.equal(arguments.length, 4);
    assert.equal(input[key], value);
    return value + this.delta;
  }.bind(context, 'write');
  assert.deepEqual(O.replaceAll(input, predicate, replacement), [2, 3]);
  assert.deepEqual(input, { a: 1, b: 12, c: 13 });
});

for (const name of ['findAll', 'every', 'removeAll', 'replaceAll']) {
  test(`${name}: callable Proxy apply errors propagate by identity without later reads`, () => {
    const error = new Error('real invocation');
    let laterReads = 0;
    const input = {
      a: 1,
      get b() {
        laterReads++;
        return 2;
      }
    };
    const predicate = new Proxy(() => true, {
      apply() {
        throw error;
      }
    });
    assert.throws(
      () => (name === 'replaceAll' ? O[name](input, predicate, 7) : O[name](input, predicate)),
      (actual) => actual === error
    );
    assert.equal(laterReads, 0);
    assert.equal(input.a, 1);
  });
}

test('matcher and replacement thenables remain synchronous results and stored references', () => {
  let reads = 0;
  const token = {
    get then() {
      reads++;
      throw new Error('must not assimilate');
    }
  };
  const input = { a: 0, b: false };
  assert.equal(
    O.count(input, () => token),
    2
  );
  assert.equal(
    O.some(input, () => token),
    true
  );
  assert.equal(
    O.every(input, () => token),
    true
  );
  assert.deepEqual(
    O.findEntry(input, () => token),
    ['a', 0]
  );
  assert.deepEqual(
    O.replaceAll(
      input,
      () => token,
      () => token
    ),
    [0, false]
  );
  assert.equal(input.a, token);
  assert.equal(input.b, token);
  assert.equal(reads, 0);
});

test('search captures one getter value even when the predicate deletes and replaces that property', () => {
  let reads = 0;
  const input = {};
  const observed = { state: 'original' };
  Object.defineProperty(input, 'a', {
    enumerable: true,
    configurable: true,
    get() {
      reads++;
      return observed;
    }
  });
  const predicate = Object.setPrototypeOf((value) => {
    delete input.a;
    input.a = { state: 'changed' };
    return value === observed;
  }, null);
  const entry = O.findEntry(input, predicate);
  assert.equal(entry[1], observed);
  assert.equal(entry[0], 'a');
  assert.equal(reads, 1);
  assert.notEqual(input.a, observed);
});

test('reverse first-match mutations stop at the last symbol before reading earlier string getters', () => {
  for (const name of ['removeLast', 'replaceLast']) {
    const first = Symbol('first');
    const last = Symbol('last');
    const input = {
      get a() {
        throw new Error('earlier getter');
      },
      [first]: 3,
      [last]: 4
    };
    const seen = [];
    const predicate = Object.setPrototypeOf((value, key) => {
      seen.push(key);
      return value === 4;
    }, null);
    const result = name === 'replaceLast' ? O[name](input, predicate, 9) : O[name](input, predicate);
    assert.equal(result, 4);
    assert.deepEqual(seen, [last]);
    assert.equal(input[first], 3);
    assert.equal(Object.hasOwn(input, last), name === 'replaceLast');
    if (name === 'replaceLast') assert.equal(input[last], 9);
  }
});

test('replacement rechecks a descriptor changed by its callback without invoking the new setter', () => {
  const input = { a: 1, b: 2 };
  let setters = 0;
  const replacement = Object.setPrototypeOf((value, key) => {
    if (key === 'b')
      Object.defineProperty(input, key, {
        configurable: true,
        enumerable: true,
        set() {
          setters++;
        }
      });
    return value + 10;
  }, null);
  assert.throws(() => O.replaceAll(input, () => true, replacement), TypeError);
  assert.equal(input.a, 11);
  assert.equal(typeof Object.getOwnPropertyDescriptor(input, 'b').set, 'function');
  assert.equal(setters, 0);
});

test('replacement callback deletion creates own data rather than invoking an inherited setter', () => {
  let setters = 0;
  const input = Object.create({
    set a(_value) {
      setters++;
    }
  });
  Object.defineProperty(input, 'a', { value: 1, writable: true, enumerable: true, configurable: true });
  assert.equal(
    O.replace(input, 1, () => {
      delete input.a;
      return 9;
    }),
    1
  );
  assert.deepEqual(Object.getOwnPropertyDescriptor(input, 'a'), {
    value: 9,
    writable: true,
    enumerable: true,
    configurable: true
  });
  assert.equal(setters, 0);
});

test('partial deletion and replacement errors retain completed earlier mutations', () => {
  const removal = { a: 1 };
  Object.defineProperty(removal, 'b', { value: 2, enumerable: true, configurable: false });
  assert.throws(
    () =>
      O.removeAll(
        removal,
        Object.setPrototypeOf(() => true, null)
      ),
    TypeError
  );
  assert.equal(Object.hasOwn(removal, 'a'), false);
  assert.equal(removal.b, 2);
  const replacement = { a: 1, b: 2, c: 3 };
  const error = new Error('replacement fails');
  let calls = 0;
  assert.throws(
    () =>
      O.replaceAll(
        replacement,
        () => true,
        Object.setPrototypeOf((value) => {
          calls++;
          if (value === 2) throw error;
          return value + 10;
        }, null)
      ),
    (actual) => actual === error
  );
  assert.deepEqual(replacement, { a: 11, b: 2, c: 3 });
  assert.equal(calls, 2);
});

test('empty collections do not consult unreachable callback metadata', () => {
  const predicate = new Proxy(() => true, {
    get() {
      throw new Error('empty collection does not call');
    }
  });
  const expected = {
    count: 0,
    some: false,
    every: true,
    find: undefined,
    findLast: undefined,
    findAll: [],
    findKey: undefined,
    findEntry: undefined,
    remove: undefined,
    removeLast: undefined,
    removeAll: [],
    replace: undefined,
    replaceLast: undefined,
    replaceAll: []
  };
  for (const [name, value] of Object.entries(expected)) {
    const result = replacementNames.includes(name) ? O[name]({}, predicate, predicate) : O[name]({}, predicate);
    assert.deepEqual(result, value);
  }
});
