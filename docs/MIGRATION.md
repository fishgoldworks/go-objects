# Migration guide

[← Back to README](../README.md)

[Full API documentation](API.md) · [Changelog](../CHANGELOG.md)

## 0.0.1 to 3.0.8

Version `0.0.1` is the published upgrade baseline. Its npm archive contains an `index.js` that requires the missing `src/Functions`; the included `src/Objects.js` also requires a missing `Types` module. If your application uses a repaired or vendored copy, compare its actual behaviour with the current [API contracts](API.md). The current package is a substantial API replacement, not a drop-in repair of that source.

The earlier `2.x` and `3.0.x` entries in this checkout described unpublished development snapshots. They are consolidated in the current changelog; changes relevant to users of those snapshots are covered below without implying separate published releases.

### Imports and runtime support

Load the callable namespace through `require('go-objects')`, use named/default ESM imports, or import a documented function such as `go-objects/get`. Replace direct imports of `src/Objects.js`; it is not a current public entry. CommonJS and ESM are separate implementations, so do not compare their functions or wrappers by reference or `instanceof` across formats.

CommonJS requires Node.js 8.0.0 or later. Native ESM requires Node.js 12.17.0+ within 12.x, or 13.7.0 or later. TypeScript requires 5.3.3 or later. See the [runtime support table](../README.md#runtime-support) for browser and optional-feature requirements; contributor tooling has a separate, newer Node requirement.

### Replace old helper names deliberately

These are migration routes, not aliases with identical semantics:

| Previous source API                                                               | Current approach                                                                                                                                                                                       |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `getValue(object, path, fallback)`                                                | Use `get`; it reads only own path steps and preserves `null`.                                                                                                                                          |
| `setValue(object, path, value)`                                                   | Use `set`; it returns the previous value, validates paths and rejects unsafe writes.                                                                                                                   |
| `hasProperty(object, path)`                                                       | Use `has` for an own path. Use `hasKey` for an own enumerable direct key, or `hasProp` for any own direct property.                                                                                    |
| `deleteProperty(object, path)`                                                    | Use `unset`; check its boolean result contract and array-hole behaviour.                                                                                                                               |
| `getPathSegments`, `parsePropertyPath`                                            | Pass a supported string path or explicit key array directly to a path utility. Malformed strings now fail rather than being partially parsed.                                                          |
| `getProperty`, `getProperties`, `defineProperty`, `defineProperties`              | Use native descriptor APIs with explicit ownership and traversal decisions. `getEach` returns values, not descriptors.                                                                                 |
| `assign`, `deepMerge`                                                             | `merge` creates a new shallow result. It does not mutate a target or recursively merge nested objects. Choose recursive merging explicitly elsewhere if needed.                                        |
| Equality, JSON conversion, validation, inheritance and circular-reference helpers | These are outside the current object-utility API. Use suitable native operations or a separately selected implementation; do not substitute similarly named functions without checking their contract. |
| Deep intersection/exception and key-specific variants                             | Review the current shallow `intersect`/`except` and literal-key `pick`/`omit` contracts. No recursive compatibility aliases are supplied.                                                              |

<!-- prettier-ignore -->
```javascript
const Objects = require('go-objects');
const account = { profile: { name: 'Michael' } };

Objects.get(account, 'profile.name');              // => 'Michael'
Objects.set(account, 'profile.name', 'Updated');   // => 'Michael'
Objects.has(account, 'profile.name');              // => true
Objects.unset(account, 'profile.name');            // => true
```

### Check iteration, matching and mutation

Collection utilities use own enumerable string and symbol keys. They exclude inherited properties that the old source's `for...in` loops could visit. Literal matching uses SameValueZero, including `NaN`; object literals match by identity, and a function matcher is always a predicate. Callbacks run synchronously. Consult each API entry for its arguments, receiver and return value.

Mutating paths reject prototype-sensitive segments, intermediate accessors and invalid containers. Supply required arguments explicitly, including `undefined` when that is the intended value or matcher. Array deletion leaves a hole; array filtering compacts elements. A later write failure can leave earlier writes applied. Use immutable helpers for changes that should leave the input untouched, while recognising that they copy only the edited path and retain off-path aliases.

Cloning preserves supported graph references, cycles, descriptors and backing-buffer relationships. Unsupported classes, altered native prototypes and some proxies remain opaque references by default, or throw under the strict unsupported-value policy. Custom-tagged Errors also follow that policy. Review [cloning contracts](API.md#shallow-and-deep-cloning-1) before relying on clone isolation.

### Retain fluent results

Each fluent operation returns a fresh wrapper. Ignoring that result leaves the original wrapper at its previous pipeline value; explicit mutation still changes shared input data.

<!-- prettier-ignore -->
```javascript
const Objects = require('go-objects');
const original = Objects({ name: 'Michael' });
const names = original.keys();
original.unwrap();             // => { name: 'Michael' }
names.unwrap();                // => ['name']
```

### Check declaration assumptions

Declarations describe ordinary data shapes; they cannot establish ownership, enumerability or freedom from callback side effects. Mutable operations reject schema-invalidating writes, deletion of required fields and unsafe dynamic paths on known schemas. Prefer known segment tuples or immutable operations for deliberate schema changes; casting away a check does not make an object safe when other code retains a precise alias.

`hasKey` and `hasProp` return plain booleans. Users of earlier development snapshots must replace automatic narrowing with explicit object, key and value checks:

```typescript
import Objects from 'go-objects';
const input: unknown = { id: 42 };
if (
  typeof input === 'object' &&
  input !== null &&
  Objects.hasProp(input, 'id') &&
  'id' in input &&
  typeof input.id === 'number'
) {
  input.id.toFixed(0);
}
```

Immutable results retain readonly/optional constraints and account for dictionary domains, unions and nested deletion through arrays. Narrow a possibly deleted field before reading it. Matcher and replacement callbacks must accept every value the operation can visit; deep callbacks accept `unknown`. User-supplied type predicates still narrow supported search/filter results. Automatic inferred predicates require TypeScript 5.5 or later; write an explicit predicate on older supported compilers.

### Licence

The current package is MIT and includes `LICENSE.md`. The published `0.0.1` archive has LGPL metadata/licence text and a different source-header notice. The current licence does not rewrite those historical bytes; retain relevant notices for any old code you continue to distribute.
