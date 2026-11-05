'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const O = require('..');

function invoke(name, object, matcher, replacement, options) {
  return name.startsWith('deepRemove')
    ? O[name](object, matcher, options)
    : O[name](object, matcher, replacement, options);
}

for (const name of ['deepRemove', 'deepReplace']) {
  test(name + ' stops on a matched container before descent or later property reads', () => {
    const branch = {};
    Object.defineProperty(branch, 'unread', {
      enumerable: true,
      get() {
        throw new Error('matched descendants must not be read');
      }
    });
    const input = { branch };
    Object.defineProperty(input, 'later', {
      enumerable: true,
      get() {
        throw new Error('later sibling must not be read');
      }
    });
    const seen = [];
    const replacement = { saved: true };
    assert.equal(
      invoke(
        name,
        input,
        (value, key, parent, path) => {
          assert.equal(parent, input);
          seen.push(path);
          return value === branch;
        },
        replacement,
        {
          shouldDescend() {
            throw new Error('stop must precede descent');
          }
        }
      ),
      branch
    );
    assert.deepEqual(seen, [['branch']]);
    assert.equal(Object.hasOwn(input, 'branch'), name === 'deepReplace');
    if (name === 'deepReplace') assert.equal(input.branch, replacement);
    assert.equal(Object.hasOwn(branch, 'unread'), true);
  });
}

for (const name of ['deepRemoveLast', 'deepReplaceLast']) {
  test(name + ' does not apply an earlier invalid match when a later valid slot is selected', () => {
    const first = Object.freeze({ n: 1 });
    const last = { n: 2 };
    const input = { first, last };
    let replacements = 0;
    const result = invoke(
      name,
      input,
      (value) => typeof value === 'number',
      function (value, key, parent, path) {
        replacements++;
        assert.equal(this, last);
        assert.equal(parent, last);
        assert.equal(key, 'n');
        assert.deepEqual(path, ['last', 'n']);
        return value + 10;
      }
    );
    assert.equal(result, 2);
    assert.equal(first.n, 1);
    assert.equal(replacements, name === 'deepReplaceLast' ? 1 : 0);
    assert.deepEqual(last, name === 'deepReplaceLast' ? { n: 12 } : {});
  });

  test(name + ' applies after the final visit and returns the captured rather than reread value', () => {
    const branch = { n: 1 };
    const input = { branch };
    const order = [];
    Object.defineProperty(input, 'later', {
      enumerable: true,
      get() {
        assert.equal(branch.n, 1, 'no library mutation during selection');
        branch.n = 7;
        order.push('later getter');
        return 'unmatched';
      }
    });
    const result = invoke(
      name,
      input,
      (value, key) => {
        order.push('match ' + key);
        return typeof value === 'number';
      },
      (value, key, parent, path) => {
        assert.equal(value, 1);
        assert.equal(parent, branch);
        assert.equal(parent[key], 7);
        assert.deepEqual(path, ['branch', 'n']);
        order.push('replacement');
        return 9;
      }
    );
    assert.equal(result, 1);
    assert.deepEqual(order, [
      'match branch',
      'match n',
      'later getter',
      'match later',
      ...(name === 'deepReplaceLast' ? ['replacement'] : [])
    ]);
    assert.deepEqual(branch, name === 'deepReplaceLast' ? { n: 9 } : {});
  });

  test(name + ' makes no pending library edit when a later getter aborts selection', () => {
    const error = new Error('later read');
    const input = { branch: { n: 1 } };
    Object.defineProperty(input, 'later', {
      enumerable: true,
      get() {
        throw error;
      }
    });
    let replacements = 0;
    assert.throws(
      () =>
        invoke(name, input, 1, () => {
          replacements++;
          return 9;
        }),
      (value) => value === error
    );
    assert.equal(input.branch.n, 1);
    assert.equal(replacements, 0);
  });

  test(name + ' chooses the final visited edge at the depth cutoff, not the deepest possible descendant', () => {
    for (const maxDepth of [1, 2]) {
      const branch = { n: 3 };
      const input = { branch };
      const result = invoke(name, input, () => true, 8, { maxDepth });
      assert.equal(result, maxDepth === 1 ? branch : 3);
      if (maxDepth === 1) {
        assert.equal(branch.n, 3);
        assert.deepEqual(input, name === 'deepReplaceLast' ? { branch: 8 } : {});
      } else {
        assert.equal(input.branch, branch);
        assert.deepEqual(branch, name === 'deepReplaceLast' ? { n: 8 } : {});
      }
    }
  });
}

for (const name of ['deepRemoveAll', 'deepReplaceAll']) {
  test(name + ' may reach a pruned matched container later through an unpruned alias', () => {
    const branch = { n: 1 };
    const input = { drop: branch, keep: branch };
    const seen = [];
    const previous = invoke(
      name,
      input,
      (value, key, parent, path) => {
        seen.push(path);
        return key === 'drop' || typeof value === 'number';
      },
      9
    );
    assert.deepEqual(seen, [['drop'], ['keep'], ['keep', 'n']]);
    assert.equal(previous[0], branch);
    assert.equal(previous[1], 1);
    assert.equal(previous.length, 2);
    assert.equal(input.keep, branch);
    assert.deepEqual(branch, name === 'deepReplaceAll' ? { n: 9 } : {});
    assert.equal(Object.hasOwn(input, 'drop'), name === 'deepReplaceAll');
    if (name === 'deepReplaceAll') assert.equal(input.drop, 9);
  });

  test(name + ' expands an edited shared child once while still visiting alias and cycle edges', () => {
    const branch = { n: 1 };
    const input = { a: branch, b: branch };
    input.self = input;
    const seen = [],
      descended = [];
    const result = invoke(
      name,
      input,
      (value, key, parent, path) => {
        seen.push(path);
        return typeof value === 'number';
      },
      (value) => value + 1,
      {
        shouldDescend(value, key, parent, path) {
          descended.push(path);
          return true;
        }
      }
    );
    assert.deepEqual(result, [1]);
    assert.deepEqual(seen, [['a'], ['a', 'n'], ['b'], ['self']]);
    assert.deepEqual(descended, [['a']]);
    assert.equal(input.a, input.b);
    assert.equal(input.self, input);
    assert.deepEqual(branch, name === 'deepReplaceAll' ? { n: 2 } : {});
  });

  test(name + ' uses per-container key snapshots while observing values at each visit', () => {
    const input = { a: { first: 1, hidden: 2 }, b: { last: 3 } };
    const seen = [];
    const result = invoke(
      name,
      input,
      (value, key, parent, path) => {
        seen.push(path);
        if (key === 'first') {
          Object.defineProperty(parent, 'hidden', { enumerable: false });
          parent.new = 4;
          input.newRoot = 5;
          input.b.newChild = 6;
        }
        if (key === 'b') {
          assert.equal(Object.hasOwn(input.a, 'first'), name === 'deepReplaceAll');
          if (name === 'deepReplaceAll') assert.equal(input.a.first, 10);
        }
        return typeof value === 'number';
      },
      (value) => value * 10
    );
    assert.deepEqual(result, [1, 3, 6]);
    assert.deepEqual(seen, [['a'], ['a', 'first'], ['b'], ['b', 'last'], ['b', 'newChild']]);
    assert.equal(input.a.hidden, 2);
    assert.equal(input.a.new, 4);
    assert.equal(input.newRoot, 5);
    assert.deepEqual(input.b, name === 'deepReplaceAll' ? { last: 30, newChild: 60 } : {});
  });

  test(name + ' propagates a later descent error after retaining earlier successful edits', () => {
    const error = new Error('cannot descend');
    const input = { first: 1, next: { n: 2 } };
    assert.throws(
      () =>
        invoke(name, input, 1, 9, {
          shouldDescend() {
            throw error;
          }
        }),
      (value) => value === error
    );
    assert.equal(Object.hasOwn(input, 'first'), name === 'deepReplaceAll');
    if (name === 'deepReplaceAll') assert.equal(input.first, 9);
    assert.equal(input.next.n, 2);
  });

  test(name + ' propagates an actual Proxy write/delete error and retains only prior successful edits', () => {
    const error = new Error('write denied');
    const target = { n: 2 };
    const later = new Proxy(target, {
      defineProperty() {
        throw error;
      },
      deleteProperty() {
        throw error;
      }
    });
    const input = { first: { n: 1 }, later };
    const seen = [];
    assert.throws(
      () =>
        invoke(
          name,
          input,
          (value, key, parent, path) => {
            seen.push(path);
            return typeof value === 'number';
          },
          9
        ),
      (value) => value === error
    );
    assert.deepEqual(seen, [['first'], ['first', 'n'], ['later'], ['later', 'n']]);
    assert.deepEqual(input.first, name === 'deepReplaceAll' ? { n: 9 } : {});
    assert.equal(target.n, 2);
  });

  test(name + ' treats prototype-sensitive matched keys as own data rather than paths', () => {
    const input = JSON.parse('{"__proto__":1,"constructor":2,"prototype":3,"nested":{"n":4}}');
    const proto = Object.getPrototypeOf(input);
    const result = invoke(name, input, (value) => typeof value === 'number', 7);
    assert.deepEqual(result, [1, 2, 3, 4]);
    assert.equal(Object.getPrototypeOf(input), proto);
    for (const key of ['__proto__', 'constructor', 'prototype']) {
      assert.equal(Object.hasOwn(input, key), name === 'deepReplaceAll');
      if (name === 'deepReplaceAll') {
        assert.deepEqual(Object.getOwnPropertyDescriptor(input, key), {
          value: 7,
          writable: true,
          enumerable: true,
          configurable: true
        });
      }
    }
    assert.deepEqual(input.nested, name === 'deepReplaceAll' ? { n: 7 } : {});
    assert.equal(Object.hasOwn(Object.prototype, 'n'), false);
  });
}

test('deepReplaceAll prunes a selected container even when the replacement returns that exact container', () => {
  const branch = {};
  Object.defineProperty(branch, 'n', {
    enumerable: true,
    get() {
      throw new Error('matched branch must remain pruned even for a no-op replacement');
    }
  });
  const input = { branch };
  assert.deepEqual(
    O.deepReplaceAll(
      input,
      (value) => value === branch,
      (value) => value,
      {
        shouldDescend() {
          throw new Error('must not request descent');
        }
      }
    ),
    [branch]
  );
  assert.equal(input.branch, branch);
});

test('deepReplaceAll shares a literal replacement graph without expanding it', () => {
  const replacement = {};
  replacement.self = replacement;
  Object.defineProperty(replacement, 'unread', {
    enumerable: true,
    get() {
      throw new Error('not input');
    }
  });
  const input = { a: { n: 1 }, b: { n: 1 } };
  assert.deepEqual(O.deepReplaceAll(input, 1, replacement), [1, 1]);
  assert.equal(input.a.n, replacement);
  assert.equal(input.b.n, replacement);
  assert.equal(replacement.self, replacement);
});

for (const name of ['deepReplace', 'deepReplaceLast', 'deepReplaceAll']) {
  test(name + ' preserves descriptor flags and the observed value after a predicate rewrites its slot', () => {
    const branch = Object.defineProperty({}, 'n', {
      value: 1,
      writable: true,
      configurable: false,
      enumerable: true
    });
    const input = { branch };
    const result = O[name](
      input,
      (value, key, parent) => {
        if (key !== 'n') return false;
        Object.defineProperty(parent, key, { value: 5 });
        return value === 1;
      },
      function (value, key, parent, path) {
        assert.equal(this, branch);
        assert.equal(value, 1);
        assert.equal(parent[key], 5);
        assert.deepEqual(path, ['branch', 'n']);
        return 7;
      }
    );
    assert.deepEqual(result, name === 'deepReplaceAll' ? [1] : 1);
    assert.deepEqual(Object.getOwnPropertyDescriptor(branch, 'n'), {
      value: 7,
      writable: true,
      configurable: false,
      enumerable: true
    });
  });

  test(name + ' rejects a matched slot converted to an accessor before invoking its replacement', () => {
    const input = { branch: { n: 1 } };
    let getters = 0,
      setters = 0,
      replacements = 0;
    assert.throws(
      () =>
        O[name](
          input,
          (value, key, parent) => {
            if (key !== 'n') return false;
            Object.defineProperty(parent, key, {
              get() {
                getters++;
                return 3;
              },
              set() {
                setters++;
              }
            });
            return value === 1;
          },
          () => {
            replacements++;
            return 8;
          }
        ),
      TypeError
    );
    assert.equal(getters, 0);
    assert.equal(setters, 0);
    assert.equal(replacements, 0);
    assert.equal(typeof Object.getOwnPropertyDescriptor(input.branch, 'n').get, 'function');
  });
}

for (const name of ['deepRemove', 'deepRemoveLast', 'deepRemoveAll']) {
  test(name + ' deletes configurable readonly sparse indices and symbol edges without shrinking a locked array', () => {
    const extra = Symbol('extra');
    const list = new Array(5);
    for (const key of ['1', '3', extra])
      Object.defineProperty(list, key, {
        value: 4,
        writable: false,
        configurable: true,
        enumerable: true
      });
    Object.defineProperty(list, 'length', { writable: false });
    const input = { list };
    assert.deepEqual(O[name](input, 4), name === 'deepRemoveAll' ? [4, 4, 4] : 4);
    const removed = name === 'deepRemove' ? ['1'] : name === 'deepRemoveLast' ? [extra] : ['1', '3', extra];
    for (const key of ['1', '3', extra]) assert.equal(Object.hasOwn(list, key), !removed.includes(key));
    assert.equal(list.length, 5);
    assert.equal(Object.getOwnPropertyDescriptor(list, 'length').writable, false);
    assert.equal(Object.hasOwn(list, '0'), false);
  });
}

test('deepRemoveAll removes a configurable accessor using its one observed undefined value', () => {
  let reads = 0;
  const branch = {};
  Object.defineProperty(branch, 'optional', {
    get() {
      reads++;
      return undefined;
    },
    set() {
      throw new Error('deleting does not assign');
    },
    enumerable: true,
    configurable: true
  });
  assert.deepEqual(O.deepRemoveAll({ branch }, undefined), [undefined]);
  assert.equal(reads, 1);
  assert.equal(Object.hasOwn(branch, 'optional'), false);
});

test('deepReplaceAll leaves the failing slot intact when a later replacement throws', () => {
  const input = { branch: { a: 1, b: 2, c: 3 } };
  const error = new Error('second replacement');
  const calls = [];
  assert.throws(
    () =>
      O.deepReplaceAll(
        input,
        (value) => typeof value === 'number',
        (value, key, parent, path) => {
          calls.push(path);
          if (key === 'b') throw error;
          return value * 10;
        }
      ),
    (value) => value === error
  );
  assert.deepEqual(input.branch, { a: 10, b: 2, c: 3 });
  assert.deepEqual(calls, [
    ['branch', 'a'],
    ['branch', 'b']
  ]);
});

test('deepReplaceLast writes to the captured parent even if later user code detaches it from the root', () => {
  const branch = { n: 1 };
  const replacementBranch = { n: 8 };
  const input = { branch, later: false };
  const result = O.deepReplaceLast(
    input,
    (value, key) => {
      if (key === 'later') input.branch = replacementBranch;
      return value === 1;
    },
    (value, key, parent, path) => {
      assert.equal(parent, branch);
      assert.deepEqual(path, ['branch', 'n']);
      return value + 1;
    }
  );
  assert.equal(result, 1);
  assert.equal(input.branch, replacementBranch);
  assert.equal(replacementBranch.n, 8);
  assert.equal(branch.n, 2);
});

test('deepReplaceAll remains reentrant while later outer visits observe completed inner edits', () => {
  const input = { branch: { a: 1, b: 2 } };
  const paths = [];
  const result = O.deepReplaceAll(
    input,
    (value) => typeof value === 'number',
    (value, key, parent, path) => {
      paths.push(path);
      if (key === 'a') assert.equal(O.deepReplace(input, 2, 5), 2);
      return value * 10;
    }
  );
  assert.deepEqual(result, [1, 5]);
  assert.deepEqual(input, { branch: { a: 10, b: 50 } });
  assert.deepEqual(paths, [
    ['branch', 'a'],
    ['branch', 'b']
  ]);
  assert.notEqual(paths[0], paths[1]);
});

test('deepReplaceAll stores returned functions and thenables without inspecting or awaiting them', () => {
  const fn = function () {
    throw new Error('stored function must not execute');
  };
  const thenable = {
    get then() {
      throw new Error('stored thenable must not be inspected');
    }
  };
  const input = { branch: { a: 1, b: 2 } };
  assert.deepEqual(
    O.deepReplaceAll(
      input,
      (value) => typeof value === 'number',
      (value) => (value === 1 ? fn : thenable)
    ),
    [1, 2]
  );
  assert.equal(input.branch.a, fn);
  assert.equal(input.branch.b, thenable);
});

test('deepRemoveAll rejects a false deletion-trap result and accepts a genuine forwarding deletion', () => {
  for (const allowed of [false, true]) {
    const target = { n: 2 };
    const later = new Proxy(target, {
      deleteProperty(object, key) {
        return allowed ? Reflect.deleteProperty(object, key) : false;
      }
    });
    const input = { first: { n: 1 }, later };
    const run = () => O.deepRemoveAll(input, (value) => typeof value === 'number');
    if (allowed) assert.deepEqual(run(), [1, 2]);
    else assert.throws(run, TypeError);
    assert.deepEqual(input.first, {});
    assert.equal(Object.hasOwn(target, 'n'), !allowed);
    if (!allowed) assert.equal(target.n, 2);
  }
});
