import Objects = require('go-objects');
import get = require('go-objects/get');
const copy = Objects.deepClone({ a: { value: 42 } });
if (get(copy, ['a', 'value'] as const) !== 42) throw Error('compiled CommonJS consumer failed');
console.log('TypeScript CommonJS consumer passed');

import MinifiedObjects = require('go-objects/dist/go-objects.min.js');
const minifiedCopy = MinifiedObjects.deepClone({ a: { value: 42 } });
if (MinifiedObjects.get(minifiedCopy, ['a', 'value'] as const) !== 42)
  throw Error('compiled minified CommonJS consumer failed');
