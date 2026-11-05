import Objects, { get } from 'go-objects';
import deepClone from 'go-objects/deepClone';
const copy = deepClone({ a: { value: 42 } });
if (get(copy, ['a', 'value'] as const) !== 42 || Objects.get !== get) throw Error('compiled ESM consumer failed');
console.log('TypeScript ESM consumer passed');
