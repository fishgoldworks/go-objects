# go-objects design and compatibility

This guide records library-specific implementation decisions. The [full API reference](API.md) owns complete public contracts; the [README](../README.md) gives the overview and starting examples. The [testing and maintenance guide](project-testing.md) owns contributor workflows, and [package.json](../package.json) owns exact commands. The shared Fishgold engineering playbook is a reference, not a dependency.

## Ownership and formats

CommonJS in `src/` is canonical. Thin public utility facades delegate to collection, path, immutable, traversal, deep-transform and clone internals. The callable `ObjectWrapper` owns fluent pipeline bookkeeping; each operation returns a fresh wrapper. Mutations still affect the underlying data.

The TypeScript AST converter produces a static ESM graph and standalone UMD/ESM bundles. CommonJS and ESM have separate function identities. Root ESM imports instantiate the root graph in native Node; function subpaths minimise native loading. Bundlers can remove unused implementations from root named imports. The compiler already serves generation and declaration testing, so no additional parser is needed. Terser produces readable/minified script bundles and maps from the lowered ES2017 source. Mapped code is written unchanged so stack positions stay valid.

The converter targets this library's static, acyclic module graph; it is not a general CommonJS loader. Standalone bundle bodies are derived from parsed export-statement ranges, so export-like lines inside strings/templates remain data. A dependency's actual export shape determines whether a `require` becomes a default or namespace import, independently of its local binding syntax. The direct `module.exports = require(...).member` shortcut accepts only that export plus string directives, comments and empty statements. Adding executable statements to such a facade now fails explicitly rather than silently discarding them; use an already-supported explicit module form and add format-equivalence tests for new source constructs. External dependencies, source-tree escapes, dynamic specifiers and dependency cycles remain unsupported.

Internal modules and `ObjectWrapper` subpaths remain private. The public root and per-function import forms are protected by installed-package tests. Runtime dependencies remain empty; CommonJS consumers support Node 8.0.0 and later; native ESM supports Node 13.7.0 or later, or 12.17.0+ within 12.x. Development tooling requires Node >=22.16.0 and uses the pinned TypeScript compiler. Canonical source stays in `src/`; the complete generated `package/` contains ES2017-compatible runtime files and physical short CommonJS entries. Optional native constructors are registered only when present.

## Accepted boundaries

- Record-only checks accept null prototypes and genuine native `Object.prototype` identities across realms, not custom prototypes advertising a native constructor. Shallow inspection remains available for other object shapes.
- Collections observe own enumerable string/symbol keys. Read callbacks and Proxy traps remain observable; no callback or Proxy sandbox is promised.
- Deep traversal expands each shared/cyclic container once. Path-sensitive redaction across aliases is not a security boundary. `deepFilter` prunes branches, and cutoff branches retain original references.
- Immutable paths copy only the addressed ancestors. Off-path aliases/cycles retain original references; this is structural sharing, not graph cloning. Supported cross-realm/null prototypes and descriptors are preserved; copied data descriptors become writable/configurable. Accessor paths, unsafe prototype-sensitive keys and array `length` mutation are rejected.
- Mutable multi-property operations may retain earlier writes when a later operation fails. Validation is not transactional rollback.
- Cloning preserves supported graph aliases, descriptors and backing-buffer relationships. Unsupported classes, unusual native prototypes and proxies are opaque by default or throw in strict mode. Detached-buffer failures propagate. Error branding remains conservative where JavaScript supplies no unspoofable brand operation.
- Declarations describe ordinary data shapes, not runtime ownership, enumerability, plain-object identity or callback side effects. Dynamic parsed paths remain runtime-validated. Known schema mutations are conservative; a type-erased data boundary does not make precise aliases safe to mutate.
- The private string-path cache has bounded storage and retains syntax only. It never caches targets or resolved values. Cache misses materialise short strings before storing them or parsing retained segments, so a short slice does not intentionally keep a large source string alive. Repeated short paths benefit; cold/high-cardinality workloads need independent measurement.

## Maintenance decisions

Builds stage all generated outputs, validate every format in a fresh process, then replace them sequentially. A replacement failure restores all touched outputs; an unrestorable backup is retained and its location reported. This guards failed builds, not simultaneous builds or process termination during replacement. Run one build per checkout at a time. Generated declarations are owned by the build; authored declarations remain in `types/` and root entry files.

Reopen a behaviour review when its implementation, dependencies, public contract or supported environment changes, or a reproducible counterexample appears. Old passing reports are historical evidence, not continuing clearance. The retained [performance report](PERFORMANCE.md) explains the historical optimisation decisions and measurements; the [testing guide](project-testing.md#performance) owns current reproduction commands. Completed scratch reports and plans are disposable.
