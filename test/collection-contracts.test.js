'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const O = require('..');

const callbackMethods = ['forEach', 'map', 'mapKeys', 'filter', 'reduce', 'reduceRight'];

// Assert actual callback dispatch, receiver, arguments and values, not the invocation mechanism.
function exerciseCallback(method, decorate = (callback) => callback) {
  const symbol = Symbol('field');
  const source = { a: 2, b: 3, [symbol]: 5 };
  const seen = [];
  const reducing = method === 'reduce' || method === 'reduceRight';
  const callback = decorate(function (...args) {
    assert.equal(this, source);
    assert.equal(args.length, reducing ? 4 : 3);
    const [value, key, input] = reducing ? args.slice(1) : args;
    assert.equal(input, source);
    seen.push([key, value]);
    if (reducing) return args[0] + value;
    if (method === 'mapKeys') return typeof key === 'symbol' ? key : key.toUpperCase();
    if (method === 'filter') return value >= 3;
    return value * 2;
  });
  let result;
  assert.doesNotThrow(() => {
    result = reducing ? O[method](source, callback, '') : O[method](source, callback);
  });
  const visits = [
    ['a', 2],
    ['b', 3],
    [symbol, 5]
  ];
  assert.deepEqual(seen, method === 'reduceRight' ? visits.reverse() : visits);
  const expected = {
    forEach: source,
    map: { a: 4, b: 6, [symbol]: 10 },
    mapKeys: { A: 2, B: 3, [symbol]: 5 },
    filter: { b: 3, [symbol]: 5 },
    reduce: '235',
    reduceRight: '532'
  };
  assert.deepEqual(result, expected[method]);
  if (method === 'forEach') assert.equal(result, source);
  assert.deepEqual(source, { a: 2, b: 3, [symbol]: 5 });
}

for (const method of callbackMethods) {
  test(`${method}: regular callback receives exact receiver, arguments and order`, () => {
    exerciseCallback(method);
  });
  test(`${method}: callback remains callable without Function.prototype`, () => {
    exerciseCallback(method, (callback) => Object.setPrototypeOf(callback, null));
  });
  test(`${method}: an own call method cannot substitute the callback body`, () => {
    let substitutions = 0;
    exerciseCallback(method, (callback) => {
      callback.call = () => {
        substitutions++;
        return 'substituted';
      };
      return callback;
    });
    assert.equal(substitutions, 0);
  });
  test(`${method}: callback call accessor is not consulted`, () => {
    exerciseCallback(method, (callback) =>
      Object.defineProperty(callback, 'call', {
        get() {
          throw new Error('unrelated callback metadata was read');
        }
      })
    );
  });
  test(`${method}: callable Proxy uses its apply trap without reading callback properties`, () => {
    let applications = 0;
    exerciseCallback(
      method,
      (callback) =>
        new Proxy(callback, {
          get() {
            throw new Error('unexpected property access on callable Proxy');
          },
          apply(target, receiver, args) {
            applications++;
            return Reflect.apply(target, receiver, args);
          }
        })
    );
    assert.equal(applications, 3);
  });
}

for (const method of ['map', 'reduce']) {
  test(`${method}: bound callback retains its native bound receiver`, () => {
    const receiver = { calls: 0 };
    const callback = function (...args) {
      assert.equal(this, receiver);
      this.calls++;
      return method === 'map' ? args[0] + 1 : args[0] + args[1];
    }.bind(receiver);
    const result = method === 'map' ? O.map({ x: 2 }, callback) : O.reduce({ x: 2 }, callback, 1);
    assert.deepEqual(result, method === 'map' ? { x: 3 } : 3);
    assert.equal(receiver.calls, 1);
  });
  test(`${method}: an apply-trap failure propagates unchanged before later values are read`, () => {
    const sentinel = new Error('apply failed');
    let reads = 0;
    const source = {
      get a() {
        reads++;
        return 1;
      },
      get b() {
        reads++;
        return 2;
      }
    };
    const callback = new Proxy(() => {}, {
      apply() {
        throw sentinel;
      }
    });
    assert.throws(
      () => (method === 'map' ? O.map(source, callback) : O.reduce(source, callback, 0)),
      (error) => error === sentinel
    );
    assert.equal(reads, 1);
  });
}

test('forEach ignores false and thenable callback results without stopping or awaiting', () => {
  const calls = [];
  const thenable = Object.defineProperty({}, 'then', {
    get() {
      throw new Error('must not inspect then');
    }
  });
  const source = { a: 1, b: 2, c: 3 };
  assert.equal(
    O.forEach(source, (value, key) => {
      calls.push(key);
      return value === 1 ? false : thenable;
    }),
    source
  );
  assert.deepEqual(calls, ['a', 'b', 'c']);
});

test('map keeps its initial array length when a callback truncates the source', () => {
  const source = [1, 2, 3];
  const seen = [];
  const result = O.map(source, (value, key) => {
    seen.push(key);
    source.length = 1;
    return value * 10;
  });
  assert.equal(result.length, 3);
  assert.deepEqual(Object.keys(result), ['0']);
  assert.equal(result[0], 10);
  assert.deepEqual(seen, ['0']);
});

test('map treats constructor and species accessors as metadata, not allocation hooks', () => {
  const source = [2, 4];
  Object.defineProperty(source, 'constructor', {
    get() {
      throw new Error('constructor read');
    }
  });
  Object.defineProperty(source, Symbol.species, {
    get() {
      throw new Error('species read');
    }
  });
  assert.deepEqual(
    O.map(source, (value) => value + 1),
    [3, 5]
  );
});

test('filter compacts only canonical array indices and preserves extra string/symbol data', () => {
  const symbol = Symbol('extra');
  const source = [];
  source[2] = { n: 2 };
  source[7] = { n: 7 };
  source['01'] = 'leading zero';
  source['-0'] = 'negative zero';
  source['4294967295'] = 'not an array index';
  source[symbol] = 'symbol';
  const result = O.filter(source, () => true);
  assert.equal(result.length, 2);
  assert.equal(result[0], source[2]);
  assert.equal(result[1], source[7]);
  for (const key of ['01', '-0', '4294967295', symbol]) assert.equal(result[key], source[key]);
  assert.equal(source.length, 8);
});

for (const method of ['mapKeys', 'filter']) {
  test(`${method}: output retains the observed value when its callback overwrites the source`, () => {
    const before = { version: 1 };
    const source = { a: before };
    const result = O[method](source, () => {
      source.a = { version: 2 };
      return method === 'mapKeys' ? 'renamed' : true;
    });
    assert.equal(result[method === 'mapKeys' ? 'renamed' : 'a'], before);
    assert.notEqual(source.a, before);
  });
}

test('mapKeys strict collisions stop before reading later getters and never coerce invalid objects', () => {
  let laterReads = 0;
  const source = {
    a: 1,
    b: 2,
    get c() {
      laterReads++;
      return 3;
    }
  };
  assert.throws(() => O.mapKeys(source, (_, key) => (key === 'a' ? 1 : '1'), { onCollision: 'throw' }), TypeError);
  assert.equal(laterReads, 0);
  const invalidKey = {
    [Symbol.toPrimitive]() {
      throw new Error('must not coerce');
    }
  };
  assert.throws(() => O.mapKeys({ a: 1 }, () => invalidKey), TypeError);
});

test('pick snapshots the requested list but observes duplicate and newly added properties in list order', () => {
  const keys = ['a', 'b', 'a'];
  let reads = 0;
  const source = {
    get a() {
      reads++;
      keys.length = 0;
      source.b = reads * 10;
      return reads;
    }
  };
  assert.deepEqual(O.pick(source, keys), { a: 2, b: 10 });
  assert.equal(reads, 2);
  assert.deepEqual(keys, []);
});

for (const method of ['pick', 'omit']) {
  test(`${method}: closes a failing custom key iterator before reading source values`, () => {
    let closed = 0;
    let reads = 0;
    const keys = [];
    keys[Symbol.iterator] = function* () {
      try {
        yield 'a';
        yield {};
      } finally {
        closed++;
      }
    };
    const source = {
      get a() {
        reads++;
        return 1;
      }
    };
    assert.throws(() => O[method](source, keys), TypeError);
    assert.equal(closed, 1);
    assert.equal(reads, 0);
  });
}

test('omit snapshots exclusions before a retained getter edits the caller key list', () => {
  const omitted = ['b'];
  const source = {
    get a() {
      omitted.length = 0;
      return 1;
    },
    get b() {
      throw new Error('excluded getter');
    }
  };
  assert.deepEqual(O.omit(source, omitted), { a: 1 });
});

test('merge snapshots each source when reached, including repeated source arguments', () => {
  const later = { b: 2 };
  let reads = 0;
  const first = {
    get a() {
      reads++;
      later.c = reads;
      return reads;
    }
  };
  const result = O.merge(first, later, first);
  assert.deepEqual(result, { a: 2, b: 2, c: 1 });
  assert.equal(reads, 2);
  assert.equal(later.c, 2);
});

for (const method of ['intersect', 'except']) {
  test(`${method}: matching distinguishes absent/inherited/non-enumerable undefined from own data`, () => {
    const other = Object.create({ inherited: undefined });
    Object.defineProperty(other, 'hidden', { value: undefined });
    other.present = undefined;
    const source = { missing: undefined, inherited: undefined, hidden: undefined, present: undefined };
    assert.deepEqual(
      O[method](source, other),
      method === 'intersect' ? { present: undefined } : { missing: undefined, inherited: undefined, hidden: undefined }
    );
  });
  test(`${method}: comparison short-circuits irrelevant source getters`, () => {
    const last = {
      get a() {
        throw new Error('irrelevant getter');
      }
    };
    const first = { a: NaN };
    const deciding = method === 'intersect' ? {} : { a: NaN };
    assert.deepEqual(O[method](first, deciding, last), {});
  });
  test(`${method}: comparison results use the first observed value, not a reread`, () => {
    const retained = {};
    const source = { a: retained };
    const other = {
      get a() {
        source.a = { changed: true };
        return method === 'intersect' ? retained : {};
      }
    };
    const result = O[method](source, other);
    assert.equal(result.a, retained);
    assert.notEqual(source.a, retained);
  });
}

test('record-producing operations preserve null prototypes but normalise foreign native record prototypes', () => {
  const symbol = Symbol('field');
  const reference = {};
  const sources = [
    Object.assign(Object.create(null), { a: reference, [symbol]: reference }),
    Object.assign(vm.runInNewContext('({})'), { a: reference, [symbol]: reference })
  ];
  for (const source of sources) {
    const outputs = [
      O.map(source, (v) => v),
      O.mapKeys(source, (_, k) => k),
      O.filter(source, () => true),
      O.pick(source, ['a', symbol]),
      O.omit(source, []),
      O.merge(source),
      O.intersect(source),
      O.except(source)
    ];
    for (const output of outputs) {
      assert.notEqual(output, source);
      assert.equal(Object.getPrototypeOf(output), Object.getPrototypeOf(source) === null ? null : Object.prototype);
      for (const key of ['a', symbol])
        assert.deepEqual(Object.getOwnPropertyDescriptor(output, key), {
          value: reference,
          writable: true,
          enumerable: true,
          configurable: true
        });
    }
  }
});
