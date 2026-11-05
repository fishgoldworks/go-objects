# go-objects 3.0.1 — performance and verification report

> Historical report for the 3.0.1 development snapshot dated 20 September 2026 in the changelog, compared with the supplied expanded-test 3.0.0 archive. Measurements, hashes, Node 22 requirements, counts and recorded commands below describe that original run. Its scratch evidence directory and obsolete command paths are no longer present in the maintained checkout; this report alone cannot reproduce those missing raw logs.

## Current reproduction guidance

The [testing and maintenance guide](project-testing.md#performance) owns current
comparison commands, including `scripts/test-performance-equivalence.js`, and
temporary output handling. Reproduction needs the matching original baseline
archive; do not substitute a registry version. Current [consumer compatibility](../README.md#runtime-support)
is independent of the original measured environment. No new benchmark was run for
this documentation clarification.

## Original report

### Release scope

Performance-only patch of the supplied `go-objects-3.0.0-expanded-tests.zip`. The 60-function public API, wrapper behaviour, TypeScript contracts, runtime dependency policy and Node 22 minimum are unchanged. All **127 declaration files** are byte-identical to the baseline. Only four runtime implementation files changed: `src/internal/path.js`, `common.js`, `deep.js` and `clone.js`.

The original 970 tests are retained (the package-version fixture now expects 3.0.1). **55 additional tests** produce **1,025 passing Node tests**, with no failures or skips. Five additional checks per browser distribution produce **297 passing Chromium checks**. No package has been published to npm.

Baseline archive SHA-256: `3852e2c5bcb9e924f7fdd2407dad2a86a47803df4d39133b0ec63d2e95ea5658`.

### Changes and preserved contracts

#### 1. Literal deep matchers no longer construct unused paths

Deep search/count/remove/replace operations distinguish a literal matcher from a user predicate. Literal SameValueZero comparisons do not construct an independent callback path for each visited property. `findPath` and `deepFindEntry` still return a fresh path when they find a match. Predicates, replacement callbacks and `shouldDescend` still receive their full independent path arrays, normal arguments and receiver.

For a chain with D links, constructing every prefix path introduces a quadratic sum of path-element copies. The literal-only route removes that work; it does not skip properties, callbacks, cycle detection or maximum-depth checks. A deterministic allocation regression test verifies that paths are created only when a callback/result requires them. These tests failed on the old implementation before the change.

#### 2. Bounded private string-path compilation

Dot-only paths use native delimiter scanning, avoiding the bracket/escape state machine and its closures. Bracket paths retain the complete parser. Both accepted syntax and error positions were compared against the baseline.

A private direct-mapped syntax cache has **256 slots** and accepts strings of at most **256 UTF-16 code units**. It compares the complete string on every hit. Hash collisions only affect hit rate; they cannot substitute another path. Long strings and caller-owned segment arrays are not cached. Exported parser helpers still return independent arrays. Read APIs may reuse private compiled arrays but never expose or mutate them.

The cache contains syntax, not objects, values, descriptors, getters, callback results or mutation permissions. Mutations still validate every unsafe segment. Array paths still use `Array.from(path, keyOf)` so custom iterators, sparse validation and pre-callback snapshots retain their semantics.

A straightforward bounded Map cache and a single-entry alternative were rejected after measuring high-cardinality/multiple-path workloads. The retained cache is not cost-free: the unique-path workload is slower, as disclosed below.

#### 3. Fewer temporary key arrays

`keys` appends enumerable symbols to its local string-key array rather than creating both a filtered symbol array and a concatenated array. It retains the original `Object.keys`/`Object.getOwnPropertySymbols` order and enumerable-symbol checks. Iterating operations still recheck enumerability before reading each property, so earlier getters/callbacks and Proxy traps can remove or hide later properties without inherited reads.

#### 4. Cheaper supported-type classification for cloning

Trusted same-realm constructor identities use direct checks/a lookup instead of repeated `Function.prototype.toString` comparisons. Cross-realm constructors retain the original source-comparison fallback. Object/prototype classifications are not cached: fresh descriptor inspection still observes prototype changes. User constructors are not invoked. Primitive clone calls validate options before returning without allocating graph bookkeeping.

Descriptor preservation, frozen/non-extensible state, cycles, repeated references, Map/Set contents, and buffer/view relationships are unchanged. The patch does not replace descriptor-aware cloning with JSON cloning, spreading or `structuredClone`.

### Benchmark method

- Baseline: supplied expanded-test **3.0.0**, candidate: **3.0.1**.
- **37 deterministic API workloads**, each run in **three fresh Node processes**, with **11 measured samples per implementation per workload per run**.
- Per-variant calibration/warm-up, independent stable fixtures, alternating execution order and a consumed result sink. Natural allocation and garbage collection remain inside measurements; no forced GC.
- Target sample duration: 30 ms. Very fast cases cap iterations at 1,000,000; actual sample durations can therefore be shorter. These are microbenchmarks, not production latency measurements.
- Each run records a median. The table uses the median of those three run medians for each implementation, then divides baseline by candidate. The range reports the three *paired* run ratios. Values above 1× are faster; below 1× are slower.
- An additional **21-sample, 100-ms-target deep-operation run** is retained as a sensitivity check, not substituted for the three-run results.
- Environment: **v22.16.0**, V8 **12.4.254.21-node.26**, Linux x64, **AMD EPYC 9V74 80-Core Processor**, shared execution environment. This is not a cross-library, browser-performance or universal speed comparison.

#### Full results

All times are **microseconds per operation**. `deepClone/500-native-objects` is the historical benchmark identifier for **500 records, each containing a Date and a Map** (1,000 native instances plus the records). The chain scenarios contain 1,000 `next` links followed by a `value` property. The mixed tree visits 1,220 properties.

| Workload | 3.0.0 µs/op | 3.0.1 µs/op | Ratio | Paired-run range |
|---|---:|---:|---:|---:|
| `get/simple-string` | 0.0500 | 0.0191 | 2.62× | 2.58–2.68× |
| `get/repeated-dot-path` | 0.2241 | 0.0489 | 4.58× | 3.95–4.62× |
| `get/repeated-bracket-path` | 0.5142 | 0.0613 | 8.39× | 7.68–8.39× |
| `get/segment-array` | 0.3955 | 0.3868 | 1.02× | 0.99–1.03× |
| `get/4096-rotating-paths` | 0.1902 | 0.2227 | 0.85× | 0.85–0.90× |
| `get/long-uncached-path` | 1.2584 | 0.5920 | 2.13× | 2.12–2.16× |
| `has/repeated-path` | 0.2187 | 0.0417 | 5.25× | 4.97–5.26× |
| `getEach/10-repeated-paths` | 2.0311 | 0.9662 | 2.10× | 2.06–2.16× |
| `set/existing-path` | 0.5085 | 0.2607 | 1.95× | 1.90–1.99× |
| `update/existing-path` | 0.4556 | 0.3052 | 1.49× | 1.49–1.50× |
| `immutable/changed-path` | 2.8335 | 2.3275 | 1.22× | 1.17–1.23× |
| `immutable/no-op-path` | 0.3745 | 0.1831 | 2.05× | 2.05–2.09× |
| `keys/4-properties` | 0.1618 | 0.0666 | 2.43× | 2.39–2.43× |
| `keys/1000-properties` | 3.3128 | 2.7548 | 1.20× | 1.15–1.20× |
| `keys/1000-properties-20-symbols` | 4.9853 | 5.0195 | 0.99× | 0.94–1.00× |
| `map/1000-properties` | 566.5740 | 565.3291 | 1.00× | 1.00–1.05× |
| `filter/1000-properties` | 261.9662 | 256.1000 | 1.02× | 0.92–1.02× |
| `merge/1000-overlapping-properties` | 885.8119 | 902.4288 | 0.98× | 0.98–1.03× |
| `count/1000-literal-matches` | 91.9456 | 86.6017 | 1.06× | 1.02–1.06× |
| `some/1000-properties-no-match` | 89.8981 | 86.4112 | 1.04× | 1.01–1.04× |
| `findEntry/first-of-1000` | 4.3549 | 3.2201 | 1.35× | 1.30–1.43× |
| `intersect/1000-properties` | 699.1735 | 712.5750 | 0.98× | 0.98–0.99× |
| `deepFind/1000-depth-literal` | 3684.0051 | 152.9024 | 24.09× | 15.50–24.20× |
| `deepFind/1000-depth-predicate` | 3636.7109 | 3478.0882 | 1.05× | 0.65–1.05× |
| `deepCount/tree-literal` | 165.5755 | 104.2567 | 1.59× | 1.57–2.20× |
| `deepRemoveAll/1000-depth-no-match` | 3726.9854 | 159.9820 | 23.30× | 15.16–24.04× |
| `deepMap/tree-identity` | 416.4778 | 343.7348 | 1.21× | 1.20–1.23× |
| `deepMapKeys/preserve-300-rows` | 355.0379 | 307.4202 | 1.15× | 1.12–1.15× |
| `clone/number` | 0.0469 | 0.0190 | 2.46× | 2.42–2.53× |
| `clone/1000-properties` | 518.2811 | 523.8053 | 0.99× | 0.99–1.00× |
| `deepClone/2000-child-records` | 1894.8221 | 1957.8534 | 0.97× | 0.97–1.01× |
| `deepClone/2000-shared-references` | 856.2771 | 858.5049 | 1.00× | 1.00–1.00× |
| `deepClone/2000-depth` | 963.6053 | 962.5571 | 1.00× | 0.99–1.00× |
| `deepClone/500-arrays` | 958.5696 | 749.0444 | 1.28× | 1.28–1.30× |
| `deepClone/500-native-objects` | 1170.6280 | 869.8812 | 1.35× | 1.32–1.38× |
| `deepClone/16KiB-view` | 1232.8730 | 1233.1351 | 1.00× | 0.99–1.05× |
| `wrapper/get-path` | 0.2376 | 0.0654 | 3.64× | 3.54–3.65× |

#### What these results do and do not show

Repeated dotted and bracket path lookups, small-object key enumeration, literal deep searches, and the array/native-instance clone workloads show the clearest gains. The largest literal-chain gains ranged roughly **15–24×** across the three runs; the aggregate for `deepFind` is about **24×**.

**Trade-off:** cycling through 4,096 different short paths produced about **17% higher aggregate time** (0.1902 → 0.2227 µs/op), with paired-run slowdowns of about 10–17%. Cache lookup/admission has a cost when reuse is low. The full results retain this regression rather than reporting only cache hits.

Plain-record/alias/buffer cloning and many large shallow operations were approximately unchanged. Differences of a few percent on this host should not be treated as established gains. Filtering and symbol-heavy enumeration varied across runs.

The deep **predicate** workload had paired ratios from **0.65× to 1.05×**, including a run where the baseline was considerably faster. The separate longer-sample run measured approximately 1.05×, but does not erase the slower run. No stable predicate speedup is claimed. Callback path construction is deliberately retained for correctness. Real applications should benchmark their own callback shapes, input mix and engine.

### Correctness and packaging verification

| Check | Result |
|---|---|
| Complete Node suite | **1,025 passed; 0 failed; 0 skipped** |
| Existing fixed-seed model cases | **1,500 retained** inside the existing generated tests |
| New differential path corpus | **40,000 paths**; **80,000 parser/error comparisons** and **75,789 read-API comparisons** matched baseline |
| Deliberate-fault checks | **33/33 detected**, in disposable copies |
| Strict installed-package TypeScript configurations | **5 passed**: NodeNext, Node16, Bundler, legacy CommonJS, UMD global |
| Emitted TypeScript runtime regression fixture | Passed |
| Runtime line / branch / function coverage | **100% / 99.77% / 100%** |
| Coverage gates | Unchanged: 100% lines, ≥99% branches, 100% functions; no new ignore annotations |
| Browser execution | **297 passed; 0 failed**, Chromium **144.0.7559.96** |
| Distribution coverage | Actual UMD, standalone ESM and static ESM graph |
| Deterministic regeneration | **134 generated files identical** |
| Full `npm pack` prepack lifecycle | Build, Node suite and installed-consumer type checks passed |
| Final package installation | Passed offline with no runtime dependencies |
| Final public import checks | **360 subpath imports**, across 60 utilities × three paths × two module formats |
| Packed bytes compared with source | **All 271 files match** |
| Declarations compared with baseline | **All 127 files unchanged** |

The additional tests cover allocation expectations, literal NaN/signed-zero/object matching, callback path independence, updater paths, repeated getters, root/ownership changes, reentrant reads, mutable/custom-iterator paths, full batch parsing, cache churn and collisions, malformed/unsafe paths, Proxy trap order, hidden symbols, prototype-constructor changes and primitive clone-option validation. Two new deliberate mutations expose cached arrays or bypass full-string comparisons; both are detected. Existing deliberate faults remain checked, with the key-enumeration mutation anchor adjusted to the equivalent new code.

During release verification, the old package test's hard-coded 3.0.0 expectation correctly failed after the version bump. Its expected release version was updated to 3.0.1 and the full verification rerun passed. No semantic test was removed to obtain a passing result.

#### Verification limits

Fresh development dependency installation was attempted both offline and online. Offline installation could not find the pinned compiler in npm's cache (`ENOTCACHED`); online installation failed resolving the npm registry (`EAI_AGAIN`). Builds and type checks used the **preinstalled exact TypeScript 5.8.3**. Final runtime-package installation and installed-consumer type testing did succeed offline.

Browser execution used actual source/bundles loaded offline, with static import specifiers rewritten to Blob URLs. **HTTP delivery, CSP configurations, Firefox and Safari were not verified.** Browser tests establish correctness checks, not browser speed measurements. The optional esbuild tree-shaking check was attempted but could not run because esbuild is not installed; no new tree-shaking or bundle-size claim is made.

Finite tests and microbenchmarks do not prove every possible JavaScript/Proxy/callback interaction. This patch preserves the existing contract and tested behaviour rather than declaring universal completeness or speedups.

### Reproduction

After installing the existing pinned development dependency:

```sh
npm run verify
npm run test:mutations
npm run bench
node scripts/benchmark-compare.js /path/to/3.0.0/go-objects . results.json
node scripts/check-performance-equivalence.js /path/to/3.0.0/go-objects equivalence.json
```

The comparison accepts `BENCH_SAMPLES`, `BENCH_MS` and `BENCH_FILTER`. To reproduce a sensitivity run on Linux/macOS:

```sh
BENCH_SAMPLES=21 BENCH_MS=100 BENCH_FILTER='deepFind|deepRemoveAll|deepCount' node scripts/benchmark-compare.js /path/to/3.0.0/go-objects . deep-results.json
```

The source release includes raw measurements and verification logs in `docs/performance-evidence/`, plus the full regression suite and benchmark definitions. Obtain the matching baseline from the previous expanded-test ZIP; it is not silently substituted with a registry package.

### Artifact

- Installable package: `go-objects-3.0.1.tgz`
- Packed size: **85,691 bytes**
- Tarball SHA-256: `dba58fc2eb5e55dca53a7a2218d500e58107e06ff1e8fbeee96c06a491bbb25a`
- Public API: 60 utilities, no new runtime dependencies, no declaration/API migration from 3.0.0.
- Nothing published to npm.
