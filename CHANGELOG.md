# Changelog

## 3.0.8

### Breaking changes

- Replaced the incomplete `0.0.1` package with the callable `Objects` namespace and 60 documented utilities. The old `getValue`, `setValue`, descriptor, validation, equality and recursive-merge surfaces are not compatibility aliases. See the [migration guide](docs/MIGRATION.md).
- Defined own-property traversal, enumerable string/symbol collection keys, SameValueZero literal matching and explicit mutation returns. Inherited properties are excluded; unsafe mutation paths, accessors and invalid arguments are rejected.
- Established CommonJS support from Node.js 8.0.0, native ESM from Node.js 12.17.0 within 12.x or 13.7.0 onwards, and TypeScript declarations from 5.3.3. CommonJS and ESM have separate implementation identities.
- Licensed the current library under MIT. Historical `0.0.1` metadata and source carried different licence notices; this entry does not change that published archive.

### Added

- Added direct function imports with named and default ESM exports, native ESM, readable/minified browser bundles, source maps and TypeScript declarations.
- Added immutable path updates with structural sharing, deep entry searches, array-preserving key mapping and fluent wrappers that return a fresh wrapper after each operation.
- Added complete API documentation, executable examples and installed-package checks across loaders, runtimes, compiler modes and browser engines.

### Fixed

- Repaired missing exports and helpers, inconsistent ownership checks, graph/descriptor cloning, cyclic traversal, mutable and immutable path handling, and conservative TypeScript mutation/deletion inference.
- Preserved callable browser host values, cross-realm/native prototype boundaries, inherited Error-tag handling and fresh wrapper factory calls.
- Bounded retained path-cache strings so short slices do not keep large caller strings alive.
- Corrected browser source maps by lowering syntax before bundle generation; final mapped code is written unchanged.

### Maintenance

- Generated one self-contained consumer package with an explicit publication allowlist, private-root guards, staged replacement and failure recovery.
- Excluded local `temp` and `.tmp` experiments at every depth from maintained inputs and validation discovery without deleting their contents.
- Added exact-version README script-tag delivery checks against the candidate, alongside readable/minified browser contracts.
- Consolidated unpublished development versions `2.0.0` through `3.0.8` into this entry. Those labels described review snapshots, not npm releases; retained performance reports identify their original measurement baselines.

## 0.0.1 — 2022-08-02

### Added

- Published the original npm package with `src/Objects.js` and its tests.

### Known limitations

- The archive's root entry requires the absent `src/Functions` module. Loading `src/Objects.js` directly also requires an absent `Types` module. The published archive cannot load through either path without local repairs.
