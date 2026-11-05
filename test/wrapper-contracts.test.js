'use strict';
// Ordinary per-utility results and all 60 bindings are covered in scenarios-surfaces.
// These cases target wrapper ownership, argument forwarding and operation boundaries.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const O = require('..');

test('factory calls bound to an existing wrapper create independent bookkeeping', () => {
  const original = O({ first: 1 }).set('first', 2);
  const originalValue = original.unwrap();
  const create = O.bind(original);
  const value = { second: 3 };
  const next = create(value);
  assert.notStrictEqual(next, original);
  assertState(next, value, value);
  assertState(original, originalValue, 1);
});

test('a factory bound to a frozen wrapper ignores receiver state', () => {
  const original = Object.freeze(O(1));
  const next = O.bind(original)(2);
  assertState(next, 2, 2);
  assertState(original, 1, 1);
});

test('a factory used as a method on a wrapper prototype descendant does not initialize its receiver', () => {
  const holder = Object.create(O.prototype);
  holder.wrap = O;
  const next = holder.wrap(3);
  assertState(next, 3, 3);
  assert.deepEqual(Reflect.ownKeys(holder), ['wrap']);
});

test('new construction retains the requested derived prototype', () => {
  class Derived extends O {}
  const value = { n: 1 };
  const derived = new Derived(value);
  assert.ok(derived instanceof Derived);
  assertState(derived, value, value);
  function Alternate() {}
  const alternate = Reflect.construct(O, [value], Alternate);
  assert.strictEqual(Object.getPrototypeOf(alternate), Alternate.prototype);
  assert.strictEqual(alternate._value, value);
  assert.strictEqual(alternate._result, value);
});

function assertState(wrapper, value, result) {
  assert.strictEqual(wrapper.unwrap(), value);
  assert.strictEqual(wrapper.result(), result);
}

test('constructing and inspecting a wrapper never reflects on its input', () => {
  const unexpected = () => {
    throw new Error('input must remain opaque');
  };
  const input = new Proxy(
    {},
    {
      get: unexpected,
      getPrototypeOf: unexpected,
      ownKeys: unexpected,
      getOwnPropertyDescriptor: unexpected,
      has: unexpected,
      isExtensible: unexpected
    }
  );
  const factory = O(input);
  const constructed = new O(input);
  assert.notStrictEqual(factory, constructed);
  assertState(factory, input, input);
  assertState(constructed, input, input);
});

test('primitive roots preserve exact identity including signed zero without coercion', () => {
  for (const input of [undefined, null, false, true, 0, -0, NaN, '', 'text', 1n, Symbol('input')]) {
    const first = O(input);
    const second = new O(input);
    assert.notStrictEqual(first, second);
    assertState(first, input, input);
    assertState(second, input, input);
  }
});

test('factory calls used as ordinary object methods do not change their receiver', () => {
  const holder = { wrap: O, preserved: 1 };
  const input = { n: 2 };
  const wrapper = holder.wrap(input);
  assertState(wrapper, input, input);
  assert.deepEqual(Reflect.ownKeys(holder), ['wrap', 'preserved']);
  assert.strictEqual(holder.preserved, 1);
});

test('payload names do not shadow wrapper bookkeeping or public methods', () => {
  const input = { _value: 1, _result: 2, unwrap: 3, result: 4, get: 5, constructor: 6, then: 7 };
  const wrapper = O(input);
  assertState(wrapper, input, input);
  for (const [key, value] of Object.entries(input)) {
    const next = wrapper.get([key]);
    assertState(next, value, value);
    assertState(wrapper, input, input);
  }
});

test('wrapping another wrapper retains it as data rather than implicitly unwrapping it', () => {
  const inner = O({ n: 1 }).set('n', 2);
  const outer = O(inner);
  assert.notStrictEqual(outer, inner);
  assertState(outer, inner, inner);
  assert.strictEqual(inner.result(), 1);
});

for (const [name, args] of [
  ['setImmutable', ['n', 1]],
  ['updateImmutable', ['n', (n) => n]],
  ['unsetImmutable', ['absent']]
]) {
  test(name + ' returns a fresh wrapper even when the frozen input is unchanged', () => {
    const input = Object.freeze({ n: 1 });
    const first = Object.freeze(O(input));
    const second = first[name](...args);
    assert.notStrictEqual(second, first);
    assertState(second, input, input);
    assertState(first, input, input);
    assert.ok(Object.isFrozen(input));
  });
}

test('an immutable edit from a mutation chain advances the result without rewriting old wrappers', () => {
  const input = { n: 1, keep: { flag: true } };
  const first = O(input);
  const changed = Object.freeze(first.set('n', 2));
  const copied = changed.setImmutable('n', 3);
  assertState(first, input, input);
  assertState(changed, input, 1);
  assert.strictEqual(copied.unwrap(), copied.result());
  assert.notStrictEqual(copied.unwrap(), input);
  assert.strictEqual(copied.unwrap().keep, input.keep);
  assert.strictEqual(copied.unwrap().n, 3);
  assert.strictEqual(input.n, 2);
});

test('mutation methods can operate from frozen wrappers without mutating bookkeeping', () => {
  const input = { n: 1 };
  const first = Object.freeze(O(input));
  const second = Object.freeze(first.set('n', 2));
  const third = Object.freeze(second.update('n', (n) => n + 1));
  const fourth = third.unset('n');
  assertState(first, input, input);
  assertState(second, input, 1);
  assertState(third, input, 2);
  assertState(fourth, input, true);
  assert.deepEqual(input, {});
  assert.notStrictEqual(fourth, third);
});

for (const name of ['forEach', 'deepForEach']) {
  test(name + ' executes immediately on the current input and resets only the new last result', () => {
    const input = { n: 1 };
    const previous = O(input).set('n', 2);
    const observed = [];
    const next = previous[name](function (value, key, parent, path) {
      assert.strictEqual(this, input);
      assert.strictEqual(parent, input);
      observed.push([value, key]);
      if (name === 'deepForEach') assert.deepEqual(path, ['n']);
    });
    assert.deepEqual(observed, [[2, 'n']]);
    assertState(previous, input, 1);
    assertState(next, input, input);
    next.result();
    next.unwrap();
    assert.strictEqual(observed.length, 1);
  });
}

for (const name of ['reduce', 'reduceRight']) {
  test(name + ' preserves omitted versus explicitly undefined accumulator arguments', () => {
    const wrapper = O({ first: 1, second: 2 });
    const seen = [];
    function reducer(accumulator, value, key, parent) {
      assert.strictEqual(this, wrapper.unwrap());
      assert.strictEqual(parent, wrapper.unwrap());
      assert.strictEqual(arguments.length, 4);
      seen.push([accumulator, value, key]);
      return (accumulator ?? 0) + value;
    }
    const implicit = wrapper[name](reducer);
    assertState(implicit, 3, 3);
    assert.deepEqual(seen, name === 'reduce' ? [[1, 2, 'second']] : [[2, 1, 'first']]);
    seen.length = 0;
    const explicit = wrapper[name](reducer, undefined);
    assertState(explicit, 3, 3);
    assert.deepEqual(
      seen,
      name === 'reduce'
        ? [
            [undefined, 1, 'first'],
            [1, 2, 'second']
          ]
        : [
            [undefined, 2, 'second'],
            [2, 1, 'first']
          ]
    );
  });
}

for (const [name, others, expected] of [
  ['merge', [{ a: 3, b: 3 }, { b: 4 }, { c: 5 }], { a: 3, b: 4, c: 5 }],
  ['intersect', [{ a: 2, b: 2, c: 3 }, { a: 2, b: 2 }, { a: 2 }], { a: 2 }],
  ['except', [{ b: 2 }, { c: 3 }, { a: 2 }], {}]
]) {
  test(name + ' forwards every variadic source after a mutation whose last result differs', () => {
    const input = { a: 1, b: 2, c: 3 };
    const previous = O(input).set('a', 2);
    const next = previous[name](...others);
    assert.deepEqual(next.unwrap(), expected);
    assert.strictEqual(next.unwrap(), next.result());
    assert.notStrictEqual(next.unwrap(), input);
    assertState(previous, input, 1);
    assert.deepEqual(input, { a: 2, b: 2, c: 3 });
  });
}

test('captured getter results are retained rather than reread by wrapper accessors', () => {
  let reads = 0;
  const captured = { n: 1 };
  const input = {
    get value() {
      assert.strictEqual(this, input);
      reads++;
      return captured;
    }
  };
  const previous = O(input);
  const next = previous.get('value');
  assert.strictEqual(reads, 1);
  assertState(next, captured, captured);
  assertState(next, captured, captured);
  const edited = next.set('n', 2);
  assertState(edited, captured, 1);
  assertState(next, captured, captured);
  assert.strictEqual(captured.n, 2);
  assert.strictEqual(reads, 1);
  assertState(previous, input, input);
});

test('query functions and thenables remain literal results and are never invoked by the wrapper', () => {
  let calls = 0;
  const handler = () => {
    calls++;
  };
  const thenable = {
    get then() {
      throw new Error('then must not be read');
    }
  };
  const input = { handler, thenable };
  const first = O(input);
  assertState(first.get('handler'), handler, handler);
  assertState(first.get('thenable'), thenable, thenable);
  const assigned = first.set('stored', thenable);
  assertState(assigned, input, undefined);
  assert.strictEqual(input.stored, thenable);
  assert.strictEqual(calls, 0);
});

test('awaiting a wrapper does not assimilate a thenable inside its current value', async () => {
  const input = {
    get then() {
      throw new Error('payload then must remain unread');
    }
  };
  const wrapper = O({ n: 1 }).reduce(() => input, input);
  assert.strictEqual(await wrapper, wrapper);
  assertState(wrapper, input, input);
});

test('scalar query results become the next current input instead of silently retaining the object', () => {
  const input = { n: 1 };
  const previous = O(input).set('n', 2);
  const flag = previous.has('n');
  assertState(flag, true, true);
  const names = flag.keys();
  assert.deepEqual(names.unwrap(), []);
  assert.strictEqual(names.unwrap(), names.result());
  assertState(previous, input, 1);
});

test('no-match mutations retain undefined or empty-array results separately from their target', () => {
  for (const [name, args, all] of [
    ['remove', [99], false],
    ['removeAll', [99], true],
    ['deepReplace', [99, 5], false],
    ['deepReplaceAll', [99, 5], true]
  ]) {
    const input = { n: 1 };
    const first = O(input).set('n', 2);
    const next = first[name](...args);
    assert.notStrictEqual(next, first);
    assert.strictEqual(next.unwrap(), input);
    if (all) assert.deepEqual(next.result(), []);
    else assert.strictEqual(next.result(), undefined);
    assertState(first, input, 1);
    assert.deepEqual(input, { n: 2 });
  }
});

test('array removal results stay references while subsequent queries get independent wrappers', () => {
  const removed = { id: 1 };
  const input = { a: removed, b: removed, keep: true };
  const first = O(input);
  const next = first.removeAll(removed);
  const result = next.result();
  assert.deepEqual(result, [removed, removed]);
  assert.strictEqual(result[0], removed);
  assert.strictEqual(result, next.result());
  const keys = next.keys();
  assert.deepEqual(keys.unwrap(), ['keep']);
  assertState(next, input, result);
  assertState(first, input, input);
  removed.id = 2;
  assert.strictEqual(result[1].id, 2);
});

test('failed batch writes preserve old wrapper results without rolling back earlier writes', () => {
  const input = { marker: 'original', a: 1 };
  Object.defineProperty(input, 'blocked', { value: 3, enumerable: true });
  const previous = Object.freeze(O(input).set('marker', 'current'));
  assert.throws(() => previous.setEach(['a', 'blocked'], 9), TypeError);
  assertState(previous, input, 'original');
  assert.deepEqual(input, { marker: 'current', a: 9, blocked: 3 });
  const retry = previous.set('a', 10);
  assertState(retry, input, 9);
  assertState(previous, input, 'original');
});

test('a failed deep mutation propagates the same callback error and retains prior bookkeeping', () => {
  const input = { branch: { a: 1, b: 2 }, marker: 'old' };
  const previous = O(input).set('marker', 'new');
  const error = new Error('replacement');
  assert.throws(
    () =>
      previous.deepReplaceAll(
        (v) => typeof v === 'number',
        (v) => {
          if (v === 2) throw error;
          return v + 10;
        }
      ),
    (thrown) => thrown === error
  );
  assertState(previous, input, 'old');
  assert.deepEqual(input, { branch: { a: 11, b: 2 }, marker: 'new' });
});

test('reentrant mutation branches retain their individual observed results', () => {
  const input = { n: 1, marker: 'old' };
  const previous = Object.freeze(O(input).set('marker', 'new'));
  let inner;
  const outer = previous.update('n', (value) => {
    assert.strictEqual(value, 1);
    inner = previous.set('n', 4);
    assertState(previous, input, 'old');
    return value + 1;
  });
  assert.notStrictEqual(inner, outer);
  assertState(previous, input, 'old');
  assertState(inner, input, 1);
  assertState(outer, input, 1);
  assert.strictEqual(input.n, 2);
});

test('read failures propagate their original identity without altering prior results', () => {
  const error = new Error('getter');
  const input = {
    marker: 'old',
    get broken() {
      throw error;
    }
  };
  const previous = O(input).set('marker', 'new');
  assert.throws(
    () => previous.get('broken'),
    (thrown) => thrown === error
  );
  assertState(previous, input, 'old');
  assertState(previous.get('marker'), 'new', 'new');
});

test('a bound chain method uses the receiver current value at each call without replacing it', () => {
  const input = { n: 1 };
  const previous = Object.freeze(O(input).set('n', 2));
  const update = previous.update.bind(previous);
  const next = update('n', (n) => n + 1);
  const after = update('n', (n) => n + 1);
  assertState(previous, input, 1);
  assertState(next, input, 2);
  assertState(after, input, 3);
  assert.notStrictEqual(next, after);
  assert.strictEqual(input.n, 4);
});

test('mapper callbacks receive the current collection after a query rather than the wrapper or original root', () => {
  const input = { branch: { x: 1, y: 2 }, ignored: 10 };
  const first = O(input);
  const branch = first.get('branch');
  const calls = [];
  const next = branch.map(function (v, k, parent) {
    assert.strictEqual(this, input.branch);
    assert.strictEqual(parent, input.branch);
    assert.strictEqual(arguments.length, 3);
    calls.push(k);
    return v * 10;
  });
  assert.deepEqual(calls, ['x', 'y']);
  assert.deepEqual(next.unwrap(), { x: 10, y: 20 });
  assertState(first, input, input);
  assertState(branch, input.branch, input.branch);
});

test('nested options and callback paths are forwarded without the wrapper becoming their root', () => {
  const input = { branch: { n: 1 }, other: 2 };
  const original = O(input);
  const paths = [];
  const predicate = (value, key, parent, path) => {
    paths.push(path);
    if (key === 'n') assert.strictEqual(parent, input.branch);
    return value === 1;
  };
  const limited = original.deepFindEntry(predicate, { maxDepth: 1 });
  assertState(limited, undefined, undefined);
  assert.deepEqual(paths, [['branch'], ['other']]);
  paths.length = 0;
  const result = original.deepFindEntry(predicate, { maxDepth: 2 });
  assert.deepEqual(result.unwrap(), [['branch', 'n'], 1]);
  assert.deepEqual(paths, [['branch'], ['branch', 'n']]);
  assert.notStrictEqual(paths[1], result.unwrap()[0]);
  assertState(original, input, input);
});
