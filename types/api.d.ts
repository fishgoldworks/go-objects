// Defer inference to the input that owns the type, including on TypeScript 5.3.
// Keep callback and mutation rejection fixtures when changing this helper.
type NoInfer<T> = [T][T extends unknown ? 0 : never];

/** Types describe ordinary data records, not ownership/enumerability or side effects.
 * Dynamic paths and deliberately type-erased data use conservative fallbacks. */
export type Key = string | number | symbol;
export type Path = Key | readonly Key[];
export type RuntimeKey<K> = K extends number ? `${K}` : K extends string | symbol ? K : never;
export type Mutable<T> = { -readonly [K in keyof T]: T[K] };
type Simplify<T> = { [K in keyof T]: T[K] };
type ArrayExtra<T> = Exclude<keyof T, keyof (readonly unknown[]) | keyof unknown[]>;
export type OwnKey<T> = T extends readonly unknown[]
  ? `${number}` | RuntimeKey<ArrayExtra<T>>
  : T extends object
    ? RuntimeKey<keyof T>
    : string | symbol;
export type Value<T> = T extends readonly (infer V)[] ? V | T[ArrayExtra<T>] : T extends object ? T[keyof T] : unknown;
export type Callback<T extends object, R> = (this: T, value: Value<T>, key: OwnKey<T>, object: T) => R;
export type Predicate<T extends object> = Callback<T, unknown>;
export type Guard<T extends object, S extends Value<T>> = (
  this: T,
  value: Value<T>,
  key: OwnKey<T>,
  object: T
) => value is S;
type Primitive = string | number | bigint | symbol | boolean | null | undefined;
// Infer literal values separately so functions cannot bypass callback checking via object.
export type Matcher<T extends object, M = never> = Predicate<T> | (M & NonFunction<M>) | Primitive;
export type DeepCallback<R> = (
  this: object,
  value: unknown,
  key: string | symbol,
  parent: object,
  path: (string | symbol)[]
) => R;
export type DeepGuard<S> = (
  this: object,
  value: unknown,
  key: string | symbol,
  parent: object,
  path: (string | symbol)[]
) => value is S;
export type DeepMatcher<M = never> = DeepCallback<unknown> | (M & NonFunction<M>) | Primitive;
export interface CloneOptions {
  unsupported?: 'reference' | 'throw';
}
export interface TraversalOptions {
  maxDepth?: number;
  shouldDescend?: (
    this: object,
    value: object,
    key: string | symbol,
    parent: object,
    path: (string | symbol)[]
  ) => unknown;
}
export interface MapKeysOptions {
  onCollision?: 'overwrite' | 'throw';
}
export interface DeepMapKeysOptions extends TraversalOptions, MapKeysOptions {
  arrays?: 'record' | 'preserve';
}
export type Mapped<T, R> = T extends readonly unknown[] ? R[] : { -readonly [K in keyof T]: R };
export type Filtered<T, S = Value<T>> = T extends readonly unknown[]
  ? (Value<T> & S)[]
  : { -readonly [K in keyof T as [T[K] & S] extends [never] ? never : K]?: T[K] & S };
export type RecordShape<T> = T extends readonly (infer V)[]
  ? number extends T['length']
    ? { [key: `${number}`]: V } & Pick<Mutable<T>, ArrayExtra<T>>
    : Pick<Mutable<T>, ArrayExtra<T>>
  : Mutable<T>;
type ResolvedKey<T, K> = K extends keyof T
  ? K
  : K extends number
    ? `${K}` extends keyof T
      ? `${K}`
      : never
    : K extends `${infer N extends number}`
      ? N extends keyof T
        ? N
        : never
      : never;
type DynamicKeys<K> = string extends K ? true : number extends K ? true : symbol extends K ? true : false;
type IsUnion<T, Whole = T> = T extends Whole ? ([Whole] extends [T] ? false : true) : never;
type SingletonKey<K> = K extends Key
  ? true extends IsUnion<K>
    ? never
    : DynamicKeys<K> extends true
      ? never
      : K
  : never;
type OneKey<K> = true extends IsUnion<K> ? never : SingletonKey<K>;
type KeyList = readonly (Key | undefined)[];
type ValidKeyList<K extends KeyList> = K extends readonly [infer H, ...infer R extends KeyList]
  ? [H] extends [Key]
    ? ValidKeyList<R>
    : never
  : number extends K['length']
    ? K extends readonly Key[]
      ? unknown
      : never
    : unknown;
type CertainKeys<K extends KeyList> = K extends readonly [infer H, ...infer R extends KeyList]
  ? OneKey<H> | CertainKeys<R>
  : never;
type PossibleKeys<T, K extends KeyList> =
  DynamicKeys<Exclude<K[number], undefined>> extends true ? keyof T : ResolvedKey<T, Exclude<K[number], undefined>>;
// Selection proves which keys are requested, not that an indexed entry exists.
// Resolve guaranteed keys against declared required properties, without index signatures.
type RequiredSelectionSource<T> = Pick<T, RequiredKeys<T> & keyof T>;
export type Picked<T, K extends KeyList> = T extends unknown
  ? Simplify<
      Pick<
        RequiredSelectionSource<RecordShape<T>>,
        ResolvedKey<RequiredSelectionSource<RecordShape<T>>, CertainKeys<K>>
      > &
        Partial<Pick<RecordShape<T>, PossibleKeys<RecordShape<T>, K>>>
    >
  : never;
export type Omitted<T, K extends KeyList> = Simplify<
  Omit<RecordShape<T>, PossibleKeys<RecordShape<T>, K>> &
    Partial<Pick<RecordShape<T>, Exclude<PossibleKeys<RecordShape<T>, K>, ResolvedKey<RecordShape<T>, CertainKeys<K>>>>>
>;
export type Renamed<T, K extends Key> = Partial<Record<RuntimeKey<K>, Value<T>>>;
export type Entry<T, S = Value<T>> = T extends readonly unknown[]
  ? [OwnKey<T>, Value<T> & S]
  : T extends object
    ? { [K in keyof T]-?: [T[K] & S] extends [never] ? never : [RuntimeKey<K>, T[K] & S] }[keyof T]
    : [string | symbol, unknown];
type PropertyValue<T, K extends Key> = T extends null | undefined
  ? undefined
  : [ResolvedKey<T, K>] extends [never]
    ? unknown
    : T[ResolvedKey<T, K>];
export type PathValue<T, P extends Path> = P extends readonly []
  ? T
  : P extends readonly [infer H extends Key, ...infer Rest extends Key[]]
    ? PathValue<PropertyValue<T, H>, Rest>
    : P extends readonly Key[]
      ? unknown
      : P extends string
        ? [SimplePath<P>] extends [never]
          ? unknown
          : PropertyValue<T, P>
        : P extends Key
          ? PropertyValue<T, P>
          : unknown;
export type GetResult<T, P extends Path, D = undefined> = P extends readonly []
  ? T
  : Exclude<PathValue<T, P>, undefined> | D;
export type PathResults<T, P extends readonly Path[], D = undefined> = {
  -readonly [K in keyof P]: GetResult<T, P[K], D>;
};
type IntersectParameters<F> = [F] extends [never] ? never : [F] extends [(value: infer V) => void] ? V : never;
// Inspect every union member: disjoint known keys are not an erased schema.
type TypedKeys<T> = T extends unknown
  ? keyof { [K in keyof RecordShape<T> as unknown extends RecordShape<T>[K] ? never : K]: RecordShape<T>[K] }
  : never;
type IsDynamicData<T> = [TypedKeys<T>] extends [never] ? true : false;
type DynamicInput<T> = IsDynamicData<T> extends true ? T : never;
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Empty structural assignability detects optional keys or index signatures.
type RequiredKeys<T> = T extends unknown ? keyof { [K in keyof T as {} extends Pick<T, K> ? never : K]: T[K] } : never;
// A read can include absence; a write must satisfy the present-property type.
type OptionalAllowsUndefined = { value: undefined } extends { value?: never } ? true : false;
type PresentValue<T, K extends keyof T> = OptionalAllowsUndefined extends true ? T[K] : Required<Pick<T, K>>[K];
type DeletableInput<T> = [RequiredKeys<RecordShape<T>>] extends [never] ? T : never;
// Open key domains (including template patterns) do not identify a single slot.
// Distribute before testing so a finite key cannot conceal an open union member.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Empty assignability distinguishes index domains from required literal keys.
type OpenKey<K extends Key> = K extends unknown ? ({} extends Record<K, never> ? true : false) : never;
type SimplePath<P> = P extends string
  ? true extends OpenKey<P>
    ? never
    : P extends `${string}.${string}` | `${string}[${string}` | `${string}]${string}`
      ? never
      : P
  : P extends number
    ? true extends OpenKey<P>
      ? never
      : P
    : P extends symbol
      ? symbol extends P
        ? never
        : P
      : never;
// Missing intermediates are created, not validated against a schema. Reject a
// typed write when the newly created branch could omit other required fields.
// Prove common literal indices without pretending to parse every dynamic key.
// Ambiguous/very large numeric keys keep both possible runtime container shapes.
type ShortIndexText<S extends string, Seen extends 0[] = []> = S extends ''
  ? true
  : Seen['length'] extends 9
    ? boolean
    : // eslint-disable-next-line @typescript-eslint/no-unused-vars -- The first inferred character is consumed only to recurse on the remaining tail.
      S extends `${infer Head}${infer Tail}`
      ? ShortIndexText<Tail, [...Seen, 0]>
      : boolean;
type KnownIndex<K extends Key> = K extends symbol
  ? false
  : K extends string | number
    ? `${K}` extends '0'
      ? true
      : `${K}` extends `0${string}` | `-${string}`
        ? false
        : `${K}` extends `${bigint}`
          ? ShortIndexText<`${K}`>
          : DynamicKeys<K> extends true
            ? boolean
            : false
    : false;
type FreshContainer<K extends Key, V> =
  KnownIndex<K> extends true ? V[] : KnownIndex<K> extends false ? Record<K, V> : V[] | Record<K, V>;
type FreshBranch<P extends readonly Key[], V> = P extends readonly [infer H extends Key, ...infer R extends Key[]]
  ? FreshContainer<H, FreshBranch<R, V>>
  : V;
type MayBeAbsent<T, K extends keyof T> = undefined extends T[K]
  ? true
  : T extends readonly unknown[]
    ? number extends T['length']
      ? true
      : false
    : string extends keyof T
      ? true
      : number extends keyof T
        ? true
        : symbol extends keyof T
          ? true
          : // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Empty structural assignability detects optional keys or index signatures.
            {} extends Pick<T, K>
            ? true
            : false;
type ChildWrite<T, K extends keyof T, R extends Key[]> =
  MayBeAbsent<T, K> extends true
    ? [FreshBranch<R, IntersectParameters<WriteCandidates<NonNullable<T[K]>, R>>>] extends [NonNullable<T[K]>]
      ? WriteCandidates<NonNullable<T[K]>, R>
      : (v: never) => void
    : WriteCandidates<T[K], R>;
type WriteCandidates<T, P extends Path> = T extends null | undefined
  ? never
  : T extends unknown
    ? WriteCandidate<NonNullable<T>, P>
    : never;
type WriteCandidate<T, P extends Path> = P extends readonly [infer H extends Key, ...infer R extends Key[]]
  ? H extends unknown
    ? [ResolvedKey<NonNullable<T>, H>] extends [never]
      ? (v: never) => void
      : R extends []
        ? (v: PresentValue<NonNullable<T>, ResolvedKey<NonNullable<T>, H>>) => void
        : ChildWrite<NonNullable<T>, ResolvedKey<NonNullable<T>, H>, R>
    : never
  : P extends Key
    ? [SimplePath<P>] extends [never]
      ? (v: never) => void
      : [ResolvedKey<NonNullable<T>, P>] extends [never]
        ? (v: never) => void
        : (v: PresentValue<NonNullable<T>, ResolvedKey<NonNullable<T>, P>>) => void
    : (v: never) => void;
export type WriteValue<T, P extends Path> =
  IsDynamicData<T> extends true ? unknown : IntersectParameters<WriteCandidates<T, P>>;
export type BatchValue<T, P extends readonly Path[]> = P extends readonly [] ? unknown : WriteValue<T, P[number]>;
type CanDelete<T, P extends Path> = T extends null | undefined
  ? true
  : T extends unknown
    ? CanDeleteCandidate<T, P>
    : never;
// A non-literal segment can overlap a declared key without extending keyof T.
// Inspect possible runtime-key intersections, including numeric/string aliases.
type PossibleDeleteKeys<T, K extends Key> = keyof {
  [Q in keyof T as [RuntimeKey<Q> & RuntimeKey<K>] extends [never] ? never : Q]: unknown;
};
type CanDeleteKey<T, K extends Key> = [PossibleDeleteKeys<Pick<T, RequiredKeys<T> & keyof T>, K>] extends [never]
  ? true
  : false;
// Keep explicitly declared children separate from a broad indexer's value
// union: a named child can have stricter required fields than that indexer.
type DeclaredDeleteShape<T> = { [Q in keyof T as true extends OpenKey<Q> ? never : Q]: T[Q] };
type CanDeleteCandidate<T, P extends Path> = P extends readonly [infer H extends Key, ...infer R extends Key[]]
  ? R extends []
    ? CanDeleteKey<T, H>
    : [PossibleDeleteKeys<T, H>] extends [never]
      ? true
      : | CanDelete<T[PossibleDeleteKeys<T, H> & keyof T], R>
        | CanDelete<
            DeclaredDeleteShape<T>[PossibleDeleteKeys<DeclaredDeleteShape<T>, H> & keyof DeclaredDeleteShape<T>],
            R
          >
  : P extends Key
    ? [SimplePath<P>] extends [never]
      ? false
      : CanDeleteKey<T, P>
    : false;
type DeletePath<T, P extends Path> = IsDynamicData<T> extends true ? P : false extends CanDelete<T, P> ? never : P;
type ReplacementCandidates<T, S> = T extends unknown
  ? {
      [K in keyof RecordShape<T>]-?: [RecordShape<T>[K] & S] extends [never]
        ? never
        : (value: PresentValue<RecordShape<T>, K>) => void;
    }[keyof RecordShape<T>]
  : never;
type ReplacementValue<T, S = Value<T>> = IntersectParameters<ReplacementCandidates<T, S>>;
export type Replacement<T extends object, S = Value<T>, V = never> =
  | (((V & NonFunction<V>) | Primitive) & NoInfer<ReplacementValue<T, S>>)
  | NoInfer<(this: T, value: Value<T> & S, key: OwnKey<T>, object: T) => ReplacementValue<T, S>>;
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- This conditional excludes every callable or constructor value, regardless of signature.
type NonFunction<T> = T extends Function ? never : T;
type UnionKeys<T> = T extends unknown ? keyof T : never;
type UnionValue<T, K> = T extends unknown ? (K extends keyof T ? T[K] : never) : never;
type UnionRecord<T> = { [K in UnionKeys<T>]?: UnionValue<T, K> };
type ValueAt<T, K> = K extends keyof T ? PresentValue<T, K> : never;
// Numeric keys and their canonical string spellings denote one runtime slot.
// Keep broad numeric indexers numeric so index-domain checks stay conservative.
type MergeKey<K> = K extends number ? (number extends K ? number : `${K}`) : K;
type MergeShape<T> = T extends object
  ? { -readonly [K in keyof RecordShape<T> as MergeKey<K>]: RecordShape<T>[K] }
  : never;
// Covers string/number/symbol AND template-literal index signatures. Optional
// named properties are not indexers: Record<"field", never> still requires field.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Empty structural assignability detects optional keys or index signatures.
type IndexKeys<T> = { [K in keyof T]-?: {} extends Record<K, never> ? K : never }[keyof T];
type HasIndex<T> = [IndexKeys<T>] extends [never] ? false : true;
type MergePair<A, B> = A extends unknown
  ? B extends unknown
    ? true extends HasIndex<A> | HasIndex<B>
      ? Partial<Record<keyof A | keyof B, Value<A> | Value<B>>>
      : Simplify<
          {
            [K in RequiredKeys<A> | RequiredKeys<B>]: K extends RequiredKeys<B>
              ? ValueAt<B, K>
              : ValueAt<A, K> | ValueAt<B, K>;
          } & { [K in Exclude<keyof A | keyof B, RequiredKeys<A> | RequiredKeys<B>>]?: ValueAt<A, K> | ValueAt<B, K> }
        >
    : never
  : never;
export type MergeResult<T, Rest extends readonly (object | undefined)[]> = Rest extends readonly [
  infer H extends object,
  ...infer Tail extends (object | undefined)[]
]
  ? MergeResult<MergePair<MergeShape<T>, MergeShape<H>>, Tail>
  : [Extract<Rest[number], object>] extends [never]
    ? MergeShape<T>
    : MergePair<MergeShape<T>, UnionRecord<MergeShape<Extract<Rest[number], object>>>>;
type UnsafeMutationKey = '__proto__' | 'constructor' | 'prototype';
type InvalidMutationSegment<K extends Key> = RuntimeKey<K> extends UnsafeMutationKey ? true : false;
// Reject only restrictions the declarations can prove from literal keys/tuples.
// Runtime parsing remains authoritative for dotted/bracket string syntax and
// dynamically constructed paths.
type InvalidImmutablePath<T, P extends Path> = P extends readonly [infer H extends Key, ...infer R extends Key[]]
  ? InvalidMutationSegment<H> extends true
    ? true
    : T extends readonly unknown[]
      ? RuntimeKey<H> extends 'length'
        ? true
        : R extends []
          ? false
          : InvalidImmutablePath<PropertyValue<T, H>, R>
      : R extends []
        ? false
        : InvalidImmutablePath<PropertyValue<T, H>, R>
  : P extends Key
    ? InvalidMutationSegment<P> extends true
      ? true
      : T extends readonly unknown[]
        ? RuntimeKey<P> extends 'length'
          ? true
          : false
        : false
    : false;
type ValidImmutablePath<T, P extends Path> = true extends InvalidImmutablePath<T, P> ? never : unknown;
// Omit cannot subtract a literal from an index signature. Preserve unrelated
// named fields, but widen any index domain that can also address the new value.
type Identical<A, B> = (<X>() => X extends A ? 1 : 2) extends <X>() => X extends B ? 1 : 2 ? true : false;
type ImmutableSlot<T extends object, K extends Key, V> = [ResolvedKey<T, K>] extends [never]
  ? Record<K, V>
  : Identical<Pick<T, ResolvedKey<T, K>>, Mutable<Pick<T, ResolvedKey<T, K>>>> extends true
    ? Record<K, V>
    : Readonly<Record<K, V>>;
// No-op operations return the original input: retain its static readonly
// constraints even though data descriptors on actual copies become writable.
type ImmutableArray<T, V> = T extends unknown[] ? V[] : readonly V[];
type ImmutableSetRecord<T extends object, K extends Key, V> = Simplify<
  {
    [Q in keyof T as Q extends ResolvedKey<T, K> ? never : Q]: [ResolvedKey<Record<Q, unknown>, K>] extends [never]
      ? T[Q]
      : T[Q] | V;
  } & ImmutableSlot<T, K, V>
>;
type ImmutableSetKey<T, K extends Key, V> = T extends readonly (infer E)[]
  ? ImmutableArray<T, E | V>
  : T extends object
    ? ImmutableSetRecord<T, K, V>
    : Record<K, V>;
export type ImmutableSet<T, P extends Path, V> = P extends readonly [infer H extends Key, ...infer R extends Key[]]
  ? true extends OpenKey<H>
    ? unknown
    : H extends unknown
      ? ImmutableSetKey<T, H, R extends [] ? V : ImmutableSet<PropertyValue<T, H>, R, V>>
      : never
  : P extends Key
    ? [SimplePath<P>] extends [never]
      ? unknown
      : ImmutableSetKey<T, P, V>
    : unknown;
type ImmutableUnsetKey<T, K extends Key> = T extends readonly (infer E)[]
  ? ImmutableArray<T, E | undefined>
  : T extends object
    ? Omit<T, ResolvedKey<T, K>>
    : T;
// A literal path may address a member covered by a broad index signature.
// Transform exact slots (including tuple "0" / numeric 0 aliases); widen any
// covering index domain because other members still retain their original shape.
// A homomorphic mapping preserves tuple layout, optionality and readonly state.
type ImmutableUnsetBranch<T, H extends Key, R extends Key[]> = T extends object
  ? {
      [K in keyof T]: [ResolvedKey<Record<K, unknown>, H>] extends [never]
        ? T[K]
        : RuntimeKey<K> extends RuntimeKey<H>
          ? ImmutableUnset<T[K], R>
          : T[K] | ImmutableUnset<T[K], R>;
    }
  : T;
export type ImmutableUnset<T, P extends Path> = P extends readonly [infer H extends Key, ...infer R extends Key[]]
  ? true extends OpenKey<H>
    ? unknown
    : H extends unknown
      ? R extends []
        ? ImmutableUnsetKey<T, H>
        : ImmutableUnsetBranch<T, H, R>
      : never
  : P extends Key
    ? [SimplePath<P>] extends [never]
      ? unknown
      : ImmutableUnsetKey<T, P>
    : unknown;
type DeepRenamed<T, K extends Key, O> = O extends { arrays: 'preserve' }
  ? T extends readonly unknown[]
    ? unknown[]
    : Partial<Record<RuntimeKey<K>, unknown>>
  : O extends { arrays?: 'record' } | undefined
    ? Partial<Record<RuntimeKey<K>, unknown>>
    : Partial<Record<RuntimeKey<K>, unknown>> | unknown[];
type Input<T> = Extract<T, object>;
// A union of collections is one valid pipeline value, not a union of wrappers.
type CollectionThis<T, R> = [T] extends [object] ? Wrapper<T, R> : never;

/**
 * Creates a shallow copy of supported data while preserving property descriptors.
 *
 * Retains child references, accessors and ordinary-record prototypes. Supported built-ins have valid
 * copied native state but may use local-realm prototypes. Unsupported values remain references by
 * default or throw in strict mode.
 *
 * @param value The value to copy.
 * @param [options] Optional settings; see the clone support policy in the full API documentation.
 * Unknown options throw. Defaults to `undefined`.
 * @returns A supported object copy, or the original primitive/opaque value according to the
 * unsupported-value policy.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for invalid options, including unsupported values under the strict policy.
 * @throws Errors from proxy traps or native Error stack preparation propagate; custom property
 * getters are not invoked.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.clone(input);          // => { a: { n: 1 }, b: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#clonevalue-options
 */
export function clone<T>(value: T, options?: CloneOptions): T;
/**
 * Creates a graph-preserving copy of supported nested data and property descriptors.
 *
 * Copies supported Map/Set contents and backing-buffer relationships. Unsupported values remain
 * references by default and their children are not visited. User getters are retained without
 * invocation; native Error stack materialisation can invoke `Error.prepareStackTrace`.
 *
 * @param value The value to copy.
 * @param [options] Optional settings; see the clone support policy in the full API documentation.
 * Unknown options throw. Defaults to `undefined`.
 * @returns A copied supported graph with shared identities and cycles preserved; primitives and
 * permitted opaque values retain identity.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for invalid options, including unsupported values under the strict policy.
 * @throws Errors from proxy traps or native Error stack preparation propagate; custom property
 * getters are not invoked.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.deepClone(input);      // => { a: { n: 1 }, b: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepclonevalue-options
 */
export function deepClone<T>(value: T, options?: CloneOptions): T;
/**
 * Returns the own enumerable string and symbol keys of a value.
 *
 * String keys follow `Object.keys` order, followed by symbols. Does not read property values.
 *
 * @param object The input object or value.
 * @returns A new array of keys, or `[]` for a primitive input.
 * @throws {TypeError} when a required argument is omitted.
 * @throws Errors from proxy traps propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.keys(input);           // => ['a', 'b', 'c']
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#keysobject
 */
export function keys<T>(object: T): OwnKey<T>[];
/**
 * Returns the values of own enumerable string and symbol properties.
 *
 * Own enumerable strings are visited before symbols; inherited properties are excluded. Snapshot
 * keys are fixed, deleted properties are skipped and values are read when visited.
 *
 * @param object The input object or value.
 * @returns A new array of observed values in key order, or `[]` for a primitive input.
 * @throws {TypeError} when a required argument is omitted.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.values(input);         // => [1, 2, 1]
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#valuesobject
 */
export function values<T>(object: T): Value<T>[];
/**
 * Returns the key-and-value pairs of own enumerable properties.
 *
 * Own enumerable strings are visited before symbols; inherited properties are excluded. Snapshot
 * keys are fixed, deleted properties are skipped and values are read when visited.
 *
 * @param object The input object or value.
 * @returns A new array of `[key, value]` pairs in key order, or `[]` for a primitive input.
 * @throws {TypeError} when a required argument is omitted.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.entries(input);        // => [['a', 1], ['b', 2], ['c', 1]]
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#entriesobject
 */
export function entries<T>(object: T): Entry<T>[];
/**
 * Determines whether a value has an own enumerable property with a given key.
 *
 * Invalid key kinds and primitive inputs return `false` without coercion hooks. Does not evaluate
 * the property getter.
 *
 * @param object The input object or value.
 * @param key A string, symbol or safe integer literal key. Invalid key kinds return `false`.
 * @returns `true` if the property is own and enumerable; otherwise `false`.
 * @throws {TypeError} when a required argument is omitted.
 * @throws Errors from proxy traps propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.hasKey(input, 'a');    // => true
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#haskeyobject-key
 */
export function hasKey<K extends Key>(object: unknown, key: K): boolean;
/**
 * Determines whether a value has an own enumerable property with a given key.
 *
 * Invalid key kinds and primitive inputs return `false` without coercion hooks. Does not evaluate
 * the property getter.
 *
 * @param object The input object or value.
 * @param key A string, symbol or safe integer literal key. Invalid key kinds return `false`.
 * @returns `true` if the property is own and enumerable; otherwise `false`.
 * @throws {TypeError} when a required argument is omitted.
 * @throws Errors from proxy traps propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.hasKey(input, 'a');    // => true
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#haskeyobject-key
 */
export function hasKey(object: unknown, key: unknown): boolean;
/**
 * Determines whether a value has an own property, including a non-enumerable property.
 *
 * Inherited properties, invalid key kinds and primitive inputs return `false`. Does not evaluate the
 * property getter.
 *
 * @param object The input object or value.
 * @param key A string, symbol or safe integer literal key. Invalid key kinds return `false`.
 * @returns `true` if the property exists on the value itself; otherwise `false`.
 * @throws {TypeError} when a required argument is omitted.
 * @throws Errors from proxy traps propagate.
 * @example
 * const input = Object.defineProperty({}, 'hidden', { value: 1 });
 * Objects.hasProp(input, 'hidden');  // => true
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#haspropobject-key
 */
export function hasProp<K extends Key>(object: unknown, key: K): boolean;
/**
 * Determines whether a value has an own property, including a non-enumerable property.
 *
 * Inherited properties, invalid key kinds and primitive inputs return `false`. Does not evaluate the
 * property getter.
 *
 * @param object The input object or value.
 * @param key A string, symbol or safe integer literal key. Invalid key kinds return `false`.
 * @returns `true` if the property exists on the value itself; otherwise `false`.
 * @throws {TypeError} when a required argument is omitted.
 * @throws Errors from proxy traps propagate.
 * @example
 * const input = Object.defineProperty({}, 'hidden', { value: 1 });
 * Objects.hasProp(input, 'hidden');  // => true
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#haspropobject-key
 */
export function hasProp(object: unknown, key: unknown): boolean;
/**
 * Determines whether an own enumerable property contains a matching value.
 *
 * `NaN` matches itself, signed zeros match and objects/functions compare by identity. Primitive
 * inputs return `false`. Own enumerable strings are visited before symbols; inherited properties are
 * excluded. Snapshot keys are fixed, deleted properties are skipped and values are read when
 * visited.
 *
 * @param object The input object or value.
 * @param value The literal value to match by SameValueZero.
 * @returns `true` if an observed value matches by SameValueZero; otherwise `false`.
 * @throws {TypeError} when a required argument is omitted.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.hasValue(input, 2);    // => true
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#hasvalueobject-value
 */
export function hasValue(object: unknown, value: unknown): boolean;
/**
 * Determines whether an own-property path exists, even when its value is `undefined`.
 *
 * Includes non-enumerable properties. The terminal getter is not evaluated; intermediate getters can
 * run. `[]` identifies an object/function root; holes and inherited properties are absent.
 *
 * @param object The input object or value.
 * @param path A string, symbol, safe integer or array of those keys. String paths support dot and
 * quoted/numeric bracket syntax.
 * @returns `true` when the own path exists; otherwise `false`.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid path or key; malformed string syntax is rejected with
 * `SyntaxError`.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.has(input, 'a.n');     // => true
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#hasobject-path
 */
export function has(object: unknown, path: Path): boolean;
/**
 * Returns a value at an own-property path, using a default when it is missing or `undefined`.
 *
 * Preserves `null`. Reads each own path step once; does not traverse primitive properties. The empty
 * string names the empty-string property.
 *
 * @param object The input object or value.
 * @param path A string, symbol, safe integer or array of those keys. String paths support dot and
 * quoted/numeric bracket syntax.
 * @param [defaultValue] The fallback for missing or `undefined` path values; preserves `null`.
 * Defaults to `undefined`.
 * @returns The observed value, or the default for a missing/`undefined` value. An empty path array
 * returns the original root.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid path or key; malformed string syntax is rejected with
 * `SyntaxError`.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.get(input, 'a.n');     // => 1
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#getobject-path-defaultvalue
 */
export function get<T, const P extends Path>(object: T, path: P): GetResult<T, P>;
/**
 * Returns a value at an own-property path, using a default when it is missing or `undefined`.
 *
 * Preserves `null`. Reads each own path step once; does not traverse primitive properties. The empty
 * string names the empty-string property.
 *
 * @param object The input object or value.
 * @param path A string, symbol, safe integer or array of those keys. String paths support dot and
 * quoted/numeric bracket syntax.
 * @param defaultValue The fallback for missing or `undefined` path values; preserves `null`.
 * Defaults to `undefined`.
 * @returns The observed value, or the default for a missing/`undefined` value. An empty path array
 * returns the original root.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid path or key; malformed string syntax is rejected with
 * `SyntaxError`.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.get(input, 'a.n');     // => 1
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#getobject-path-defaultvalue
 */
export function get<T, const P extends Path, D>(object: T, path: P, defaultValue: D): GetResult<T, P, D>;
/**
 * Returns values at several own-property paths in the supplied order.
 *
 * Validates the complete path list before reading values. Paths can repeat. Defaults replace
 * missing/`undefined` values, not `null`.
 *
 * @param object The input object or value.
 * @param paths An actual array of paths, processed in list order.
 * @param [defaultValue] The fallback for missing or `undefined` path values; preserves `null`.
 * Defaults to `undefined`.
 * @returns A new array with one value or default per requested path.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid path or key; malformed string syntax is rejected with
 * `SyntaxError`.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.getEach(input, ['a.n', 'b', 'absent'], 9);   // => [1, 2, 9]
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#geteachobject-paths-defaultvalue
 */
export function getEach<T, const P extends readonly Path[]>(object: T, paths: P): PathResults<T, P>;
/**
 * Returns values at several own-property paths in the supplied order.
 *
 * Validates the complete path list before reading values. Paths can repeat. Defaults replace
 * missing/`undefined` values, not `null`.
 *
 * @param object The input object or value.
 * @param paths An actual array of paths, processed in list order.
 * @param defaultValue The fallback for missing or `undefined` path values; preserves `null`.
 * Defaults to `undefined`.
 * @returns A new array with one value or default per requested path.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid path or key; malformed string syntax is rejected with
 * `SyntaxError`.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.getEach(input, ['a.n', 'b', 'absent'], 9);   // => [1, 2, 9]
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#geteachobject-paths-defaultvalue
 */
export function getEach<T, const P extends readonly Path[], D>(
  object: T,
  paths: P,
  defaultValue: D
): PathResults<T, P, D>;
/**
 * Sets a value at an own-property path and returns its previous value.
 *
 * Mutates the input. Stores functions and other supplied values as data. Creates missing/`undefined`
 * intermediates, but does not replace `null` or primitive intermediates.
 *
 * @param object The input object to update in place.
 * @param path A string, symbol, safe integer or array of those keys. String paths support dot and
 * quoted/numeric bracket syntax.
 * @param value The literal value to store; typed writes must satisfy the selected path.
 * @returns The previous final value, or `undefined` when the property was absent.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for an invalid path or key; malformed string syntax is rejected with
 * `SyntaxError`.
 * @throws {RangeError} for an empty mutation path; `TypeError` for unsafe path segments, unsupported
 * containers or forbidden writes.
 * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
 * rolled back.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.set(input, 'a.n', 7);  // => 1
 * input;                         // => { a: { n: 7 }, b: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#setobject-path-value
 */
export function set<T extends object, const P extends Path>(
  object: T,
  path: P,
  value: NoInfer<WriteValue<T, P>>
): GetResult<T, P>;
/**
 * Updates an own-property path by calling an updater once with its previous value.
 *
 * Mutates the input. Checks the path, data descriptors and ordinary destination restrictions before
 * calling `updater(previousValue)`. Missing parents are attached only after it returns. Native value
 * validation and exotic-object write restrictions can still fail afterward. Rechecks restrictions
 * after callback side effects. Returned functions or promises are stored, not invoked or awaited.
 *
 * @param object The input object to update in place.
 * @param path A string, symbol, safe integer or array of those keys. String paths support dot and
 * quoted/numeric bracket syntax.
 * @param updater Called once with the previous value; returns the replacement without awaiting it.
 * Avoid mutating the input in the callback.
 * @returns The value observed before invoking the updater, or `undefined` when the property was
 * absent.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection or required callback.
 * @throws {TypeError} for an invalid path or key; malformed string syntax is rejected with
 * `SyntaxError`.
 * @throws {RangeError} for an empty mutation path; `TypeError` for unsafe path segments, unsupported
 * containers or forbidden writes.
 * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
 * rolled back.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.update(input, 'a.n', n => n + 1);  // => 1
 * input;                                     // => { a: { n: 2 }, b: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#updateobject-path-updater
 */
export function update<T extends object, const P extends Path>(
  object: T,
  path: P,
  updater: (current: GetResult<T, P>) => NoInfer<WriteValue<T, P>>
): GetResult<T, P>;
/**
 * Sets the same value at several own-property paths and returns their previous values.
 *
 * Mutates the input and stores one shared value/reference. Validates all paths before the first
 * write, but a later runtime failure does not roll back earlier writes.
 *
 * @param object The input object to update in place.
 * @param paths An actual array of paths, processed in list order.
 * @param value The literal value to store; typed writes must satisfy the selected path.
 * @returns A new array of previous values in path-list order; absent final properties contribute
 * `undefined`.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for an invalid path or key; malformed string syntax is rejected with
 * `SyntaxError`.
 * @throws {RangeError} for an empty mutation path; `TypeError` for unsafe path segments, unsupported
 * containers or forbidden writes.
 * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
 * rolled back.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.setEach(input, ['a.n', 'b'], 7);   // => [1, 2]
 * input;                                     // => { a: { n: 7 }, b: 7 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#seteachobject-paths-value
 */
export function setEach<T extends object, const P extends readonly Path[]>(
  object: T,
  paths: P,
  value: NoInfer<BatchValue<T, P>>
): PathResults<T, P>;
/**
 * Removes an own property at a path without shifting array indexes.
 *
 * Mutates the input. Missing, `null` or scalar intermediate branches count as absent. Array index
 * deletion leaves a hole and retains length. Does not create containers. A configurable terminal
 * accessor can be deleted without evaluating its getter; intermediate accessors remain forbidden.
 *
 * @param object The input object to update in place.
 * @param path A string, symbol, safe integer or array of those keys. String paths support dot and
 * quoted/numeric bracket syntax.
 * @returns `true` when deletion succeeds or the path is already absent.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for an invalid path or key; malformed string syntax is rejected with
 * `SyntaxError`.
 * @throws {TypeError} for unsafe paths, an invalid root, intermediate accessors or a
 * non-configurable final property.
 * @throws {RangeError} for an empty mutation path.
 * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
 * rolled back.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.unset(input, 'a.n');   // => true
 * input;                         // => { a: {}, b: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#unsetobject-path
 */
export function unset<T extends object, const P extends Path>(object: T, path: P & DeletePath<T, P>): true;
/**
 * Visits each own enumerable property and returns the original object.
 *
 * Does not itself write to the input; callbacks may do so. Own enumerable strings are visited before
 * symbols; inherited properties are excluded. Snapshot keys are fixed, deleted properties are
 * skipped and values are read when visited.
 *
 * @param object The input object or value.
 * @param callback Called with `(value, key, object)` and `this` bound to the input. Results are not
 * awaited.
 * @returns The original object; callback results are ignored.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection or required callback.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.forEach(input, () => undefined);   // => { a: 1, b: 2, c: 1 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#foreachobject-callback
 */
export function forEach<T extends object>(object: T, callback: Callback<T, unknown>): T;
/**
 * Creates an object or array by transforming each own enumerable value.
 *
 * Arrays retain length and holes. Values returned by callbacks are stored without awaiting them. Own
 * enumerable strings are visited before symbols; inherited properties are excluded. Snapshot keys
 * are fixed, deleted properties are skipped and values are read when visited.
 *
 * @param object The input object or value.
 * @param callback Called with `(value, key, object)` and `this` bound to the input. Results are not
 * awaited.
 * @returns A new container with the original keys and callback results.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection or required callback.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.map(input, n => n * 2);  // => { a: 2, b: 4, c: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#mapobject-callback
 */
export function map<T extends object, R>(object: T, callback: Callback<T, R>): Mapped<T, R>;
/**
 * Creates a record by renaming own enumerable keys while retaining their values.
 *
 * Arrays become records. The last colliding key wins by default; `onCollision: 'throw'` rejects
 * collisions. Numeric results normalise to strings before collision checks. Own enumerable strings
 * are visited before symbols; inherited properties are excluded. Snapshot keys are fixed, deleted
 * properties are skipped and values are read when visited.
 *
 * @param object The input object or value.
 * @param callback Called with `(value, key, object)` and `this` bound to the input. Must return a
 * string, symbol or safe integer key.
 * @param [options] Optional settings; see key-mapping collision rules below. Unknown options throw.
 * Defaults to `undefined`.
 * @returns A new record with mapped keys and original value references.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection or required callback.
 * @throws {TypeError} for invalid options, invalid mapped keys or a forbidden collision.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.mapKeys(input, (_, k) => k.toUpperCase());   // => { A: 1, B: 2, C: 1 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#mapkeysobject-callback-options
 */
export function mapKeys<T extends object, K extends Key>(
  object: T,
  callback: Callback<T, K>,
  options?: MapKeysOptions
): Renamed<T, K>;
/**
 * Creates an object or array retaining properties whose predicate result is truthy.
 *
 * Retained array indexes compact; retained extra enumerable string/symbol properties remain. Own
 * enumerable strings are visited before symbols; inherited properties are excluded. Snapshot keys
 * are fixed, deleted properties are skipped and values are read when visited.
 *
 * @param object The input object or value.
 * @param predicate Called with `(value, key, object)` and `this` bound to the input. Truthy results
 * retain the property.
 * @returns A new container of retained values, preserving their references.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection or required callback.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.filter(input, n => n > 1);   // => { b: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#filterobject-predicate
 */
export function filter<T extends object, S extends Value<T>>(object: T, predicate: Guard<T, S>): Filtered<T, S>;
/**
 * Creates an object or array retaining properties whose predicate result is truthy.
 *
 * Retained array indexes compact; retained extra enumerable string/symbol properties remain. Own
 * enumerable strings are visited before symbols; inherited properties are excluded. Snapshot keys
 * are fixed, deleted properties are skipped and values are read when visited.
 *
 * @param object The input object or value.
 * @param predicate Called with `(value, key, object)` and `this` bound to the input. Truthy results
 * retain the property.
 * @returns A new container of retained values, preserving their references.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection or required callback.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.filter(input, n => n > 1);   // => { b: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#filterobject-predicate
 */
export function filter<T extends object>(object: T, predicate: Predicate<T>): Filtered<T>;
/**
 * Determines whether any own enumerable property matches a value or predicate.
 *
 * Stops callbacks and value reads after the first match; keys are snapshotted before searching. Own
 * enumerable strings are visited before symbols; inherited properties are excluded. Snapshot keys
 * are fixed, deleted properties are skipped and values are read when visited.
 *
 * @param object The input object or value.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @returns `true` when a property matches; otherwise `false`, including for an empty input.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.some(input, 2);        // => true
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#someobject-valueorpredicate
 */
export function some<T extends object, const M = never>(object: T, valueOrPredicate: Matcher<T, M>): boolean;
/**
 * Determines whether every own enumerable property matches a value or predicate.
 *
 * Stops callbacks and value reads at the first failure; keys are snapshotted before searching. Own
 * enumerable strings are visited before symbols; inherited properties are excluded. Snapshot keys
 * are fixed, deleted properties are skipped and values are read when visited.
 *
 * @param object The input object or value.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @returns `false` at the first failure; otherwise `true`, including for an empty input.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.every(input, n => n > 0);  // => true
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#everyobject-valueorpredicate
 */
export function every<T extends object, const M = never>(object: T, valueOrPredicate: Matcher<T, M>): boolean;
/**
 * Returns the first own enumerable value matching a literal or predicate.
 *
 * Use `findEntry` to distinguish a found `undefined` from no match. Own enumerable strings are
 * visited before symbols; inherited properties are excluded. Snapshot keys are fixed, deleted
 * properties are skipped and values are read when visited.
 *
 * @param object The input object or value.
 * @param predicate A literal matched by SameValueZero, or a synchronous predicate using truthiness.
 * A function is always a predicate.
 * @returns The matching value, or `undefined` when no property matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.find(input, n => n > 1);   // => 2
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#findobject-valueorpredicate
 */
export function find<T extends object, S extends Value<T>>(object: T, predicate: Guard<T, S>): S | undefined;
/**
 * Returns the first own enumerable value matching a literal or predicate.
 *
 * Use `findEntry` to distinguish a found `undefined` from no match. Own enumerable strings are
 * visited before symbols; inherited properties are excluded. Snapshot keys are fixed, deleted
 * properties are skipped and values are read when visited.
 *
 * @param object The input object or value.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @returns The matching value, or `undefined` when no property matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.find(input, n => n > 1);   // => 2
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#findobject-valueorpredicate
 */
export function find<T extends object, const M = never>(
  object: T,
  valueOrPredicate: Matcher<T, M>
): Value<T> | undefined;
/**
 * Returns the last own enumerable value matching a literal or predicate.
 *
 * Visits keys in reverse order. Use `findEntry` to distinguish a found `undefined` from no match.
 * The complete own-enumerable key list is visited in reverse, so symbols precede strings. Inherited
 * properties are excluded. Snapshot keys are fixed, deleted properties are skipped and values are
 * read when visited.
 *
 * @param object The input object or value.
 * @param predicate A literal matched by SameValueZero, or a synchronous predicate using truthiness.
 * A function is always a predicate.
 * @returns The matching value, or `undefined` when no property matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.findLast(input, n => n < 2);   // => 1
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#findlastobject-valueorpredicate
 */
export function findLast<T extends object, S extends Value<T>>(object: T, predicate: Guard<T, S>): S | undefined;
/**
 * Returns the last own enumerable value matching a literal or predicate.
 *
 * Visits keys in reverse order. Use `findEntry` to distinguish a found `undefined` from no match.
 * The complete own-enumerable key list is visited in reverse, so symbols precede strings. Inherited
 * properties are excluded. Snapshot keys are fixed, deleted properties are skipped and values are
 * read when visited.
 *
 * @param object The input object or value.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @returns The matching value, or `undefined` when no property matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.findLast(input, n => n < 2);   // => 1
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#findlastobject-valueorpredicate
 */
export function findLast<T extends object, const M = never>(
  object: T,
  valueOrPredicate: Matcher<T, M>
): Value<T> | undefined;
/**
 * Returns all own enumerable values matching a literal or predicate.
 *
 * Own enumerable strings are visited before symbols; inherited properties are excluded. Snapshot
 * keys are fixed, deleted properties are skipped and values are read when visited.
 *
 * @param object The input object or value.
 * @param predicate A literal matched by SameValueZero, or a synchronous predicate using truthiness.
 * A function is always a predicate.
 * @returns A new array of matching values in forward key order, or `[]`.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.findAll(input, 1);     // => [1, 1]
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#findallobject-valueorpredicate
 */
export function findAll<T extends object, S extends Value<T>>(object: T, predicate: Guard<T, S>): S[];
/**
 * Returns all own enumerable values matching a literal or predicate.
 *
 * Own enumerable strings are visited before symbols; inherited properties are excluded. Snapshot
 * keys are fixed, deleted properties are skipped and values are read when visited.
 *
 * @param object The input object or value.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @returns A new array of matching values in forward key order, or `[]`.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.findAll(input, 1);     // => [1, 1]
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#findallobject-valueorpredicate
 */
export function findAll<T extends object, const M = never>(object: T, valueOrPredicate: Matcher<T, M>): Value<T>[];
/**
 * Returns the key of the first own enumerable match.
 *
 * Own enumerable strings are visited before symbols; inherited properties are excluded. Snapshot
 * keys are fixed, deleted properties are skipped and values are read when visited.
 *
 * @param object The input object or value.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @returns The matching string or symbol key, or `undefined`.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.findKey(input, 2);     // => 'b'
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#findkeyobject-valueorpredicate
 */
export function findKey<T extends object, const M = never>(
  object: T,
  valueOrPredicate: Matcher<T, M>
): OwnKey<T> | undefined;
/**
 * Returns the key and observed value of the first own enumerable match.
 *
 * Captures the value during matching without rereading its getter. A pair with `undefined`
 * distinguishes a found value from no match. Own enumerable strings are visited before symbols;
 * inherited properties are excluded. Snapshot keys are fixed, deleted properties are skipped and
 * values are read when visited.
 *
 * @param object The input object or value.
 * @param predicate A literal matched by SameValueZero, or a synchronous predicate using truthiness.
 * A function is always a predicate.
 * @returns A `[key, observedValue]` pair, or `undefined` when no property matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.findEntry(input, 2);   // => ['b', 2]
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#findentryobject-valueorpredicate
 */
export function findEntry<T extends object, S extends Value<T>>(
  object: T,
  predicate: Guard<T, S>
): Entry<T, S> | undefined;
/**
 * Returns the key and observed value of the first own enumerable match.
 *
 * Captures the value during matching without rereading its getter. A pair with `undefined`
 * distinguishes a found value from no match. Own enumerable strings are visited before symbols;
 * inherited properties are excluded. Snapshot keys are fixed, deleted properties are skipped and
 * values are read when visited.
 *
 * @param object The input object or value.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @returns A `[key, observedValue]` pair, or `undefined` when no property matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.findEntry(input, 2);   // => ['b', 2]
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#findentryobject-valueorpredicate
 */
export function findEntry<T extends object, const M = never>(
  object: T,
  valueOrPredicate: Matcher<T, M>
): Entry<T> | undefined;
/**
 * Counts own enumerable properties, optionally selecting matches.
 *
 * Omitting the matcher does not read property values. Explicit `undefined` matches undefined values
 * and therefore reads values. Own enumerable strings are visited before symbols; inherited
 * properties are excluded. With a matcher, snapshot keys are fixed, deleted properties are skipped
 * and values are read when visited. Without a matcher, only keys are counted; getters are not
 * evaluated.
 *
 * @param object The input object or value.
 * @param [valueOrPredicate] A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate. Defaults to `omitted (count keys without reading
 * values)`.
 * @returns The number of own enumerable keys when the matcher is omitted; otherwise the number of
 * matching values.
 * @throws {TypeError} for an invalid collection.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.count(input);          // => 3
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#countobject-valueorpredicate
 */
export function count<T extends object>(object: T): number;
/**
 * Counts own enumerable properties, optionally selecting matches.
 *
 * Omitting the matcher does not read property values. Explicit `undefined` matches undefined values
 * and therefore reads values. Own enumerable strings are visited before symbols; inherited
 * properties are excluded. With a matcher, snapshot keys are fixed, deleted properties are skipped
 * and values are read when visited. Without a matcher, only keys are counted; getters are not
 * evaluated.
 *
 * @param object The input object or value.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate. Defaults to `omitted (count keys without reading
 * values)`.
 * @returns The number of own enumerable keys when the matcher is omitted; otherwise the number of
 * matching values.
 * @throws {TypeError} for an invalid collection.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.count(input);          // => 3
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#countobject-valueorpredicate
 */
export function count<T extends object, const M = never>(object: T, valueOrPredicate: Matcher<T, M>): number;
/**
 * Reduces own enumerable values to one accumulator in forward key order.
 *
 * Without an initial argument, the first visited value seeds the accumulator. Explicit `undefined`
 * is a supplied initial value. An empty input without an initial value throws. Own enumerable
 * strings are visited before symbols; inherited properties are excluded. Snapshot keys are fixed,
 * deleted properties are skipped and values are read when visited.
 *
 * @param object The input object or value.
 * @param reducer Called with `(accumulator, value, key, object)` and `this` bound to the input;
 * returns the next accumulator.
 * @param [initialValue] The initial accumulator. Explicit `undefined` counts as supplied. Defaults
 * to `first visited value when omitted`.
 * @returns The final accumulator, or the initial value for an empty input when one was supplied.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection or required callback.
 * @throws {TypeError} for empty input without an initial accumulator.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.reduce(input, (text, n) => text + n, '');  // => '121'
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#reduceobject-reducer-initialvalue
 */
export function reduce<T extends object>(
  object: T,
  reducer: (this: T, accumulator: Value<T>, value: Value<T>, key: OwnKey<T>, object: T) => Value<T>
): Value<T>;
/**
 * Reduces own enumerable values to one accumulator in forward key order.
 *
 * Without an initial argument, the first visited value seeds the accumulator. Explicit `undefined`
 * is a supplied initial value. An empty input without an initial value throws. Own enumerable
 * strings are visited before symbols; inherited properties are excluded. Snapshot keys are fixed,
 * deleted properties are skipped and values are read when visited.
 *
 * @param object The input object or value.
 * @param reducer Called with `(accumulator, value, key, object)` and `this` bound to the input;
 * returns the next accumulator.
 * @param initialValue The initial accumulator. Explicit `undefined` counts as supplied. Defaults to
 * `first visited value when omitted`.
 * @returns The final accumulator, or the initial value for an empty input when one was supplied.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection or required callback.
 * @throws {TypeError} for empty input without an initial accumulator.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.reduce(input, (text, n) => text + n, '');  // => '121'
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#reduceobject-reducer-initialvalue
 */
export function reduce<T extends object, R>(
  object: T,
  reducer: (this: T, accumulator: R, value: Value<T>, key: OwnKey<T>, object: T) => R,
  initialValue: R
): R;
/**
 * Reduces own enumerable values to one accumulator in reverse key order.
 *
 * Without an initial argument, the first visited value seeds the accumulator. Explicit `undefined`
 * is a supplied initial value. An empty input without an initial value throws. The complete
 * own-enumerable key list is visited in reverse, so symbols precede strings. Inherited properties
 * are excluded. Snapshot keys are fixed, deleted properties are skipped and values are read when
 * visited.
 *
 * @param object The input object or value.
 * @param reducer Called with `(accumulator, value, key, object)` and `this` bound to the input;
 * returns the next accumulator.
 * @param [initialValue] The initial accumulator. Explicit `undefined` counts as supplied. Defaults
 * to `first visited value when omitted`.
 * @returns The final accumulator, or the initial value for an empty input when one was supplied.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection or required callback.
 * @throws {TypeError} for empty input without an initial accumulator.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 3 };
 * Objects.reduceRight(input, (text, n) => text + n, '');   // => '321'
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#reducerightobject-reducer-initialvalue
 */
export function reduceRight<T extends object>(
  object: T,
  reducer: (this: T, accumulator: Value<T>, value: Value<T>, key: OwnKey<T>, object: T) => Value<T>
): Value<T>;
/**
 * Reduces own enumerable values to one accumulator in reverse key order.
 *
 * Without an initial argument, the first visited value seeds the accumulator. Explicit `undefined`
 * is a supplied initial value. An empty input without an initial value throws. The complete
 * own-enumerable key list is visited in reverse, so symbols precede strings. Inherited properties
 * are excluded. Snapshot keys are fixed, deleted properties are skipped and values are read when
 * visited.
 *
 * @param object The input object or value.
 * @param reducer Called with `(accumulator, value, key, object)` and `this` bound to the input;
 * returns the next accumulator.
 * @param initialValue The initial accumulator. Explicit `undefined` counts as supplied. Defaults to
 * `first visited value when omitted`.
 * @returns The final accumulator, or the initial value for an empty input when one was supplied.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection or required callback.
 * @throws {TypeError} for empty input without an initial accumulator.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 3 };
 * Objects.reduceRight(input, (text, n) => text + n, '');   // => '321'
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#reducerightobject-reducer-initialvalue
 */
export function reduceRight<T extends object, R>(
  object: T,
  reducer: (this: T, accumulator: R, value: Value<T>, key: OwnKey<T>, object: T) => R,
  initialValue: R
): R;
/**
 * Creates a record containing requested own enumerable keys.
 *
 * The key list contains literal keys, not paths. Duplicate keys do not create duplicate result
 * properties. Requested keys are processed in list order, including duplicates. Each requested
 * property is checked when reached; properties added by earlier getters can therefore be selected.
 *
 * @param object The input object or value.
 * @param keys An actual array of literal keys, not paths; invalid keys throw.
 * @returns A new record of requested properties that were present.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for an invalid key list.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.pick(input, ['b']);    // => { b: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#pickobject-keys
 */
export function pick<T extends object, const K extends KeyList>(object: T, keys: K & ValidKeyList<K>): Picked<T, K>;
/**
 * Creates a record excluding selected own enumerable keys.
 *
 * Excluded getters are not evaluated. Retained getters are read once; reflection can still trigger
 * proxy traps. Own enumerable strings are visited before symbols; inherited properties are excluded.
 * Snapshot keys are fixed, deleted properties are skipped and values are read when visited.
 *
 * @param object The input object or value.
 * @param keys An actual array of literal keys, not paths; invalid keys throw.
 * @returns A new record of properties not excluded by the key list.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for an invalid key list.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.omit(input, ['b']);    // => { a: 1, c: 1 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#omitobject-keys
 */
export function omit<T extends object, const K extends KeyList>(object: T, keys: K & ValidKeyList<K>): Omitted<T, K>;
/**
 * Creates a shallow merged record, with later sources overriding earlier keys.
 *
 * Does not recursively merge nested values or mutate sources. Nested values remain references. Own
 * enumerable strings are visited before symbols; inherited properties are excluded. Snapshot keys
 * are fixed, deleted properties are skipped and values are read when visited.
 *
 * @param object The input object or value.
 * @param others Additional source objects in argument order.
 * @returns A new record containing the final value for each supplied own enumerable key.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.merge(input, { a: 9, d: 4 });  // => { a: 9, b: 2, c: 1, d: 4 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#mergeobject-others
 */
export function merge<T extends object, const Rest extends readonly object[]>(
  object: T,
  ...others: Rest
): MergeResult<RecordShape<T>, Rest>;
/**
 * Returns entries of the first object that occur in every other object.
 *
 * Compares values by SameValueZero. With no additional objects, still returns a new record. Own
 * enumerable strings are visited before symbols; inherited properties are excluded. Snapshot keys
 * are fixed, deleted properties are skipped and values are read when visited.
 *
 * @param object The input object or value.
 * @param others Additional source objects in argument order.
 * @returns A new record of matching own enumerable key/value pairs.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.intersect(input, { b: 2 });  // => { b: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#intersectobject-others
 */
export function intersect<T extends object>(object: T, ...others: object[]): Partial<RecordShape<T>>;
/**
 * Returns entries of the first object that occur in none of the other objects.
 *
 * Compares values by SameValueZero. With no additional objects, still returns a new record. Own
 * enumerable strings are visited before symbols; inherited properties are excluded. Snapshot keys
 * are fixed, deleted properties are skipped and values are read when visited.
 *
 * @param object The input object or value.
 * @param others Additional source objects in argument order.
 * @returns A new record of own enumerable key/value pairs absent from all other inputs.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.except(input, { b: 2 });   // => { a: 1, c: 1 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#exceptobject-others
 */
export function except<T extends object>(object: T, ...others: object[]): Partial<RecordShape<T>>;
/**
 * Removes the first own enumerable match in place and returns its previous value.
 *
 * Deletion uses configurability, not writability, and leaves array holes. Visits keys in forward
 * order. Earlier writes and user side effects are not rolled back after errors. Own enumerable
 * strings are visited before symbols; inherited properties are excluded. Snapshot keys are fixed,
 * deleted properties are skipped and values are read when visited.
 *
 * @param object The input object to update in place.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @returns The previous matching value, or `undefined` when no property matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} when a matched property is non-configurable and cannot be deleted.
 * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
 * rolled back.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.remove(input, 1);      // => 1
 * input;                         // => { b: 2, c: 1 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#removeobject-valueorpredicate
 */
export function remove<T extends object, const M = never>(
  object: T & NoInfer<DeletableInput<T>>,
  valueOrPredicate: Matcher<T, M>
): Value<T> | undefined;
/**
 * Removes the last own enumerable match in place and returns its previous value.
 *
 * Deletion uses configurability, not writability, and leaves array holes. Visits keys in reverse
 * order. Earlier writes and user side effects are not rolled back after errors. The complete
 * own-enumerable key list is visited in reverse, so symbols precede strings. Inherited properties
 * are excluded. Snapshot keys are fixed, deleted properties are skipped and values are read when
 * visited.
 *
 * @param object The input object to update in place.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @returns The previous matching value, or `undefined` when no property matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} when a matched property is non-configurable and cannot be deleted.
 * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
 * rolled back.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.removeLast(input, 1);  // => 1
 * input;                         // => { a: 1, b: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#removelastobject-valueorpredicate
 */
export function removeLast<T extends object, const M = never>(
  object: T & NoInfer<DeletableInput<T>>,
  valueOrPredicate: Matcher<T, M>
): Value<T> | undefined;
/**
 * Removes all selected own enumerable matches in place and returns their previous values.
 *
 * Deletion uses configurability, not writability, and leaves array holes. Visits keys in forward
 * order. Earlier writes and user side effects are not rolled back after errors. Own enumerable
 * strings are visited before symbols; inherited properties are excluded. Snapshot keys are fixed,
 * deleted properties are skipped and values are read when visited.
 *
 * @param object The input object to update in place.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @returns A new array of previous values in traversal order, or `[]` when nothing matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} when a matched property is non-configurable and cannot be deleted.
 * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
 * rolled back.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.removeAll(input, 1);   // => [1, 1]
 * input;                         // => { b: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#removeallobject-valueorpredicate
 */
export function removeAll<T extends object, const M = never>(
  object: T & NoInfer<DeletableInput<T>>,
  valueOrPredicate: Matcher<T, M>
): Value<T>[];
/**
 * Replaces the first own enumerable match in place and returns its previous value.
 *
 * A replacement function is called with the normal callback arguments; return a function from it to
 * store function data. Accessor replacement is rejected. Visits keys in forward order. Earlier
 * writes and user side effects are not rolled back after errors. Own enumerable strings are visited
 * before symbols; inherited properties are excluded. Snapshot keys are fixed, deleted properties are
 * skipped and values are read when visited.
 *
 * @param object The input object to update in place.
 * @param predicate A literal matched by SameValueZero, or a synchronous predicate using truthiness.
 * A function is always a predicate.
 * @param replacement A literal or synchronous replacement callback. Return a function from a
 * callback to store function data. Typed replacements must fit the matched destinations.
 * @returns The previous matching value, or `undefined` when no property matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} when a matched property is an accessor, is non-writable or cannot be written
 * to the destination.
 * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
 * rolled back.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.replace(input, 1, 7);  // => 1
 * input;                         // => { a: 7, b: 2, c: 1 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#replaceobject-valueorpredicate-replacement
 */
export function replace<T extends object, S extends Value<T>, const V = never>(
  object: T,
  predicate: Guard<T, S>,
  replacement: Replacement<T, S, V>
): Value<T> | undefined;
/**
 * Replaces the first own enumerable match in place and returns its previous value.
 *
 * A replacement function is called with the normal callback arguments; return a function from it to
 * store function data. Accessor replacement is rejected. Visits keys in forward order. Earlier
 * writes and user side effects are not rolled back after errors. Own enumerable strings are visited
 * before symbols; inherited properties are excluded. Snapshot keys are fixed, deleted properties are
 * skipped and values are read when visited.
 *
 * @param object The input object to update in place.
 * @param match A literal matched by SameValueZero, or a synchronous predicate using truthiness. A
 * function is always a predicate.
 * @param replacement A literal or synchronous replacement callback. Return a function from a
 * callback to store function data. Typed replacements must fit the matched destinations.
 * @returns The previous matching value, or `undefined` when no property matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} when a matched property is an accessor, is non-writable or cannot be written
 * to the destination.
 * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
 * rolled back.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.replace(input, 1, 7);  // => 1
 * input;                         // => { a: 7, b: 2, c: 1 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#replaceobject-valueorpredicate-replacement
 */
export function replace<T extends object, const M extends object | Primitive, const V = never>(
  object: T,
  match: M & NonFunction<M>,
  replacement: Replacement<T, M, V>
): Value<T> | undefined;
/**
 * Replaces the first own enumerable match in place and returns its previous value.
 *
 * A replacement function is called with the normal callback arguments; return a function from it to
 * store function data. Accessor replacement is rejected. Visits keys in forward order. Earlier
 * writes and user side effects are not rolled back after errors. Own enumerable strings are visited
 * before symbols; inherited properties are excluded. Snapshot keys are fixed, deleted properties are
 * skipped and values are read when visited.
 *
 * @param object The input object to update in place.
 * @param predicate A literal matched by SameValueZero, or a synchronous predicate using truthiness.
 * A function is always a predicate.
 * @param replacement A literal or synchronous replacement callback. Return a function from a
 * callback to store function data. Typed replacements must fit the matched destinations.
 * @returns The previous matching value, or `undefined` when no property matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} when a matched property is an accessor, is non-writable or cannot be written
 * to the destination.
 * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
 * rolled back.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.replace(input, 1, 7);  // => 1
 * input;                         // => { a: 7, b: 2, c: 1 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#replaceobject-valueorpredicate-replacement
 */
export function replace<T extends object, const V = never>(
  object: T,
  predicate: Predicate<T>,
  replacement: Replacement<T, Value<T>, V>
): Value<T> | undefined;
/**
 * Replaces the last own enumerable match in place and returns its previous value.
 *
 * A replacement function is called with the normal callback arguments; return a function from it to
 * store function data. Accessor replacement is rejected. Visits keys in reverse order. Earlier
 * writes and user side effects are not rolled back after errors. The complete own-enumerable key
 * list is visited in reverse, so symbols precede strings. Inherited properties are excluded.
 * Snapshot keys are fixed, deleted properties are skipped and values are read when visited.
 *
 * @param object The input object to update in place.
 * @param predicate A literal matched by SameValueZero, or a synchronous predicate using truthiness.
 * A function is always a predicate.
 * @param replacement A literal or synchronous replacement callback. Return a function from a
 * callback to store function data. Typed replacements must fit the matched destinations.
 * @returns The previous matching value, or `undefined` when no property matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} when a matched property is an accessor, is non-writable or cannot be written
 * to the destination.
 * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
 * rolled back.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.replaceLast(input, 1, 7);  // => 1
 * input;                             // => { a: 1, b: 2, c: 7 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#replacelastobject-valueorpredicate-replacement
 */
export function replaceLast<T extends object, S extends Value<T>, const V = never>(
  object: T,
  predicate: Guard<T, S>,
  replacement: Replacement<T, S, V>
): Value<T> | undefined;
/**
 * Replaces the last own enumerable match in place and returns its previous value.
 *
 * A replacement function is called with the normal callback arguments; return a function from it to
 * store function data. Accessor replacement is rejected. Visits keys in reverse order. Earlier
 * writes and user side effects are not rolled back after errors. The complete own-enumerable key
 * list is visited in reverse, so symbols precede strings. Inherited properties are excluded.
 * Snapshot keys are fixed, deleted properties are skipped and values are read when visited.
 *
 * @param object The input object to update in place.
 * @param match A literal matched by SameValueZero, or a synchronous predicate using truthiness. A
 * function is always a predicate.
 * @param replacement A literal or synchronous replacement callback. Return a function from a
 * callback to store function data. Typed replacements must fit the matched destinations.
 * @returns The previous matching value, or `undefined` when no property matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} when a matched property is an accessor, is non-writable or cannot be written
 * to the destination.
 * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
 * rolled back.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.replaceLast(input, 1, 7);  // => 1
 * input;                             // => { a: 1, b: 2, c: 7 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#replacelastobject-valueorpredicate-replacement
 */
export function replaceLast<T extends object, const M extends object | Primitive, const V = never>(
  object: T,
  match: M & NonFunction<M>,
  replacement: Replacement<T, M, V>
): Value<T> | undefined;
/**
 * Replaces the last own enumerable match in place and returns its previous value.
 *
 * A replacement function is called with the normal callback arguments; return a function from it to
 * store function data. Accessor replacement is rejected. Visits keys in reverse order. Earlier
 * writes and user side effects are not rolled back after errors. The complete own-enumerable key
 * list is visited in reverse, so symbols precede strings. Inherited properties are excluded.
 * Snapshot keys are fixed, deleted properties are skipped and values are read when visited.
 *
 * @param object The input object to update in place.
 * @param predicate A literal matched by SameValueZero, or a synchronous predicate using truthiness.
 * A function is always a predicate.
 * @param replacement A literal or synchronous replacement callback. Return a function from a
 * callback to store function data. Typed replacements must fit the matched destinations.
 * @returns The previous matching value, or `undefined` when no property matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} when a matched property is an accessor, is non-writable or cannot be written
 * to the destination.
 * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
 * rolled back.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.replaceLast(input, 1, 7);  // => 1
 * input;                             // => { a: 1, b: 2, c: 7 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#replacelastobject-valueorpredicate-replacement
 */
export function replaceLast<T extends object, const V = never>(
  object: T,
  predicate: Predicate<T>,
  replacement: Replacement<T, Value<T>, V>
): Value<T> | undefined;
/**
 * Replaces all selected own enumerable matches in place and returns their previous values.
 *
 * A replacement function is called with the normal callback arguments; return a function from it to
 * store function data. Accessor replacement is rejected. Visits keys in forward order. Earlier
 * writes and user side effects are not rolled back after errors. Own enumerable strings are visited
 * before symbols; inherited properties are excluded. Snapshot keys are fixed, deleted properties are
 * skipped and values are read when visited.
 *
 * @param object The input object to update in place.
 * @param predicate A literal matched by SameValueZero, or a synchronous predicate using truthiness.
 * A function is always a predicate.
 * @param replacement A literal or synchronous replacement callback. Return a function from a
 * callback to store function data. Typed replacements must fit the matched destinations.
 * @returns A new array of previous values in traversal order, or `[]` when nothing matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} when a matched property is an accessor, is non-writable or cannot be written
 * to the destination.
 * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
 * rolled back.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.replaceAll(input, 1, 7);   // => [1, 1]
 * input;                             // => { a: 7, b: 2, c: 7 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#replaceallobject-valueorpredicate-replacement
 */
export function replaceAll<T extends object, S extends Value<T>, const V = never>(
  object: T,
  predicate: Guard<T, S>,
  replacement: Replacement<T, S, V>
): Value<T>[];
/**
 * Replaces all selected own enumerable matches in place and returns their previous values.
 *
 * A replacement function is called with the normal callback arguments; return a function from it to
 * store function data. Accessor replacement is rejected. Visits keys in forward order. Earlier
 * writes and user side effects are not rolled back after errors. Own enumerable strings are visited
 * before symbols; inherited properties are excluded. Snapshot keys are fixed, deleted properties are
 * skipped and values are read when visited.
 *
 * @param object The input object to update in place.
 * @param match A literal matched by SameValueZero, or a synchronous predicate using truthiness. A
 * function is always a predicate.
 * @param replacement A literal or synchronous replacement callback. Return a function from a
 * callback to store function data. Typed replacements must fit the matched destinations.
 * @returns A new array of previous values in traversal order, or `[]` when nothing matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} when a matched property is an accessor, is non-writable or cannot be written
 * to the destination.
 * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
 * rolled back.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.replaceAll(input, 1, 7);   // => [1, 1]
 * input;                             // => { a: 7, b: 2, c: 7 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#replaceallobject-valueorpredicate-replacement
 */
export function replaceAll<T extends object, const M extends object | Primitive, const V = never>(
  object: T,
  match: M & NonFunction<M>,
  replacement: Replacement<T, M, V>
): Value<T>[];
/**
 * Replaces all selected own enumerable matches in place and returns their previous values.
 *
 * A replacement function is called with the normal callback arguments; return a function from it to
 * store function data. Accessor replacement is rejected. Visits keys in forward order. Earlier
 * writes and user side effects are not rolled back after errors. Own enumerable strings are visited
 * before symbols; inherited properties are excluded. Snapshot keys are fixed, deleted properties are
 * skipped and values are read when visited.
 *
 * @param object The input object to update in place.
 * @param predicate A literal matched by SameValueZero, or a synchronous predicate using truthiness.
 * A function is always a predicate.
 * @param replacement A literal or synchronous replacement callback. Return a function from a
 * callback to store function data. Typed replacements must fit the matched destinations.
 * @returns A new array of previous values in traversal order, or `[]` when nothing matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} when a matched property is an accessor, is non-writable or cannot be written
 * to the destination.
 * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
 * rolled back.
 * @example
 * const input = { a: 1, b: 2, c: 1 };
 * Objects.replaceAll(input, 1, 7);   // => [1, 1]
 * input;                             // => { a: 7, b: 2, c: 7 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#replaceallobject-valueorpredicate-replacement
 */
export function replaceAll<T extends object, const V = never>(
  object: T,
  predicate: Predicate<T>,
  replacement: Replacement<T, Value<T>, V>
): Value<T>[];
/**
 * Visits own enumerable property edges depth-first and returns the original root.
 *
 * Excludes the root itself. Shared/circular containers expand once, but each encountered property
 * edge is visited. Traversal is pre-order depth-first, visits own enumerable string/symbol
 * properties and expands only arrays/plain records below the root. See deep traversal rules.
 *
 * @param object The input root whose own enumerable properties are traversed.
 * @param callback Called with `(value, key, parent, path)` and `this` bound to the parent. Results
 * are not awaited.
 * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
 * to `undefined`.
 * @returns The original root; callback results are ignored.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection or required callback.
 * @throws {TypeError} for invalid options, depths or descent callbacks.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.deepForEach(input, () => undefined);   // => { a: { n: 1 }, b: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepforeachobject-callback-options
 */
export function deepForEach<T extends object>(
  object: T,
  callback: DeepCallback<unknown>,
  options?: TraversalOptions
): T;
/**
 * Creates a structure by transforming values during depth-first traversal.
 *
 * Returning the original container requests recursive transformation; returning a different value
 * replaces the branch without traversing that replacement. Unexpanded branches and opaque leaves can
 * still reference the input. Traversal is pre-order depth-first, visits own enumerable string/symbol
 * properties and expands only arrays/plain records below the root. See deep traversal rules.
 *
 * @param object The input root whose own enumerable properties are traversed.
 * @param callback Called with `(value, key, parent, path)` and `this` bound to the parent. Results
 * are not awaited.
 * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
 * to `undefined`.
 * @returns A new object or array containing mapped branches, preserving aliases among copied
 * containers.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection or required callback.
 * @throws {TypeError} for invalid options, depths or descent callbacks.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.deepMap(input, v => typeof v === 'number' ? v * 2 : v);  // => { a: { n: 2 }, b: 4 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepmapobject-callback-options
 */
export function deepMap(
  object: object,
  callback: DeepCallback<unknown>,
  options?: TraversalOptions
): Record<string | symbol, unknown> | unknown[];
/**
 * Creates a structure by retaining matching branches and pruning rejected containers.
 *
 * Rejecting a container excludes its descendants. Unexpanded branches and shared aliases may retain
 * data: this is not an authorisation or complete redaction boundary. Traversal is pre-order
 * depth-first, visits own enumerable string/symbol properties and expands only arrays/plain records
 * below the root. See deep traversal rules.
 *
 * @param object The input root whose own enumerable properties are traversed.
 * @param callback Called with `(value, key, parent, path)` and `this` bound to the parent. Truthy
 * results retain the property.
 * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
 * to `undefined`.
 * @returns A new object or array of retained properties, with compacted array indexes.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection or required callback.
 * @throws {TypeError} for invalid options, depths or descent callbacks.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.deepFilter(input, v => typeof v !== 'number' || v > 1);  // => { a: {}, b: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepfilterobject-predicate-options
 */
export function deepFilter(
  object: object,
  callback: DeepCallback<unknown>,
  options?: TraversalOptions
): Record<string | symbol, unknown> | unknown[];
/**
 * Creates a structure by recursively renaming own enumerable keys.
 *
 * With preserved arrays, structural indexes bypass the key mapper while child records are traversed.
 * Extra properties cannot be renamed to `length` or canonical indexes. Collisions default to
 * overwrite and can throw per output container. Unexpanded branches remain references. Traversal is
 * pre-order depth-first, visits own enumerable string/symbol properties and expands only
 * arrays/plain records below the root. See deep traversal rules.
 *
 * @param object The input root whose own enumerable properties are traversed.
 * @param callback Called with `(value, key, parent, path)` and `this` bound to the parent. Must
 * return a string, symbol or safe integer key.
 * @param options Optional settings; see traversal options below. Unknown options throw. Defaults to
 * `undefined`.
 * @returns A new record structure by default; `arrays: 'preserve'` retains arrays and their
 * structural indexes.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection or required callback.
 * @throws {TypeError} for invalid options, invalid mapped keys or a forbidden collision.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.deepMapKeys(input, (_, k) => k.toUpperCase());   // => { A: { N: 1 }, B: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepmapkeysobject-callback-options
 */
export function deepMapKeys<T extends object, K extends Key>(
  object: T,
  callback: DeepCallback<K>,
  options: DeepMapKeysOptions & { arrays: 'preserve' }
): DeepRenamed<T, K, { arrays: 'preserve' }>;
/**
 * Creates a structure by recursively renaming own enumerable keys.
 *
 * With preserved arrays, structural indexes bypass the key mapper while child records are traversed.
 * Extra properties cannot be renamed to `length` or canonical indexes. Collisions default to
 * overwrite and can throw per output container. Unexpanded branches remain references. Traversal is
 * pre-order depth-first, visits own enumerable string/symbol properties and expands only
 * arrays/plain records below the root. See deep traversal rules.
 *
 * @param object The input root whose own enumerable properties are traversed.
 * @param callback Called with `(value, key, parent, path)` and `this` bound to the parent. Must
 * return a string, symbol or safe integer key.
 * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
 * to `undefined`.
 * @returns A new record structure by default; `arrays: 'preserve'` retains arrays and their
 * structural indexes.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection or required callback.
 * @throws {TypeError} for invalid options, invalid mapped keys or a forbidden collision.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.deepMapKeys(input, (_, k) => k.toUpperCase());   // => { A: { N: 1 }, B: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepmapkeysobject-callback-options
 */
export function deepMapKeys<T extends object, K extends Key>(
  object: T,
  callback: DeepCallback<K>,
  options?: DeepMapKeysOptions & { arrays?: 'record' }
): Partial<Record<RuntimeKey<K>, unknown>>;
/**
 * Creates a structure by recursively renaming own enumerable keys.
 *
 * With preserved arrays, structural indexes bypass the key mapper while child records are traversed.
 * Extra properties cannot be renamed to `length` or canonical indexes. Collisions default to
 * overwrite and can throw per output container. Unexpanded branches remain references. Traversal is
 * pre-order depth-first, visits own enumerable string/symbol properties and expands only
 * arrays/plain records below the root. See deep traversal rules.
 *
 * @param object The input root whose own enumerable properties are traversed.
 * @param callback Called with `(value, key, parent, path)` and `this` bound to the parent. Must
 * return a string, symbol or safe integer key.
 * @param options Optional settings; see traversal options below. Unknown options throw. Defaults to
 * `undefined`.
 * @returns A new record structure by default; `arrays: 'preserve'` retains arrays and their
 * structural indexes.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection or required callback.
 * @throws {TypeError} for invalid options, invalid mapped keys or a forbidden collision.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.deepMapKeys(input, (_, k) => k.toUpperCase());   // => { A: { N: 1 }, B: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepmapkeysobject-callback-options
 */
export function deepMapKeys<T extends object, K extends Key>(
  object: T,
  callback: DeepCallback<K>,
  options: DeepMapKeysOptions
): Partial<Record<RuntimeKey<K>, unknown>> | unknown[];
/**
 * Returns the first matching value during depth-first traversal.
 *
 * Shared/circular containers expand once; the root is excluded. Traversal boundaries retain their
 * property-edge semantics. Traversal is pre-order depth-first, visits own enumerable string/symbol
 * properties and expands only arrays/plain records below the root. See deep traversal rules.
 *
 * @param object The input root whose own enumerable properties are traversed.
 * @param predicate A literal matched by SameValueZero, or a synchronous predicate using truthiness.
 * A function is always a predicate.
 * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
 * to `undefined`.
 * @returns The matching value, or `undefined` when no property matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for invalid options, depths or descent callbacks.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.deepFind(input, 1);    // => 1
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepfindobject-valueorpredicate-options
 */
export function deepFind<S>(object: object, predicate: DeepGuard<S>, options?: TraversalOptions): S | undefined;
/**
 * Returns the first matching value during depth-first traversal.
 *
 * Shared/circular containers expand once; the root is excluded. Traversal boundaries retain their
 * property-edge semantics. Traversal is pre-order depth-first, visits own enumerable string/symbol
 * properties and expands only arrays/plain records below the root. See deep traversal rules.
 *
 * @param object The input root whose own enumerable properties are traversed.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
 * to `undefined`.
 * @returns The matching value, or `undefined` when no property matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for invalid options, depths or descent callbacks.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.deepFind(input, 1);    // => 1
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepfindobject-valueorpredicate-options
 */
export function deepFind<const M = never>(
  object: object,
  valueOrPredicate: DeepMatcher<M>,
  options?: TraversalOptions
): unknown;
/**
 * Returns the last matching value during depth-first traversal.
 *
 * Runs callbacks in forward pre-order and retains the last match. Shared/circular containers expand
 * once; the root is excluded. Traversal boundaries retain their property-edge semantics. Traversal
 * is pre-order depth-first, visits own enumerable string/symbol properties and expands only
 * arrays/plain records below the root. See deep traversal rules.
 *
 * @param object The input root whose own enumerable properties are traversed.
 * @param predicate A literal matched by SameValueZero, or a synchronous predicate using truthiness.
 * A function is always a predicate.
 * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
 * to `undefined`.
 * @returns The matching value, or `undefined` when no property matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for invalid options, depths or descent callbacks.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.deepFindLast(input, v => typeof v === 'number');   // => 2
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepfindlastobject-valueorpredicate-options
 */
export function deepFindLast<S>(object: object, predicate: DeepGuard<S>, options?: TraversalOptions): S | undefined;
/**
 * Returns the last matching value during depth-first traversal.
 *
 * Runs callbacks in forward pre-order and retains the last match. Shared/circular containers expand
 * once; the root is excluded. Traversal boundaries retain their property-edge semantics. Traversal
 * is pre-order depth-first, visits own enumerable string/symbol properties and expands only
 * arrays/plain records below the root. See deep traversal rules.
 *
 * @param object The input root whose own enumerable properties are traversed.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
 * to `undefined`.
 * @returns The matching value, or `undefined` when no property matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for invalid options, depths or descent callbacks.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.deepFindLast(input, v => typeof v === 'number');   // => 2
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepfindlastobject-valueorpredicate-options
 */
export function deepFindLast<const M = never>(
  object: object,
  valueOrPredicate: DeepMatcher<M>,
  options?: TraversalOptions
): unknown;
/**
 * Returns all matching values during depth-first traversal.
 *
 * Shared/circular containers expand once; the root is excluded. Traversal boundaries retain their
 * property-edge semantics. Traversal is pre-order depth-first, visits own enumerable string/symbol
 * properties and expands only arrays/plain records below the root. See deep traversal rules.
 *
 * @param object The input root whose own enumerable properties are traversed.
 * @param predicate A literal matched by SameValueZero, or a synchronous predicate using truthiness.
 * A function is always a predicate.
 * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
 * to `undefined`.
 * @returns A new array of matching values in traversal order, or `[]`.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for invalid options, depths or descent callbacks.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.deepFindAll(input, v => typeof v === 'number');  // => [1, 2]
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepfindallobject-valueorpredicate-options
 */
export function deepFindAll<S>(object: object, predicate: DeepGuard<S>, options?: TraversalOptions): S[];
/**
 * Returns all matching values during depth-first traversal.
 *
 * Shared/circular containers expand once; the root is excluded. Traversal boundaries retain their
 * property-edge semantics. Traversal is pre-order depth-first, visits own enumerable string/symbol
 * properties and expands only arrays/plain records below the root. See deep traversal rules.
 *
 * @param object The input root whose own enumerable properties are traversed.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
 * to `undefined`.
 * @returns A new array of matching values in traversal order, or `[]`.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for invalid options, depths or descent callbacks.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.deepFindAll(input, v => typeof v === 'number');  // => [1, 2]
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepfindallobject-valueorpredicate-options
 */
export function deepFindAll<const M = never>(
  object: object,
  valueOrPredicate: DeepMatcher<M>,
  options?: TraversalOptions
): unknown[];
/**
 * Returns the final key of the first deep match during depth-first traversal.
 *
 * Shared/circular containers expand once; the root is excluded. Traversal boundaries retain their
 * property-edge semantics. Traversal is pre-order depth-first, visits own enumerable string/symbol
 * properties and expands only arrays/plain records below the root. See deep traversal rules.
 *
 * @param object The input root whose own enumerable properties are traversed.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
 * to `undefined`.
 * @returns The final string or symbol key of the first match, or `undefined`.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for invalid options, depths or descent callbacks.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.deepFindKey(input, 1);   // => 'n'
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepfindkeyobject-valueorpredicate-options
 */
export function deepFindKey<const M = never>(
  object: object,
  valueOrPredicate: DeepMatcher<M>,
  options?: TraversalOptions
): string | symbol | undefined;
/**
 * Returns the path to the first deep match during depth-first traversal.
 *
 * Shared/circular containers expand once; the root is excluded. Traversal boundaries retain their
 * property-edge semantics. Traversal is pre-order depth-first, visits own enumerable string/symbol
 * properties and expands only arrays/plain records below the root. See deep traversal rules.
 *
 * @param object The input root whose own enumerable properties are traversed.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
 * to `undefined`.
 * @returns A fresh array of string/symbol path segments, or `undefined`.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for invalid options, depths or descent callbacks.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.findPath(input, 1);    // => ['a', 'n']
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#findpathobject-valueorpredicate-options
 */
export function findPath<const M = never>(
  object: object,
  valueOrPredicate: DeepMatcher<M>,
  options?: TraversalOptions
): (string | symbol)[] | undefined;
/**
 * Counts matching property edges during depth-first traversal.
 *
 * Shared/circular containers expand once; the root is excluded. Traversal boundaries retain their
 * property-edge semantics. Traversal is pre-order depth-first, visits own enumerable string/symbol
 * properties and expands only arrays/plain records below the root. See deep traversal rules.
 *
 * @param object The input root whose own enumerable properties are traversed.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
 * to `undefined`.
 * @returns The number of matching visited property edges, excluding the root.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for invalid options, depths or descent callbacks.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.deepCount(input, () => true);  // => 3
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepcountobject-valueorpredicate-options
 */
export function deepCount<const M = never>(
  object: object,
  valueOrPredicate: DeepMatcher<M>,
  options?: TraversalOptions
): number;
/**
 * Removes the first deep match in place and returns its previous value.
 *
 * Deletion uses configurability, not writability, and leaves array holes. Stops at the first match.
 * Replacement objects are not traversed. Earlier writes and user side effects are not rolled back
 * after errors. Traversal is pre-order depth-first, visits own enumerable string/symbol properties
 * and expands only arrays/plain records below the root. See deep traversal rules.
 *
 * @param object The input root whose own enumerable properties are traversed.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
 * to `undefined`.
 * @returns The previous matching value, or `undefined` when no property matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for invalid options, depths or descent callbacks.
 * @throws {TypeError} when a matched property is non-configurable and cannot be deleted.
 * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
 * rolled back.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.deepRemove(input, 1);  // => 1
 * input;                         // => { a: {}, b: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepremoveobject-valueorpredicate-options
 */
export function deepRemove<T extends object, const M = never>(
  object: T & NoInfer<DynamicInput<T>>,
  valueOrPredicate: DeepMatcher<M>,
  options?: TraversalOptions
): unknown;
/**
 * Removes the last deep match in place and returns its previous value.
 *
 * Deletion uses configurability, not writability, and leaves array holes. Inspects the full forward
 * depth-first traversal before applying the final match. Replacement objects are not traversed.
 * Earlier writes and user side effects are not rolled back after errors. Traversal is pre-order
 * depth-first, visits own enumerable string/symbol properties and expands only arrays/plain records
 * below the root. See deep traversal rules.
 *
 * @param object The input root whose own enumerable properties are traversed.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
 * to `undefined`.
 * @returns The previous matching value, or `undefined` when no property matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for invalid options, depths or descent callbacks.
 * @throws {TypeError} when a matched property is non-configurable and cannot be deleted.
 * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
 * rolled back.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.deepRemoveLast(input, v => typeof v === 'number');   // => 2
 * input;                                                       // => { a: { n: 1 } }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepremovelastobject-valueorpredicate-options
 */
export function deepRemoveLast<T extends object, const M = never>(
  object: T & NoInfer<DynamicInput<T>>,
  valueOrPredicate: DeepMatcher<M>,
  options?: TraversalOptions
): unknown;
/**
 * Removes all selected deep matches in place and returns their previous values.
 *
 * Deletion uses configurability, not writability, and leaves array holes. Matched branches are
 * pruned: detached descendants are not subsequently changed. Replacement objects are not traversed.
 * Earlier writes and user side effects are not rolled back after errors. Traversal is pre-order
 * depth-first, visits own enumerable string/symbol properties and expands only arrays/plain records
 * below the root. See deep traversal rules.
 *
 * @param object The input root whose own enumerable properties are traversed.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
 * to `undefined`.
 * @returns A new array of previous values in traversal order, or `[]` when nothing matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for invalid options, depths or descent callbacks.
 * @throws {TypeError} when a matched property is non-configurable and cannot be deleted.
 * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
 * rolled back.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.deepRemoveAll(input, v => typeof v === 'number');  // => [1, 2]
 * input;                                                     // => { a: {} }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepremoveallobject-valueorpredicate-options
 */
export function deepRemoveAll<T extends object, const M = never>(
  object: T & NoInfer<DynamicInput<T>>,
  valueOrPredicate: DeepMatcher<M>,
  options?: TraversalOptions
): unknown[];
/**
 * Replaces the first deep match in place and returns its previous value.
 *
 * A replacement function is called with the normal callback arguments; return a function from it to
 * store function data. Accessor replacement is rejected. Stops at the first match. Replacement
 * objects are not traversed. Earlier writes and user side effects are not rolled back after errors.
 * Traversal is pre-order depth-first, visits own enumerable string/symbol properties and expands
 * only arrays/plain records below the root. See deep traversal rules.
 *
 * @param object The input root whose own enumerable properties are traversed.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @param replacement A literal or synchronous replacement callback. Return a function from a
 * callback to store function data. Typed replacements must fit the matched destinations.
 * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
 * to `undefined`.
 * @returns The previous matching value, or `undefined` when no property matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for invalid options, depths or descent callbacks.
 * @throws {TypeError} when a matched property is an accessor, is non-writable or cannot be written
 * to the destination.
 * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
 * rolled back.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.deepReplace(input, 1, 7);  // => 1
 * input;                             // => { a: { n: 7 }, b: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepreplaceobject-valueorpredicate-replacement-options
 */
export function deepReplace<T extends object, const M = never, const V = never>(
  object: T & NoInfer<DynamicInput<T>>,
  valueOrPredicate: DeepMatcher<M>,
  replacement: DeepMatcher<V>,
  options?: TraversalOptions
): unknown;
/**
 * Replaces the last deep match in place and returns its previous value.
 *
 * A replacement function is called with the normal callback arguments; return a function from it to
 * store function data. Accessor replacement is rejected. Inspects the full forward depth-first
 * traversal before applying the final match. Replacement objects are not traversed. Earlier writes
 * and user side effects are not rolled back after errors. Traversal is pre-order depth-first, visits
 * own enumerable string/symbol properties and expands only arrays/plain records below the root. See
 * deep traversal rules.
 *
 * @param object The input root whose own enumerable properties are traversed.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @param replacement A literal or synchronous replacement callback. Return a function from a
 * callback to store function data. Typed replacements must fit the matched destinations.
 * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
 * to `undefined`.
 * @returns The previous matching value, or `undefined` when no property matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for invalid options, depths or descent callbacks.
 * @throws {TypeError} when a matched property is an accessor, is non-writable or cannot be written
 * to the destination.
 * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
 * rolled back.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.deepReplaceLast(input, v => typeof v === 'number', 7);   // => 2
 * input;                                                           // => { a: { n: 1 }, b: 7 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepreplacelastobject-valueorpredicate-replacement-options
 */
export function deepReplaceLast<T extends object, const M = never, const V = never>(
  object: T & NoInfer<DynamicInput<T>>,
  valueOrPredicate: DeepMatcher<M>,
  replacement: DeepMatcher<V>,
  options?: TraversalOptions
): unknown;
/**
 * Replaces all selected deep matches in place and returns their previous values.
 *
 * A replacement function is called with the normal callback arguments; return a function from it to
 * store function data. Accessor replacement is rejected. Matched branches are pruned: detached
 * descendants are not subsequently changed. Replacement objects are not traversed. Earlier writes
 * and user side effects are not rolled back after errors. Traversal is pre-order depth-first, visits
 * own enumerable string/symbol properties and expands only arrays/plain records below the root. See
 * deep traversal rules.
 *
 * @param object The input root whose own enumerable properties are traversed.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @param replacement A literal or synchronous replacement callback. Return a function from a
 * callback to store function data. Typed replacements must fit the matched destinations.
 * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
 * to `undefined`.
 * @returns A new array of previous values in traversal order, or `[]` when nothing matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for invalid options, depths or descent callbacks.
 * @throws {TypeError} when a matched property is an accessor, is non-writable or cannot be written
 * to the destination.
 * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
 * rolled back.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.deepReplaceAll(input, v => typeof v === 'number', 7);  // => [1, 2]
 * input;                                                         // => { a: { n: 7 }, b: 7 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepreplaceallobject-valueorpredicate-replacement-options
 */
export function deepReplaceAll<T extends object, const M = never, const V = never>(
  object: T & NoInfer<DynamicInput<T>>,
  valueOrPredicate: DeepMatcher<M>,
  replacement: DeepMatcher<V>,
  options?: TraversalOptions
): unknown[];

/**
 * Creates an updated root by setting one path without writing to the input.
 *
 * Copies only containers along the path; untouched branches retain identity. Supports frozen
 * ordinary records and arrays. Off-path aliases and cycles still refer to the original graph. Stores
 * the supplied value by reference, including functions. Missing/undefined containers can be created
 * for setting; accessors, array length edits, custom instances and unsupported array prototypes are
 * rejected.
 *
 * @param object The input object or value.
 * @param path A string, symbol, safe integer or array of those keys. String paths support dot and
 * quoted/numeric bracket syntax.
 * @param value The literal value to store by reference. Its type determines the updated result type;
 * schema changes are allowed.
 * @returns The updated root, or the original root for an existing value unchanged by `Object.is`.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for an invalid path or key; malformed string syntax is rejected with
 * `SyntaxError`.
 * @throws {RangeError} for an empty mutation path; `TypeError` for unsafe path segments, unsupported
 * containers or forbidden writes.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.setImmutable(input, ['a', 'n'], 7);  // => { a: { n: 7 }, b: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#setimmutableobject-path-value
 */
export function setImmutable<T extends object, const P extends Path, V>(
  object: T,
  path: P & ValidImmutablePath<T, P>,
  value: V
): ImmutableSet<T, P, V>;
/**
 * Creates an updated root by computing a path value without writing to the input.
 *
 * Copies only containers along the path; untouched branches retain identity. Supports frozen
 * ordinary records and arrays. Off-path aliases and cycles still refer to the original graph. Calls
 * the updater once and stores its result without awaiting it. Callback/proxy side effects are not
 * rolled back. Missing/undefined containers can be created for setting; accessors, array length
 * edits, custom instances and unsupported array prototypes are rejected.
 *
 * @param object The input object or value.
 * @param path A string, symbol, safe integer or array of those keys. String paths support dot and
 * quoted/numeric bracket syntax.
 * @param updater Called once with the previous value; returns the replacement without awaiting it.
 * Avoid mutating the input in the callback.
 * @returns The updated root, or the original root for an existing value unchanged by `Object.is`.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection or required callback.
 * @throws {TypeError} for an invalid path or key; malformed string syntax is rejected with
 * `SyntaxError`.
 * @throws {RangeError} for an empty mutation path; `TypeError` for unsafe path segments, unsupported
 * containers or forbidden writes.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.updateImmutable(input, ['a', 'n'], n => n + 1);  // => { a: { n: 2 }, b: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#updateimmutableobject-path-updater
 */
export function updateImmutable<T extends object, const P extends Path, V>(
  object: T,
  path: P & ValidImmutablePath<T, P>,
  updater: (current: GetResult<T, P>) => V
): ImmutableSet<T, P, V>;
/**
 * Creates an updated root without one own property, leaving the input unchanged.
 *
 * Copies only containers along the path; untouched branches retain identity. Supports frozen
 * ordinary records and arrays. Off-path aliases and cycles still refer to the original graph. Array
 * index deletion leaves a hole. Existing `null` or scalar intermediates throw, unlike mutating
 * `unset`. Missing/undefined containers can be created for setting; accessors, array length edits,
 * custom instances and unsupported array prototypes are rejected.
 *
 * @param object The input object or value.
 * @param path A string, symbol, safe integer or array of those keys. String paths support dot and
 * quoted/numeric bracket syntax.
 * @returns The updated root, or the original root for an absent path.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for an invalid path or key; malformed string syntax is rejected with
 * `SyntaxError`.
 * @throws {RangeError} for an empty mutation path; `TypeError` for unsafe path segments, unsupported
 * containers or forbidden writes.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.unsetImmutable(input, ['a', 'n']);   // => { a: {}, b: 2 }
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#unsetimmutableobject-path
 */
export function unsetImmutable<T extends object, const P extends Path>(
  object: T,
  path: P & ValidImmutablePath<T, P>
): ImmutableUnset<T, P>;
/**
 * Returns the path and observed value of the first deep match during depth-first traversal.
 *
 * Captures the independent path and value at the match without rereading the getter. Shared/circular
 * containers expand once; the root is excluded. Traversal boundaries retain their property-edge
 * semantics. Traversal is pre-order depth-first, visits own enumerable string/symbol properties and
 * expands only arrays/plain records below the root. See deep traversal rules.
 *
 * @param object The input root whose own enumerable properties are traversed.
 * @param predicate A literal matched by SameValueZero, or a synchronous predicate using truthiness.
 * A function is always a predicate.
 * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
 * to `undefined`.
 * @returns A `[pathSegments, observedValue]` pair, or `undefined` when no property matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for invalid options, depths or descent callbacks.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.deepFindEntry(input, 1);   // => [['a', 'n'], 1]
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepfindentryobject-valueorpredicate-options
 */
export function deepFindEntry<S>(
  object: object,
  predicate: DeepGuard<S>,
  options?: TraversalOptions
): [(string | symbol)[], S] | undefined;
/**
 * Returns the path and observed value of the first deep match during depth-first traversal.
 *
 * Captures the independent path and value at the match without rereading the getter. Shared/circular
 * containers expand once; the root is excluded. Traversal boundaries retain their property-edge
 * semantics. Traversal is pre-order depth-first, visits own enumerable string/symbol properties and
 * expands only arrays/plain records below the root. See deep traversal rules.
 *
 * @param object The input root whose own enumerable properties are traversed.
 * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
 * truthiness. A function is always a predicate.
 * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
 * to `undefined`.
 * @returns A `[pathSegments, observedValue]` pair, or `undefined` when no property matches.
 * @throws {TypeError} when a required argument is omitted.
 * @throws {TypeError} for an invalid collection.
 * @throws {TypeError} for invalid options, depths or descent callbacks.
 * @throws Errors from getters, proxy traps or user callbacks propagate.
 * @example
 * const input = { a: { n: 1 }, b: 2 };
 * Objects.deepFindEntry(input, 1);   // => [['a', 'n'], 1]
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepfindentryobject-valueorpredicate-options
 */
export function deepFindEntry<const M = never>(
  object: object,
  valueOrPredicate: DeepMatcher<M>,
  options?: TraversalOptions
): [(string | symbol)[], unknown] | undefined;

/** Current pipeline value T and last operation result R are tracked separately. */
export interface Wrapper<T, R = T> {
  /**
   * Creates an updated root by setting one path without writing to the input.
   *
   * Copies only containers along the path; untouched branches retain identity. Supports frozen
   * ordinary records and arrays. Off-path aliases and cycles still refer to the original graph. Stores
   * the supplied value by reference, including functions. Missing/undefined containers can be created
   * for setting; accessors, array length edits, custom instances and unsupported array prototypes are
   * rejected.
   *
   * @param path A string, symbol, safe integer or array of those keys. String paths support dot and
   * quoted/numeric bracket syntax.
   * @param value The literal value to store by reference. Its type determines the updated result type;
   * schema changes are allowed.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} for an invalid path or key; malformed string syntax is rejected with
   * `SyntaxError`.
   * @throws {RangeError} for an empty mutation path; `TypeError` for unsafe path segments, unsupported
   * containers or forbidden writes.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#setimmutableobject-path-value
   */
  setImmutable<const P extends Path, V>(
    this: CollectionThis<T, R>,
    path: P & ValidImmutablePath<T, P>,
    value: V
  ): Wrapper<ImmutableSet<T, P, V>>;
  /**
   * Creates an updated root by computing a path value without writing to the input.
   *
   * Copies only containers along the path; untouched branches retain identity. Supports frozen
   * ordinary records and arrays. Off-path aliases and cycles still refer to the original graph. Calls
   * the updater once and stores its result without awaiting it. Callback/proxy side effects are not
   * rolled back. Missing/undefined containers can be created for setting; accessors, array length
   * edits, custom instances and unsupported array prototypes are rejected.
   *
   * @param path A string, symbol, safe integer or array of those keys. String paths support dot and
   * quoted/numeric bracket syntax.
   * @param updater Called once with the previous value; returns the replacement without awaiting it.
   * Avoid mutating the input in the callback.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection or required callback.
   * @throws {TypeError} for an invalid path or key; malformed string syntax is rejected with
   * `SyntaxError`.
   * @throws {RangeError} for an empty mutation path; `TypeError` for unsafe path segments, unsupported
   * containers or forbidden writes.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#updateimmutableobject-path-updater
   */
  updateImmutable<const P extends Path, V>(
    this: CollectionThis<T, R>,
    path: P & ValidImmutablePath<T, P>,
    updater: (current: GetResult<T, P>) => V
  ): Wrapper<ImmutableSet<T, P, V>>;
  /**
   * Creates an updated root without one own property, leaving the input unchanged.
   *
   * Copies only containers along the path; untouched branches retain identity. Supports frozen
   * ordinary records and arrays. Off-path aliases and cycles still refer to the original graph. Array
   * index deletion leaves a hole. Existing `null` or scalar intermediates throw, unlike mutating
   * `unset`. Missing/undefined containers can be created for setting; accessors, array length edits,
   * custom instances and unsupported array prototypes are rejected.
   *
   * @param path A string, symbol, safe integer or array of those keys. String paths support dot and
   * quoted/numeric bracket syntax.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} for an invalid path or key; malformed string syntax is rejected with
   * `SyntaxError`.
   * @throws {RangeError} for an empty mutation path; `TypeError` for unsafe path segments, unsupported
   * containers or forbidden writes.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#unsetimmutableobject-path
   */
  unsetImmutable<const P extends Path>(
    this: CollectionThis<T, R>,
    path: P & ValidImmutablePath<T, P>
  ): Wrapper<ImmutableUnset<T, P>>;
  /**
   * Returns the path and observed value of the first deep match during depth-first traversal.
   *
   * Captures the independent path and value at the match without rereading the getter. Shared/circular
   * containers expand once; the root is excluded. Traversal boundaries retain their property-edge
   * semantics. Traversal is pre-order depth-first, visits own enumerable string/symbol properties and
   * expands only arrays/plain records below the root. See deep traversal rules.
   *
   * @param predicate A literal matched by SameValueZero, or a synchronous predicate using truthiness.
   * A function is always a predicate.
   * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
   * to `undefined`.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} for invalid options, depths or descent callbacks.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepfindentryobject-valueorpredicate-options
   */
  deepFindEntry<S>(
    this: CollectionThis<T, R>,
    predicate: DeepGuard<S>,
    options?: TraversalOptions
  ): Wrapper<[(string | symbol)[], S] | undefined>;
  /**
   * Returns the path and observed value of the first deep match during depth-first traversal.
   *
   * Captures the independent path and value at the match without rereading the getter. Shared/circular
   * containers expand once; the root is excluded. Traversal boundaries retain their property-edge
   * semantics. Traversal is pre-order depth-first, visits own enumerable string/symbol properties and
   * expands only arrays/plain records below the root. See deep traversal rules.
   *
   * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate.
   * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
   * to `undefined`.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} for invalid options, depths or descent callbacks.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepfindentryobject-valueorpredicate-options
   */
  deepFindEntry<const M = never>(
    this: CollectionThis<T, R>,
    valueOrPredicate: DeepMatcher<M>,
    options?: TraversalOptions
  ): Wrapper<[(string | symbol)[], unknown] | undefined>;
  /**
   * Returns the current pipeline value of a wrapper.
   * @returns The current value, retained after a mutator or replaced by a transformation/query result.
   */
  unwrap(): T;
  /**
   * Returns the last operation’s standalone result from a wrapper.
   * @returns The latest standalone return value, or the initial input for a new wrapper.
   */
  result(): R;
  /**
   * Creates a shallow copy of supported data while preserving property descriptors.
   *
   * Retains child references, accessors and ordinary-record prototypes. Supported built-ins have valid
   * copied native state but may use local-realm prototypes. Unsupported values remain references by
   * default or throw in strict mode.
   *
   * @param [options] Optional settings; see the clone support policy in the full API documentation.
   * Unknown options throw. Defaults to `undefined`.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for invalid options, including unsupported values under the strict policy.
   * @throws Errors from proxy traps or native Error stack preparation propagate; custom property
   * getters are not invoked.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#clonevalue-options
   */
  clone(options?: CloneOptions): Wrapper<T>;
  /**
   * Creates a graph-preserving copy of supported nested data and property descriptors.
   *
   * Copies supported Map/Set contents and backing-buffer relationships. Unsupported values remain
   * references by default and their children are not visited. User getters are retained without
   * invocation; native Error stack materialisation can invoke `Error.prepareStackTrace`.
   *
   * @param [options] Optional settings; see the clone support policy in the full API documentation.
   * Unknown options throw. Defaults to `undefined`.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for invalid options, including unsupported values under the strict policy.
   * @throws Errors from proxy traps or native Error stack preparation propagate; custom property
   * getters are not invoked.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepclonevalue-options
   */
  deepClone(options?: CloneOptions): Wrapper<T>;
  /**
   * Returns the own enumerable string and symbol keys of a value.
   *
   * String keys follow `Object.keys` order, followed by symbols. Does not read property values.
   *
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws Errors from proxy traps propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#keysobject
   */
  keys(): Wrapper<OwnKey<T>[]>;
  /**
   * Returns the values of own enumerable string and symbol properties.
   *
   * Own enumerable strings are visited before symbols; inherited properties are excluded. Snapshot
   * keys are fixed, deleted properties are skipped and values are read when visited.
   *
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#valuesobject
   */
  values(): Wrapper<Value<T>[]>;
  /**
   * Returns the key-and-value pairs of own enumerable properties.
   *
   * Own enumerable strings are visited before symbols; inherited properties are excluded. Snapshot
   * keys are fixed, deleted properties are skipped and values are read when visited.
   *
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#entriesobject
   */
  entries(): Wrapper<Entry<T>[]>;
  /**
   * Determines whether a value has an own enumerable property with a given key.
   *
   * Invalid key kinds and primitive inputs return `false` without coercion hooks. Does not evaluate
   * the property getter.
   *
   * @param key A string, symbol or safe integer literal key. Invalid key kinds return `false`.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws Errors from proxy traps propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#haskeyobject-key
   */
  hasKey(key: unknown): Wrapper<boolean>;
  /**
   * Determines whether a value has an own property, including a non-enumerable property.
   *
   * Inherited properties, invalid key kinds and primitive inputs return `false`. Does not evaluate the
   * property getter.
   *
   * @param key A string, symbol or safe integer literal key. Invalid key kinds return `false`.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws Errors from proxy traps propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#haspropobject-key
   */
  hasProp(key: unknown): Wrapper<boolean>;
  /**
   * Determines whether an own enumerable property contains a matching value.
   *
   * `NaN` matches itself, signed zeros match and objects/functions compare by identity. Primitive
   * inputs return `false`. Own enumerable strings are visited before symbols; inherited properties are
   * excluded. Snapshot keys are fixed, deleted properties are skipped and values are read when
   * visited.
   *
   * @param value The literal value to match by SameValueZero.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#hasvalueobject-value
   */
  hasValue(value: unknown): Wrapper<boolean>;
  /**
   * Determines whether an own-property path exists, even when its value is `undefined`.
   *
   * Includes non-enumerable properties. The terminal getter is not evaluated; intermediate getters can
   * run. `[]` identifies an object/function root; holes and inherited properties are absent.
   *
   * @param path A string, symbol, safe integer or array of those keys. String paths support dot and
   * quoted/numeric bracket syntax.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid path or key; malformed string syntax is rejected with
   * `SyntaxError`.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#hasobject-path
   */
  has(path: Path): Wrapper<boolean>;
  /**
   * Returns a value at an own-property path, using a default when it is missing or `undefined`.
   *
   * Preserves `null`. Reads each own path step once; does not traverse primitive properties. The empty
   * string names the empty-string property.
   *
   * @param path A string, symbol, safe integer or array of those keys. String paths support dot and
   * quoted/numeric bracket syntax.
   * @param [defaultValue] The fallback for missing or `undefined` path values; preserves `null`.
   * Defaults to `undefined`.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid path or key; malformed string syntax is rejected with
   * `SyntaxError`.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#getobject-path-defaultvalue
   */
  get<const P extends Path>(path: P): Wrapper<GetResult<T, P>>;
  /**
   * Returns a value at an own-property path, using a default when it is missing or `undefined`.
   *
   * Preserves `null`. Reads each own path step once; does not traverse primitive properties. The empty
   * string names the empty-string property.
   *
   * @param path A string, symbol, safe integer or array of those keys. String paths support dot and
   * quoted/numeric bracket syntax.
   * @param defaultValue The fallback for missing or `undefined` path values; preserves `null`.
   * Defaults to `undefined`.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid path or key; malformed string syntax is rejected with
   * `SyntaxError`.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#getobject-path-defaultvalue
   */
  get<const P extends Path, D>(path: P, defaultValue: D): Wrapper<GetResult<T, P, D>>;
  /**
   * Returns values at several own-property paths in the supplied order.
   *
   * Validates the complete path list before reading values. Paths can repeat. Defaults replace
   * missing/`undefined` values, not `null`.
   *
   * @param paths An actual array of paths, processed in list order.
   * @param [defaultValue] The fallback for missing or `undefined` path values; preserves `null`.
   * Defaults to `undefined`.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid path or key; malformed string syntax is rejected with
   * `SyntaxError`.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#geteachobject-paths-defaultvalue
   */
  getEach<const P extends readonly Path[]>(paths: P): Wrapper<PathResults<T, P>>;
  /**
   * Returns values at several own-property paths in the supplied order.
   *
   * Validates the complete path list before reading values. Paths can repeat. Defaults replace
   * missing/`undefined` values, not `null`.
   *
   * @param paths An actual array of paths, processed in list order.
   * @param defaultValue The fallback for missing or `undefined` path values; preserves `null`.
   * Defaults to `undefined`.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid path or key; malformed string syntax is rejected with
   * `SyntaxError`.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#geteachobject-paths-defaultvalue
   */
  getEach<const P extends readonly Path[], D>(paths: P, defaultValue: D): Wrapper<PathResults<T, P, D>>;
  /**
   * Sets a value at an own-property path and returns its previous value.
   *
   * Mutates the input. Stores functions and other supplied values as data. Creates missing/`undefined`
   * intermediates, but does not replace `null` or primitive intermediates.
   *
   * @param path A string, symbol, safe integer or array of those keys. String paths support dot and
   * quoted/numeric bracket syntax.
   * @param value The literal value to store; typed writes must satisfy the selected path.
   * @returns A new wrapper. Its current value remains the mutated input; its last result is the
   * standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} for an invalid path or key; malformed string syntax is rejected with
   * `SyntaxError`.
   * @throws {RangeError} for an empty mutation path; `TypeError` for unsafe path segments, unsupported
   * containers or forbidden writes.
   * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
   * rolled back.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#setobject-path-value
   */
  set<const P extends Path>(
    this: CollectionThis<T, R>,
    path: P,
    value: NoInfer<WriteValue<T, P>>
  ): Wrapper<T, GetResult<T, P>>;
  /**
   * Updates an own-property path by calling an updater once with its previous value.
   *
   * Mutates the input. Checks the path, data descriptors and ordinary destination restrictions before
   * calling `updater(previousValue)`. Missing parents are attached only after it returns. Native value
   * validation and exotic-object write restrictions can still fail afterward. Rechecks restrictions
   * after callback side effects. Returned functions or promises are stored, not invoked or awaited.
   *
   * @param path A string, symbol, safe integer or array of those keys. String paths support dot and
   * quoted/numeric bracket syntax.
   * @param updater Called once with the previous value; returns the replacement without awaiting it.
   * Avoid mutating the input in the callback.
   * @returns A new wrapper. Its current value remains the mutated input; its last result is the
   * standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection or required callback.
   * @throws {TypeError} for an invalid path or key; malformed string syntax is rejected with
   * `SyntaxError`.
   * @throws {RangeError} for an empty mutation path; `TypeError` for unsafe path segments, unsupported
   * containers or forbidden writes.
   * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
   * rolled back.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#updateobject-path-updater
   */
  update<const P extends Path>(
    this: CollectionThis<T, R>,
    path: P,
    updater: (current: GetResult<T, P>) => NoInfer<WriteValue<T, P>>
  ): Wrapper<T, GetResult<T, P>>;
  /**
   * Sets the same value at several own-property paths and returns their previous values.
   *
   * Mutates the input and stores one shared value/reference. Validates all paths before the first
   * write, but a later runtime failure does not roll back earlier writes.
   *
   * @param paths An actual array of paths, processed in list order.
   * @param value The literal value to store; typed writes must satisfy the selected path.
   * @returns A new wrapper. Its current value remains the mutated input; its last result is the
   * standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} for an invalid path or key; malformed string syntax is rejected with
   * `SyntaxError`.
   * @throws {RangeError} for an empty mutation path; `TypeError` for unsafe path segments, unsupported
   * containers or forbidden writes.
   * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
   * rolled back.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#seteachobject-paths-value
   */
  setEach<const P extends readonly Path[]>(
    this: CollectionThis<T, R>,
    paths: P,
    value: NoInfer<BatchValue<T, P>>
  ): Wrapper<T, PathResults<T, P>>;
  /**
   * Removes an own property at a path without shifting array indexes.
   *
   * Mutates the input. Missing, `null` or scalar intermediate branches count as absent. Array index
   * deletion leaves a hole and retains length. Does not create containers. A configurable terminal
   * accessor can be deleted without evaluating its getter; intermediate accessors remain forbidden.
   *
   * @param path A string, symbol, safe integer or array of those keys. String paths support dot and
   * quoted/numeric bracket syntax.
   * @returns A new wrapper. Its current value remains the mutated input; its last result is the
   * standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} for an invalid path or key; malformed string syntax is rejected with
   * `SyntaxError`.
   * @throws {TypeError} for unsafe paths, an invalid root, intermediate accessors or a
   * non-configurable final property.
   * @throws {RangeError} for an empty mutation path.
   * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
   * rolled back.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#unsetobject-path
   */
  unset<const P extends Path>(this: CollectionThis<T, R>, path: P & DeletePath<T, P>): Wrapper<T, true>;
  /**
   * Visits each own enumerable property and returns the original object.
   *
   * Does not itself write to the input; callbacks may do so. Own enumerable strings are visited before
   * symbols; inherited properties are excluded. Snapshot keys are fixed, deleted properties are
   * skipped and values are read when visited.
   *
   * @param callback Called with `(value, key, object)` and `this` bound to the input. Results are not
   * awaited.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection or required callback.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#foreachobject-callback
   */
  forEach(this: CollectionThis<T, R>, callback: Callback<Input<T>, unknown>): Wrapper<T>;
  /**
   * Creates an object or array by transforming each own enumerable value.
   *
   * Arrays retain length and holes. Values returned by callbacks are stored without awaiting them. Own
   * enumerable strings are visited before symbols; inherited properties are excluded. Snapshot keys
   * are fixed, deleted properties are skipped and values are read when visited.
   *
   * @param callback Called with `(value, key, object)` and `this` bound to the input. Results are not
   * awaited.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection or required callback.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#mapobject-callback
   */
  map<U>(this: CollectionThis<T, R>, callback: Callback<Input<T>, U>): Wrapper<Mapped<T, U>>;
  /**
   * Creates a record by renaming own enumerable keys while retaining their values.
   *
   * Arrays become records. The last colliding key wins by default; `onCollision: 'throw'` rejects
   * collisions. Numeric results normalise to strings before collision checks. Own enumerable strings
   * are visited before symbols; inherited properties are excluded. Snapshot keys are fixed, deleted
   * properties are skipped and values are read when visited.
   *
   * @param callback Called with `(value, key, object)` and `this` bound to the input. Must return a
   * string, symbol or safe integer key.
   * @param [options] Optional settings; see key-mapping collision rules below. Unknown options throw.
   * Defaults to `undefined`.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection or required callback.
   * @throws {TypeError} for invalid options, invalid mapped keys or a forbidden collision.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#mapkeysobject-callback-options
   */
  mapKeys<K extends Key>(
    this: CollectionThis<T, R>,
    callback: Callback<Input<T>, K>,
    options?: MapKeysOptions
  ): Wrapper<Renamed<T, K>>;
  /**
   * Creates an object or array retaining properties whose predicate result is truthy.
   *
   * Retained array indexes compact; retained extra enumerable string/symbol properties remain. Own
   * enumerable strings are visited before symbols; inherited properties are excluded. Snapshot keys
   * are fixed, deleted properties are skipped and values are read when visited.
   *
   * @param predicate Called with `(value, key, object)` and `this` bound to the input. Truthy results
   * retain the property.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection or required callback.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#filterobject-predicate
   */
  filter<S extends Value<T>>(
    this: CollectionThis<T, R>,
    predicate: Guard<Input<T>, S & Value<Input<T>>>
  ): Wrapper<Filtered<T, S>>;
  /**
   * Creates an object or array retaining properties whose predicate result is truthy.
   *
   * Retained array indexes compact; retained extra enumerable string/symbol properties remain. Own
   * enumerable strings are visited before symbols; inherited properties are excluded. Snapshot keys
   * are fixed, deleted properties are skipped and values are read when visited.
   *
   * @param predicate Called with `(value, key, object)` and `this` bound to the input. Truthy results
   * retain the property.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection or required callback.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#filterobject-predicate
   */
  filter(this: CollectionThis<T, R>, predicate: Predicate<Input<T>>): Wrapper<Filtered<T>>;
  /**
   * Determines whether any own enumerable property matches a value or predicate.
   *
   * Stops callbacks and value reads after the first match; keys are snapshotted before searching. Own
   * enumerable strings are visited before symbols; inherited properties are excluded. Snapshot keys
   * are fixed, deleted properties are skipped and values are read when visited.
   *
   * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#someobject-valueorpredicate
   */
  some<const M = never>(this: CollectionThis<T, R>, valueOrPredicate: Matcher<Input<T>, M>): Wrapper<boolean>;
  /**
   * Determines whether every own enumerable property matches a value or predicate.
   *
   * Stops callbacks and value reads at the first failure; keys are snapshotted before searching. Own
   * enumerable strings are visited before symbols; inherited properties are excluded. Snapshot keys
   * are fixed, deleted properties are skipped and values are read when visited.
   *
   * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#everyobject-valueorpredicate
   */
  every<const M = never>(this: CollectionThis<T, R>, valueOrPredicate: Matcher<Input<T>, M>): Wrapper<boolean>;
  /**
   * Returns the first own enumerable value matching a literal or predicate.
   *
   * Use `findEntry` to distinguish a found `undefined` from no match. Own enumerable strings are
   * visited before symbols; inherited properties are excluded. Snapshot keys are fixed, deleted
   * properties are skipped and values are read when visited.
   *
   * @param predicate A literal matched by SameValueZero, or a synchronous predicate using truthiness.
   * A function is always a predicate.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#findobject-valueorpredicate
   */
  find<S extends Value<T>>(
    this: CollectionThis<T, R>,
    predicate: Guard<Input<T>, S & Value<Input<T>>>
  ): Wrapper<S | undefined>;
  /**
   * Returns the first own enumerable value matching a literal or predicate.
   *
   * Use `findEntry` to distinguish a found `undefined` from no match. Own enumerable strings are
   * visited before symbols; inherited properties are excluded. Snapshot keys are fixed, deleted
   * properties are skipped and values are read when visited.
   *
   * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#findobject-valueorpredicate
   */
  find<const M = never>(
    this: CollectionThis<T, R>,
    valueOrPredicate: Matcher<Input<T>, M>
  ): Wrapper<Value<T> | undefined>;
  /**
   * Returns the last own enumerable value matching a literal or predicate.
   *
   * Visits keys in reverse order. Use `findEntry` to distinguish a found `undefined` from no match.
   * The complete own-enumerable key list is visited in reverse, so symbols precede strings. Inherited
   * properties are excluded. Snapshot keys are fixed, deleted properties are skipped and values are
   * read when visited.
   *
   * @param predicate A literal matched by SameValueZero, or a synchronous predicate using truthiness.
   * A function is always a predicate.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#findlastobject-valueorpredicate
   */
  findLast<S extends Value<T>>(
    this: CollectionThis<T, R>,
    predicate: Guard<Input<T>, S & Value<Input<T>>>
  ): Wrapper<S | undefined>;
  /**
   * Returns the last own enumerable value matching a literal or predicate.
   *
   * Visits keys in reverse order. Use `findEntry` to distinguish a found `undefined` from no match.
   * The complete own-enumerable key list is visited in reverse, so symbols precede strings. Inherited
   * properties are excluded. Snapshot keys are fixed, deleted properties are skipped and values are
   * read when visited.
   *
   * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#findlastobject-valueorpredicate
   */
  findLast<const M = never>(
    this: CollectionThis<T, R>,
    valueOrPredicate: Matcher<Input<T>, M>
  ): Wrapper<Value<T> | undefined>;
  /**
   * Returns all own enumerable values matching a literal or predicate.
   *
   * Own enumerable strings are visited before symbols; inherited properties are excluded. Snapshot
   * keys are fixed, deleted properties are skipped and values are read when visited.
   *
   * @param predicate A literal matched by SameValueZero, or a synchronous predicate using truthiness.
   * A function is always a predicate.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#findallobject-valueorpredicate
   */
  findAll<S extends Value<T>>(
    this: CollectionThis<T, R>,
    predicate: Guard<Input<T>, S & Value<Input<T>>>
  ): Wrapper<S[]>;
  /**
   * Returns all own enumerable values matching a literal or predicate.
   *
   * Own enumerable strings are visited before symbols; inherited properties are excluded. Snapshot
   * keys are fixed, deleted properties are skipped and values are read when visited.
   *
   * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#findallobject-valueorpredicate
   */
  findAll<const M = never>(this: CollectionThis<T, R>, valueOrPredicate: Matcher<Input<T>, M>): Wrapper<Value<T>[]>;
  /**
   * Returns the key of the first own enumerable match.
   *
   * Own enumerable strings are visited before symbols; inherited properties are excluded. Snapshot
   * keys are fixed, deleted properties are skipped and values are read when visited.
   *
   * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#findkeyobject-valueorpredicate
   */
  findKey<const M = never>(
    this: CollectionThis<T, R>,
    valueOrPredicate: Matcher<Input<T>, M>
  ): Wrapper<OwnKey<T> | undefined>;
  /**
   * Returns the key and observed value of the first own enumerable match.
   *
   * Captures the value during matching without rereading its getter. A pair with `undefined`
   * distinguishes a found value from no match. Own enumerable strings are visited before symbols;
   * inherited properties are excluded. Snapshot keys are fixed, deleted properties are skipped and
   * values are read when visited.
   *
   * @param predicate A literal matched by SameValueZero, or a synchronous predicate using truthiness.
   * A function is always a predicate.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#findentryobject-valueorpredicate
   */
  findEntry<S extends Value<T>>(
    this: CollectionThis<T, R>,
    predicate: Guard<Input<T>, S & Value<Input<T>>>
  ): Wrapper<Entry<T, S> | undefined>;
  /**
   * Returns the key and observed value of the first own enumerable match.
   *
   * Captures the value during matching without rereading its getter. A pair with `undefined`
   * distinguishes a found value from no match. Own enumerable strings are visited before symbols;
   * inherited properties are excluded. Snapshot keys are fixed, deleted properties are skipped and
   * values are read when visited.
   *
   * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#findentryobject-valueorpredicate
   */
  findEntry<const M = never>(
    this: CollectionThis<T, R>,
    valueOrPredicate: Matcher<Input<T>, M>
  ): Wrapper<Entry<T> | undefined>;
  /**
   * Counts own enumerable properties, optionally selecting matches.
   *
   * Omitting the matcher does not read property values. Explicit `undefined` matches undefined values
   * and therefore reads values. Own enumerable strings are visited before symbols; inherited
   * properties are excluded. With a matcher, snapshot keys are fixed, deleted properties are skipped
   * and values are read when visited. Without a matcher, only keys are counted; getters are not
   * evaluated.
   *
   * @param [valueOrPredicate] A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate. Defaults to `omitted (count keys without reading
   * values)`.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} for an invalid collection.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#countobject-valueorpredicate
   */
  count(this: CollectionThis<T, R>): Wrapper<number>;
  /**
   * Counts own enumerable properties, optionally selecting matches.
   *
   * Omitting the matcher does not read property values. Explicit `undefined` matches undefined values
   * and therefore reads values. Own enumerable strings are visited before symbols; inherited
   * properties are excluded. With a matcher, snapshot keys are fixed, deleted properties are skipped
   * and values are read when visited. Without a matcher, only keys are counted; getters are not
   * evaluated.
   *
   * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate. Defaults to `omitted (count keys without reading
   * values)`.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} for an invalid collection.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#countobject-valueorpredicate
   */
  count<const M = never>(this: CollectionThis<T, R>, valueOrPredicate: Matcher<Input<T>, M>): Wrapper<number>;
  /**
   * Reduces own enumerable values to one accumulator in forward key order.
   *
   * Without an initial argument, the first visited value seeds the accumulator. Explicit `undefined`
   * is a supplied initial value. An empty input without an initial value throws. Own enumerable
   * strings are visited before symbols; inherited properties are excluded. Snapshot keys are fixed,
   * deleted properties are skipped and values are read when visited.
   *
   * @param reducer Called with `(accumulator, value, key, object)` and `this` bound to the input;
   * returns the next accumulator.
   * @param [initialValue] The initial accumulator. Explicit `undefined` counts as supplied. Defaults
   * to `first visited value when omitted`.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection or required callback.
   * @throws {TypeError} for empty input without an initial accumulator.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#reduceobject-reducer-initialvalue
   */
  reduce(
    this: CollectionThis<T, R>,
    reducer: (this: Input<T>, accumulator: Value<T>, value: Value<T>, key: OwnKey<T>, object: Input<T>) => Value<T>
  ): Wrapper<Value<T>>;
  /**
   * Reduces own enumerable values to one accumulator in forward key order.
   *
   * Without an initial argument, the first visited value seeds the accumulator. Explicit `undefined`
   * is a supplied initial value. An empty input without an initial value throws. Own enumerable
   * strings are visited before symbols; inherited properties are excluded. Snapshot keys are fixed,
   * deleted properties are skipped and values are read when visited.
   *
   * @param reducer Called with `(accumulator, value, key, object)` and `this` bound to the input;
   * returns the next accumulator.
   * @param initialValue The initial accumulator. Explicit `undefined` counts as supplied. Defaults to
   * `first visited value when omitted`.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection or required callback.
   * @throws {TypeError} for empty input without an initial accumulator.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#reduceobject-reducer-initialvalue
   */
  reduce<U>(
    this: CollectionThis<T, R>,
    reducer: (this: Input<T>, accumulator: U, value: Value<T>, key: OwnKey<T>, object: Input<T>) => U,
    initialValue: U
  ): Wrapper<U>;
  /**
   * Reduces own enumerable values to one accumulator in reverse key order.
   *
   * Without an initial argument, the first visited value seeds the accumulator. Explicit `undefined`
   * is a supplied initial value. An empty input without an initial value throws. The complete
   * own-enumerable key list is visited in reverse, so symbols precede strings. Inherited properties
   * are excluded. Snapshot keys are fixed, deleted properties are skipped and values are read when
   * visited.
   *
   * @param reducer Called with `(accumulator, value, key, object)` and `this` bound to the input;
   * returns the next accumulator.
   * @param [initialValue] The initial accumulator. Explicit `undefined` counts as supplied. Defaults
   * to `first visited value when omitted`.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection or required callback.
   * @throws {TypeError} for empty input without an initial accumulator.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#reducerightobject-reducer-initialvalue
   */
  reduceRight(
    this: CollectionThis<T, R>,
    reducer: (this: Input<T>, accumulator: Value<T>, value: Value<T>, key: OwnKey<T>, object: Input<T>) => Value<T>
  ): Wrapper<Value<T>>;
  /**
   * Reduces own enumerable values to one accumulator in reverse key order.
   *
   * Without an initial argument, the first visited value seeds the accumulator. Explicit `undefined`
   * is a supplied initial value. An empty input without an initial value throws. The complete
   * own-enumerable key list is visited in reverse, so symbols precede strings. Inherited properties
   * are excluded. Snapshot keys are fixed, deleted properties are skipped and values are read when
   * visited.
   *
   * @param reducer Called with `(accumulator, value, key, object)` and `this` bound to the input;
   * returns the next accumulator.
   * @param initialValue The initial accumulator. Explicit `undefined` counts as supplied. Defaults to
   * `first visited value when omitted`.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection or required callback.
   * @throws {TypeError} for empty input without an initial accumulator.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#reducerightobject-reducer-initialvalue
   */
  reduceRight<U>(
    this: CollectionThis<T, R>,
    reducer: (this: Input<T>, accumulator: U, value: Value<T>, key: OwnKey<T>, object: Input<T>) => U,
    initialValue: U
  ): Wrapper<U>;
  /**
   * Creates a record containing requested own enumerable keys.
   *
   * The key list contains literal keys, not paths. Duplicate keys do not create duplicate result
   * properties. Requested keys are processed in list order, including duplicates. Each requested
   * property is checked when reached; properties added by earlier getters can therefore be selected.
   *
   * @param keys An actual array of literal keys, not paths; invalid keys throw.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} for an invalid key list.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#pickobject-keys
   */
  pick<const K extends KeyList>(this: CollectionThis<T, R>, keys: K & ValidKeyList<K>): Wrapper<Picked<T, K>>;
  /**
   * Creates a record excluding selected own enumerable keys.
   *
   * Excluded getters are not evaluated. Retained getters are read once; reflection can still trigger
   * proxy traps. Own enumerable strings are visited before symbols; inherited properties are excluded.
   * Snapshot keys are fixed, deleted properties are skipped and values are read when visited.
   *
   * @param keys An actual array of literal keys, not paths; invalid keys throw.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} for an invalid key list.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#omitobject-keys
   */
  omit<const K extends KeyList>(this: CollectionThis<T, R>, keys: K & ValidKeyList<K>): Wrapper<Omitted<T, K>>;
  /**
   * Creates a shallow merged record, with later sources overriding earlier keys.
   *
   * Does not recursively merge nested values or mutate sources. Nested values remain references. Own
   * enumerable strings are visited before symbols; inherited properties are excluded. Snapshot keys
   * are fixed, deleted properties are skipped and values are read when visited.
   *
   * @param others Additional source objects in argument order.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#mergeobject-others
   */
  merge<const Rest extends readonly object[]>(
    this: CollectionThis<T, R>,
    ...others: Rest
  ): Wrapper<MergeResult<RecordShape<T>, Rest>>;
  /**
   * Returns entries of the first object that occur in every other object.
   *
   * Compares values by SameValueZero. With no additional objects, still returns a new record. Own
   * enumerable strings are visited before symbols; inherited properties are excluded. Snapshot keys
   * are fixed, deleted properties are skipped and values are read when visited.
   *
   * @param others Additional source objects in argument order.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#intersectobject-others
   */
  intersect(this: CollectionThis<T, R>, ...others: object[]): Wrapper<Partial<RecordShape<T>>>;
  /**
   * Returns entries of the first object that occur in none of the other objects.
   *
   * Compares values by SameValueZero. With no additional objects, still returns a new record. Own
   * enumerable strings are visited before symbols; inherited properties are excluded. Snapshot keys
   * are fixed, deleted properties are skipped and values are read when visited.
   *
   * @param others Additional source objects in argument order.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#exceptobject-others
   */
  except(this: CollectionThis<T, R>, ...others: object[]): Wrapper<Partial<RecordShape<T>>>;
  /**
   * Removes the first own enumerable match in place and returns its previous value.
   *
   * Deletion uses configurability, not writability, and leaves array holes. Visits keys in forward
   * order. Earlier writes and user side effects are not rolled back after errors. Own enumerable
   * strings are visited before symbols; inherited properties are excluded. Snapshot keys are fixed,
   * deleted properties are skipped and values are read when visited.
   *
   * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate.
   * @returns A new wrapper. Its current value remains the mutated input; its last result is the
   * standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} when a matched property is non-configurable and cannot be deleted.
   * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
   * rolled back.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#removeobject-valueorpredicate
   */
  remove<const M = never>(
    this: CollectionThis<T, R> & Wrapper<DeletableInput<T>, R>,
    valueOrPredicate: Matcher<Input<T>, M>
  ): Wrapper<T, Value<T> | undefined>;
  /**
   * Removes the last own enumerable match in place and returns its previous value.
   *
   * Deletion uses configurability, not writability, and leaves array holes. Visits keys in reverse
   * order. Earlier writes and user side effects are not rolled back after errors. The complete
   * own-enumerable key list is visited in reverse, so symbols precede strings. Inherited properties
   * are excluded. Snapshot keys are fixed, deleted properties are skipped and values are read when
   * visited.
   *
   * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate.
   * @returns A new wrapper. Its current value remains the mutated input; its last result is the
   * standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} when a matched property is non-configurable and cannot be deleted.
   * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
   * rolled back.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#removelastobject-valueorpredicate
   */
  removeLast<const M = never>(
    this: CollectionThis<T, R> & Wrapper<DeletableInput<T>, R>,
    valueOrPredicate: Matcher<Input<T>, M>
  ): Wrapper<T, Value<T> | undefined>;
  /**
   * Removes all selected own enumerable matches in place and returns their previous values.
   *
   * Deletion uses configurability, not writability, and leaves array holes. Visits keys in forward
   * order. Earlier writes and user side effects are not rolled back after errors. Own enumerable
   * strings are visited before symbols; inherited properties are excluded. Snapshot keys are fixed,
   * deleted properties are skipped and values are read when visited.
   *
   * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate.
   * @returns A new wrapper. Its current value remains the mutated input; its last result is the
   * standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} when a matched property is non-configurable and cannot be deleted.
   * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
   * rolled back.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#removeallobject-valueorpredicate
   */
  removeAll<const M = never>(
    this: CollectionThis<T, R> & Wrapper<DeletableInput<T>, R>,
    valueOrPredicate: Matcher<Input<T>, M>
  ): Wrapper<T, Value<T>[]>;
  /**
   * Replaces the first own enumerable match in place and returns its previous value.
   *
   * A replacement function is called with the normal callback arguments; return a function from it to
   * store function data. Accessor replacement is rejected. Visits keys in forward order. Earlier
   * writes and user side effects are not rolled back after errors. Own enumerable strings are visited
   * before symbols; inherited properties are excluded. Snapshot keys are fixed, deleted properties are
   * skipped and values are read when visited.
   *
   * @param predicate A literal matched by SameValueZero, or a synchronous predicate using truthiness.
   * A function is always a predicate.
   * @param replacement A literal or synchronous replacement callback. Return a function from a
   * callback to store function data. Typed replacements must fit the matched destinations.
   * @returns A new wrapper. Its current value remains the mutated input; its last result is the
   * standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} when a matched property is an accessor, is non-writable or cannot be written
   * to the destination.
   * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
   * rolled back.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#replaceobject-valueorpredicate-replacement
   */
  replace<S extends Value<T>, const V = never>(
    this: CollectionThis<T, R>,
    predicate: Guard<Input<T>, S & Value<Input<T>>>,
    replacement: Replacement<Input<T>, S, V>
  ): Wrapper<T, Value<T> | undefined>;
  /**
   * Replaces the first own enumerable match in place and returns its previous value.
   *
   * A replacement function is called with the normal callback arguments; return a function from it to
   * store function data. Accessor replacement is rejected. Visits keys in forward order. Earlier
   * writes and user side effects are not rolled back after errors. Own enumerable strings are visited
   * before symbols; inherited properties are excluded. Snapshot keys are fixed, deleted properties are
   * skipped and values are read when visited.
   *
   * @param match A literal matched by SameValueZero, or a synchronous predicate using truthiness. A
   * function is always a predicate.
   * @param replacement A literal or synchronous replacement callback. Return a function from a
   * callback to store function data. Typed replacements must fit the matched destinations.
   * @returns A new wrapper. Its current value remains the mutated input; its last result is the
   * standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} when a matched property is an accessor, is non-writable or cannot be written
   * to the destination.
   * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
   * rolled back.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#replaceobject-valueorpredicate-replacement
   */
  replace<const M extends object | Primitive, const V = never>(
    this: CollectionThis<T, R>,
    match: M & NonFunction<M>,
    replacement: Replacement<Input<T>, M, V>
  ): Wrapper<T, Value<T> | undefined>;
  /**
   * Replaces the first own enumerable match in place and returns its previous value.
   *
   * A replacement function is called with the normal callback arguments; return a function from it to
   * store function data. Accessor replacement is rejected. Visits keys in forward order. Earlier
   * writes and user side effects are not rolled back after errors. Own enumerable strings are visited
   * before symbols; inherited properties are excluded. Snapshot keys are fixed, deleted properties are
   * skipped and values are read when visited.
   *
   * @param predicate A literal matched by SameValueZero, or a synchronous predicate using truthiness.
   * A function is always a predicate.
   * @param replacement A literal or synchronous replacement callback. Return a function from a
   * callback to store function data. Typed replacements must fit the matched destinations.
   * @returns A new wrapper. Its current value remains the mutated input; its last result is the
   * standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} when a matched property is an accessor, is non-writable or cannot be written
   * to the destination.
   * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
   * rolled back.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#replaceobject-valueorpredicate-replacement
   */
  replace<const V = never>(
    this: CollectionThis<T, R>,
    predicate: Predicate<Input<T>>,
    replacement: Replacement<Input<T>, Value<Input<T>>, V>
  ): Wrapper<T, Value<T> | undefined>;
  /**
   * Replaces the last own enumerable match in place and returns its previous value.
   *
   * A replacement function is called with the normal callback arguments; return a function from it to
   * store function data. Accessor replacement is rejected. Visits keys in reverse order. Earlier
   * writes and user side effects are not rolled back after errors. The complete own-enumerable key
   * list is visited in reverse, so symbols precede strings. Inherited properties are excluded.
   * Snapshot keys are fixed, deleted properties are skipped and values are read when visited.
   *
   * @param predicate A literal matched by SameValueZero, or a synchronous predicate using truthiness.
   * A function is always a predicate.
   * @param replacement A literal or synchronous replacement callback. Return a function from a
   * callback to store function data. Typed replacements must fit the matched destinations.
   * @returns A new wrapper. Its current value remains the mutated input; its last result is the
   * standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} when a matched property is an accessor, is non-writable or cannot be written
   * to the destination.
   * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
   * rolled back.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#replacelastobject-valueorpredicate-replacement
   */
  replaceLast<S extends Value<T>, const V = never>(
    this: CollectionThis<T, R>,
    predicate: Guard<Input<T>, S & Value<Input<T>>>,
    replacement: Replacement<Input<T>, S, V>
  ): Wrapper<T, Value<T> | undefined>;
  /**
   * Replaces the last own enumerable match in place and returns its previous value.
   *
   * A replacement function is called with the normal callback arguments; return a function from it to
   * store function data. Accessor replacement is rejected. Visits keys in reverse order. Earlier
   * writes and user side effects are not rolled back after errors. The complete own-enumerable key
   * list is visited in reverse, so symbols precede strings. Inherited properties are excluded.
   * Snapshot keys are fixed, deleted properties are skipped and values are read when visited.
   *
   * @param match A literal matched by SameValueZero, or a synchronous predicate using truthiness. A
   * function is always a predicate.
   * @param replacement A literal or synchronous replacement callback. Return a function from a
   * callback to store function data. Typed replacements must fit the matched destinations.
   * @returns A new wrapper. Its current value remains the mutated input; its last result is the
   * standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} when a matched property is an accessor, is non-writable or cannot be written
   * to the destination.
   * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
   * rolled back.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#replacelastobject-valueorpredicate-replacement
   */
  replaceLast<const M extends object | Primitive, const V = never>(
    this: CollectionThis<T, R>,
    match: M & NonFunction<M>,
    replacement: Replacement<Input<T>, M, V>
  ): Wrapper<T, Value<T> | undefined>;
  /**
   * Replaces the last own enumerable match in place and returns its previous value.
   *
   * A replacement function is called with the normal callback arguments; return a function from it to
   * store function data. Accessor replacement is rejected. Visits keys in reverse order. Earlier
   * writes and user side effects are not rolled back after errors. The complete own-enumerable key
   * list is visited in reverse, so symbols precede strings. Inherited properties are excluded.
   * Snapshot keys are fixed, deleted properties are skipped and values are read when visited.
   *
   * @param predicate A literal matched by SameValueZero, or a synchronous predicate using truthiness.
   * A function is always a predicate.
   * @param replacement A literal or synchronous replacement callback. Return a function from a
   * callback to store function data. Typed replacements must fit the matched destinations.
   * @returns A new wrapper. Its current value remains the mutated input; its last result is the
   * standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} when a matched property is an accessor, is non-writable or cannot be written
   * to the destination.
   * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
   * rolled back.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#replacelastobject-valueorpredicate-replacement
   */
  replaceLast<const V = never>(
    this: CollectionThis<T, R>,
    predicate: Predicate<Input<T>>,
    replacement: Replacement<Input<T>, Value<Input<T>>, V>
  ): Wrapper<T, Value<T> | undefined>;
  /**
   * Replaces all selected own enumerable matches in place and returns their previous values.
   *
   * A replacement function is called with the normal callback arguments; return a function from it to
   * store function data. Accessor replacement is rejected. Visits keys in forward order. Earlier
   * writes and user side effects are not rolled back after errors. Own enumerable strings are visited
   * before symbols; inherited properties are excluded. Snapshot keys are fixed, deleted properties are
   * skipped and values are read when visited.
   *
   * @param predicate A literal matched by SameValueZero, or a synchronous predicate using truthiness.
   * A function is always a predicate.
   * @param replacement A literal or synchronous replacement callback. Return a function from a
   * callback to store function data. Typed replacements must fit the matched destinations.
   * @returns A new wrapper. Its current value remains the mutated input; its last result is the
   * standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} when a matched property is an accessor, is non-writable or cannot be written
   * to the destination.
   * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
   * rolled back.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#replaceallobject-valueorpredicate-replacement
   */
  replaceAll<S extends Value<T>, const V = never>(
    this: CollectionThis<T, R>,
    predicate: Guard<Input<T>, S & Value<Input<T>>>,
    replacement: Replacement<Input<T>, S, V>
  ): Wrapper<T, Value<T>[]>;
  /**
   * Replaces all selected own enumerable matches in place and returns their previous values.
   *
   * A replacement function is called with the normal callback arguments; return a function from it to
   * store function data. Accessor replacement is rejected. Visits keys in forward order. Earlier
   * writes and user side effects are not rolled back after errors. Own enumerable strings are visited
   * before symbols; inherited properties are excluded. Snapshot keys are fixed, deleted properties are
   * skipped and values are read when visited.
   *
   * @param match A literal matched by SameValueZero, or a synchronous predicate using truthiness. A
   * function is always a predicate.
   * @param replacement A literal or synchronous replacement callback. Return a function from a
   * callback to store function data. Typed replacements must fit the matched destinations.
   * @returns A new wrapper. Its current value remains the mutated input; its last result is the
   * standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} when a matched property is an accessor, is non-writable or cannot be written
   * to the destination.
   * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
   * rolled back.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#replaceallobject-valueorpredicate-replacement
   */
  replaceAll<const M extends object | Primitive, const V = never>(
    this: CollectionThis<T, R>,
    match: M & NonFunction<M>,
    replacement: Replacement<Input<T>, M, V>
  ): Wrapper<T, Value<T>[]>;
  /**
   * Replaces all selected own enumerable matches in place and returns their previous values.
   *
   * A replacement function is called with the normal callback arguments; return a function from it to
   * store function data. Accessor replacement is rejected. Visits keys in forward order. Earlier
   * writes and user side effects are not rolled back after errors. Own enumerable strings are visited
   * before symbols; inherited properties are excluded. Snapshot keys are fixed, deleted properties are
   * skipped and values are read when visited.
   *
   * @param predicate A literal matched by SameValueZero, or a synchronous predicate using truthiness.
   * A function is always a predicate.
   * @param replacement A literal or synchronous replacement callback. Return a function from a
   * callback to store function data. Typed replacements must fit the matched destinations.
   * @returns A new wrapper. Its current value remains the mutated input; its last result is the
   * standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} when a matched property is an accessor, is non-writable or cannot be written
   * to the destination.
   * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
   * rolled back.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#replaceallobject-valueorpredicate-replacement
   */
  replaceAll<const V = never>(
    this: CollectionThis<T, R>,
    predicate: Predicate<Input<T>>,
    replacement: Replacement<Input<T>, Value<Input<T>>, V>
  ): Wrapper<T, Value<T>[]>;
  /**
   * Visits own enumerable property edges depth-first and returns the original root.
   *
   * Excludes the root itself. Shared/circular containers expand once, but each encountered property
   * edge is visited. Traversal is pre-order depth-first, visits own enumerable string/symbol
   * properties and expands only arrays/plain records below the root. See deep traversal rules.
   *
   * @param callback Called with `(value, key, parent, path)` and `this` bound to the parent. Results
   * are not awaited.
   * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
   * to `undefined`.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection or required callback.
   * @throws {TypeError} for invalid options, depths or descent callbacks.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepforeachobject-callback-options
   */
  deepForEach(this: CollectionThis<T, R>, callback: DeepCallback<unknown>, options?: TraversalOptions): Wrapper<T>;
  /**
   * Creates a structure by transforming values during depth-first traversal.
   *
   * Returning the original container requests recursive transformation; returning a different value
   * replaces the branch without traversing that replacement. Unexpanded branches and opaque leaves can
   * still reference the input. Traversal is pre-order depth-first, visits own enumerable string/symbol
   * properties and expands only arrays/plain records below the root. See deep traversal rules.
   *
   * @param callback Called with `(value, key, parent, path)` and `this` bound to the parent. Results
   * are not awaited.
   * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
   * to `undefined`.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection or required callback.
   * @throws {TypeError} for invalid options, depths or descent callbacks.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepmapobject-callback-options
   */
  deepMap(
    this: CollectionThis<T, R>,
    callback: DeepCallback<unknown>,
    options?: TraversalOptions
  ): Wrapper<Record<string | symbol, unknown> | unknown[]>;
  /**
   * Creates a structure by retaining matching branches and pruning rejected containers.
   *
   * Rejecting a container excludes its descendants. Unexpanded branches and shared aliases may retain
   * data: this is not an authorisation or complete redaction boundary. Traversal is pre-order
   * depth-first, visits own enumerable string/symbol properties and expands only arrays/plain records
   * below the root. See deep traversal rules.
   *
   * @param callback Called with `(value, key, parent, path)` and `this` bound to the parent. Truthy
   * results retain the property.
   * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
   * to `undefined`.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection or required callback.
   * @throws {TypeError} for invalid options, depths or descent callbacks.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepfilterobject-predicate-options
   */
  deepFilter(
    this: CollectionThis<T, R>,
    callback: DeepCallback<unknown>,
    options?: TraversalOptions
  ): Wrapper<Record<string | symbol, unknown> | unknown[]>;
  /**
   * Creates a structure by recursively renaming own enumerable keys.
   *
   * With preserved arrays, structural indexes bypass the key mapper while child records are traversed.
   * Extra properties cannot be renamed to `length` or canonical indexes. Collisions default to
   * overwrite and can throw per output container. Unexpanded branches remain references. Traversal is
   * pre-order depth-first, visits own enumerable string/symbol properties and expands only
   * arrays/plain records below the root. See deep traversal rules.
   *
   * @param callback Called with `(value, key, parent, path)` and `this` bound to the parent. Must
   * return a string, symbol or safe integer key.
   * @param options Optional settings; see traversal options below. Unknown options throw. Defaults to
   * `undefined`.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection or required callback.
   * @throws {TypeError} for invalid options, invalid mapped keys or a forbidden collision.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepmapkeysobject-callback-options
   */
  deepMapKeys<K extends Key>(
    this: CollectionThis<T, R>,
    callback: DeepCallback<K>,
    options: DeepMapKeysOptions & { arrays: 'preserve' }
  ): Wrapper<DeepRenamed<T, K, { arrays: 'preserve' }>>;
  /**
   * Creates a structure by recursively renaming own enumerable keys.
   *
   * With preserved arrays, structural indexes bypass the key mapper while child records are traversed.
   * Extra properties cannot be renamed to `length` or canonical indexes. Collisions default to
   * overwrite and can throw per output container. Unexpanded branches remain references. Traversal is
   * pre-order depth-first, visits own enumerable string/symbol properties and expands only
   * arrays/plain records below the root. See deep traversal rules.
   *
   * @param callback Called with `(value, key, parent, path)` and `this` bound to the parent. Must
   * return a string, symbol or safe integer key.
   * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
   * to `undefined`.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection or required callback.
   * @throws {TypeError} for invalid options, invalid mapped keys or a forbidden collision.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepmapkeysobject-callback-options
   */
  deepMapKeys<K extends Key>(
    this: CollectionThis<T, R>,
    callback: DeepCallback<K>,
    options?: DeepMapKeysOptions & { arrays?: 'record' }
  ): Wrapper<Partial<Record<RuntimeKey<K>, unknown>>>;
  /**
   * Creates a structure by recursively renaming own enumerable keys.
   *
   * With preserved arrays, structural indexes bypass the key mapper while child records are traversed.
   * Extra properties cannot be renamed to `length` or canonical indexes. Collisions default to
   * overwrite and can throw per output container. Unexpanded branches remain references. Traversal is
   * pre-order depth-first, visits own enumerable string/symbol properties and expands only
   * arrays/plain records below the root. See deep traversal rules.
   *
   * @param callback Called with `(value, key, parent, path)` and `this` bound to the parent. Must
   * return a string, symbol or safe integer key.
   * @param options Optional settings; see traversal options below. Unknown options throw. Defaults to
   * `undefined`.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection or required callback.
   * @throws {TypeError} for invalid options, invalid mapped keys or a forbidden collision.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepmapkeysobject-callback-options
   */
  deepMapKeys<K extends Key>(
    this: CollectionThis<T, R>,
    callback: DeepCallback<K>,
    options: DeepMapKeysOptions
  ): Wrapper<Partial<Record<RuntimeKey<K>, unknown>> | unknown[]>;
  /**
   * Returns the first matching value during depth-first traversal.
   *
   * Shared/circular containers expand once; the root is excluded. Traversal boundaries retain their
   * property-edge semantics. Traversal is pre-order depth-first, visits own enumerable string/symbol
   * properties and expands only arrays/plain records below the root. See deep traversal rules.
   *
   * @param predicate A literal matched by SameValueZero, or a synchronous predicate using truthiness.
   * A function is always a predicate.
   * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
   * to `undefined`.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} for invalid options, depths or descent callbacks.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepfindobject-valueorpredicate-options
   */
  deepFind<S>(this: CollectionThis<T, R>, predicate: DeepGuard<S>, options?: TraversalOptions): Wrapper<S | undefined>;
  /**
   * Returns the first matching value during depth-first traversal.
   *
   * Shared/circular containers expand once; the root is excluded. Traversal boundaries retain their
   * property-edge semantics. Traversal is pre-order depth-first, visits own enumerable string/symbol
   * properties and expands only arrays/plain records below the root. See deep traversal rules.
   *
   * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate.
   * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
   * to `undefined`.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} for invalid options, depths or descent callbacks.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepfindobject-valueorpredicate-options
   */
  deepFind<const M = never>(
    this: CollectionThis<T, R>,
    valueOrPredicate: DeepMatcher<M>,
    options?: TraversalOptions
  ): Wrapper<unknown>;
  /**
   * Returns the last matching value during depth-first traversal.
   *
   * Runs callbacks in forward pre-order and retains the last match. Shared/circular containers expand
   * once; the root is excluded. Traversal boundaries retain their property-edge semantics. Traversal
   * is pre-order depth-first, visits own enumerable string/symbol properties and expands only
   * arrays/plain records below the root. See deep traversal rules.
   *
   * @param predicate A literal matched by SameValueZero, or a synchronous predicate using truthiness.
   * A function is always a predicate.
   * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
   * to `undefined`.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} for invalid options, depths or descent callbacks.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepfindlastobject-valueorpredicate-options
   */
  deepFindLast<S>(
    this: CollectionThis<T, R>,
    predicate: DeepGuard<S>,
    options?: TraversalOptions
  ): Wrapper<S | undefined>;
  /**
   * Returns the last matching value during depth-first traversal.
   *
   * Runs callbacks in forward pre-order and retains the last match. Shared/circular containers expand
   * once; the root is excluded. Traversal boundaries retain their property-edge semantics. Traversal
   * is pre-order depth-first, visits own enumerable string/symbol properties and expands only
   * arrays/plain records below the root. See deep traversal rules.
   *
   * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate.
   * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
   * to `undefined`.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} for invalid options, depths or descent callbacks.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepfindlastobject-valueorpredicate-options
   */
  deepFindLast<const M = never>(
    this: CollectionThis<T, R>,
    valueOrPredicate: DeepMatcher<M>,
    options?: TraversalOptions
  ): Wrapper<unknown>;
  /**
   * Returns all matching values during depth-first traversal.
   *
   * Shared/circular containers expand once; the root is excluded. Traversal boundaries retain their
   * property-edge semantics. Traversal is pre-order depth-first, visits own enumerable string/symbol
   * properties and expands only arrays/plain records below the root. See deep traversal rules.
   *
   * @param predicate A literal matched by SameValueZero, or a synchronous predicate using truthiness.
   * A function is always a predicate.
   * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
   * to `undefined`.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} for invalid options, depths or descent callbacks.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepfindallobject-valueorpredicate-options
   */
  deepFindAll<S>(this: CollectionThis<T, R>, predicate: DeepGuard<S>, options?: TraversalOptions): Wrapper<S[]>;
  /**
   * Returns all matching values during depth-first traversal.
   *
   * Shared/circular containers expand once; the root is excluded. Traversal boundaries retain their
   * property-edge semantics. Traversal is pre-order depth-first, visits own enumerable string/symbol
   * properties and expands only arrays/plain records below the root. See deep traversal rules.
   *
   * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate.
   * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
   * to `undefined`.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} for invalid options, depths or descent callbacks.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepfindallobject-valueorpredicate-options
   */
  deepFindAll<const M = never>(
    this: CollectionThis<T, R>,
    valueOrPredicate: DeepMatcher<M>,
    options?: TraversalOptions
  ): Wrapper<unknown[]>;
  /**
   * Returns the final key of the first deep match during depth-first traversal.
   *
   * Shared/circular containers expand once; the root is excluded. Traversal boundaries retain their
   * property-edge semantics. Traversal is pre-order depth-first, visits own enumerable string/symbol
   * properties and expands only arrays/plain records below the root. See deep traversal rules.
   *
   * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate.
   * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
   * to `undefined`.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} for invalid options, depths or descent callbacks.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepfindkeyobject-valueorpredicate-options
   */
  deepFindKey<const M = never>(
    this: CollectionThis<T, R>,
    valueOrPredicate: DeepMatcher<M>,
    options?: TraversalOptions
  ): Wrapper<string | symbol | undefined>;
  /**
   * Returns the path to the first deep match during depth-first traversal.
   *
   * Shared/circular containers expand once; the root is excluded. Traversal boundaries retain their
   * property-edge semantics. Traversal is pre-order depth-first, visits own enumerable string/symbol
   * properties and expands only arrays/plain records below the root. See deep traversal rules.
   *
   * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate.
   * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
   * to `undefined`.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} for invalid options, depths or descent callbacks.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#findpathobject-valueorpredicate-options
   */
  findPath<const M = never>(
    this: CollectionThis<T, R>,
    valueOrPredicate: DeepMatcher<M>,
    options?: TraversalOptions
  ): Wrapper<(string | symbol)[] | undefined>;
  /**
   * Counts matching property edges during depth-first traversal.
   *
   * Shared/circular containers expand once; the root is excluded. Traversal boundaries retain their
   * property-edge semantics. Traversal is pre-order depth-first, visits own enumerable string/symbol
   * properties and expands only arrays/plain records below the root. See deep traversal rules.
   *
   * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate.
   * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
   * to `undefined`.
   * @returns A new wrapper. Its current value and last result become the standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} for invalid options, depths or descent callbacks.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepcountobject-valueorpredicate-options
   */
  deepCount<const M = never>(
    this: CollectionThis<T, R>,
    valueOrPredicate: DeepMatcher<M>,
    options?: TraversalOptions
  ): Wrapper<number>;
  /**
   * Removes the first deep match in place and returns its previous value.
   *
   * Deletion uses configurability, not writability, and leaves array holes. Stops at the first match.
   * Replacement objects are not traversed. Earlier writes and user side effects are not rolled back
   * after errors. Traversal is pre-order depth-first, visits own enumerable string/symbol properties
   * and expands only arrays/plain records below the root. See deep traversal rules.
   *
   * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate.
   * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
   * to `undefined`.
   * @returns A new wrapper. Its current value remains the mutated input; its last result is the
   * standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} for invalid options, depths or descent callbacks.
   * @throws {TypeError} when a matched property is non-configurable and cannot be deleted.
   * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
   * rolled back.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepremoveobject-valueorpredicate-options
   */
  deepRemove<const M = never>(
    this: CollectionThis<T, R> & Wrapper<DynamicInput<T>, R>,
    valueOrPredicate: DeepMatcher<M>,
    options?: TraversalOptions
  ): Wrapper<T, unknown>;
  /**
   * Removes the last deep match in place and returns its previous value.
   *
   * Deletion uses configurability, not writability, and leaves array holes. Inspects the full forward
   * depth-first traversal before applying the final match. Replacement objects are not traversed.
   * Earlier writes and user side effects are not rolled back after errors. Traversal is pre-order
   * depth-first, visits own enumerable string/symbol properties and expands only arrays/plain records
   * below the root. See deep traversal rules.
   *
   * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate.
   * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
   * to `undefined`.
   * @returns A new wrapper. Its current value remains the mutated input; its last result is the
   * standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} for invalid options, depths or descent callbacks.
   * @throws {TypeError} when a matched property is non-configurable and cannot be deleted.
   * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
   * rolled back.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepremovelastobject-valueorpredicate-options
   */
  deepRemoveLast<const M = never>(
    this: CollectionThis<T, R> & Wrapper<DynamicInput<T>, R>,
    valueOrPredicate: DeepMatcher<M>,
    options?: TraversalOptions
  ): Wrapper<T, unknown>;
  /**
   * Removes all selected deep matches in place and returns their previous values.
   *
   * Deletion uses configurability, not writability, and leaves array holes. Matched branches are
   * pruned: detached descendants are not subsequently changed. Replacement objects are not traversed.
   * Earlier writes and user side effects are not rolled back after errors. Traversal is pre-order
   * depth-first, visits own enumerable string/symbol properties and expands only arrays/plain records
   * below the root. See deep traversal rules.
   *
   * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate.
   * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
   * to `undefined`.
   * @returns A new wrapper. Its current value remains the mutated input; its last result is the
   * standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} for invalid options, depths or descent callbacks.
   * @throws {TypeError} when a matched property is non-configurable and cannot be deleted.
   * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
   * rolled back.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepremoveallobject-valueorpredicate-options
   */
  deepRemoveAll<const M = never>(
    this: CollectionThis<T, R> & Wrapper<DynamicInput<T>, R>,
    valueOrPredicate: DeepMatcher<M>,
    options?: TraversalOptions
  ): Wrapper<T, unknown[]>;
  /**
   * Replaces the first deep match in place and returns its previous value.
   *
   * A replacement function is called with the normal callback arguments; return a function from it to
   * store function data. Accessor replacement is rejected. Stops at the first match. Replacement
   * objects are not traversed. Earlier writes and user side effects are not rolled back after errors.
   * Traversal is pre-order depth-first, visits own enumerable string/symbol properties and expands
   * only arrays/plain records below the root. See deep traversal rules.
   *
   * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate.
   * @param replacement A literal or synchronous replacement callback. Return a function from a
   * callback to store function data. Typed replacements must fit the matched destinations.
   * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
   * to `undefined`.
   * @returns A new wrapper. Its current value remains the mutated input; its last result is the
   * standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} for invalid options, depths or descent callbacks.
   * @throws {TypeError} when a matched property is an accessor, is non-writable or cannot be written
   * to the destination.
   * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
   * rolled back.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepreplaceobject-valueorpredicate-replacement-options
   */
  deepReplace<const M = never, const V = never>(
    this: CollectionThis<T, R> & Wrapper<DynamicInput<T>, R>,
    valueOrPredicate: DeepMatcher<M>,
    replacement: DeepMatcher<V>,
    options?: TraversalOptions
  ): Wrapper<T, unknown>;
  /**
   * Replaces the last deep match in place and returns its previous value.
   *
   * A replacement function is called with the normal callback arguments; return a function from it to
   * store function data. Accessor replacement is rejected. Inspects the full forward depth-first
   * traversal before applying the final match. Replacement objects are not traversed. Earlier writes
   * and user side effects are not rolled back after errors. Traversal is pre-order depth-first, visits
   * own enumerable string/symbol properties and expands only arrays/plain records below the root. See
   * deep traversal rules.
   *
   * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate.
   * @param replacement A literal or synchronous replacement callback. Return a function from a
   * callback to store function data. Typed replacements must fit the matched destinations.
   * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
   * to `undefined`.
   * @returns A new wrapper. Its current value remains the mutated input; its last result is the
   * standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} for invalid options, depths or descent callbacks.
   * @throws {TypeError} when a matched property is an accessor, is non-writable or cannot be written
   * to the destination.
   * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
   * rolled back.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepreplacelastobject-valueorpredicate-replacement-options
   */
  deepReplaceLast<const M = never, const V = never>(
    this: CollectionThis<T, R> & Wrapper<DynamicInput<T>, R>,
    valueOrPredicate: DeepMatcher<M>,
    replacement: DeepMatcher<V>,
    options?: TraversalOptions
  ): Wrapper<T, unknown>;
  /**
   * Replaces all selected deep matches in place and returns their previous values.
   *
   * A replacement function is called with the normal callback arguments; return a function from it to
   * store function data. Accessor replacement is rejected. Matched branches are pruned: detached
   * descendants are not subsequently changed. Replacement objects are not traversed. Earlier writes
   * and user side effects are not rolled back after errors. Traversal is pre-order depth-first, visits
   * own enumerable string/symbol properties and expands only arrays/plain records below the root. See
   * deep traversal rules.
   *
   * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate.
   * @param replacement A literal or synchronous replacement callback. Return a function from a
   * callback to store function data. Typed replacements must fit the matched destinations.
   * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
   * to `undefined`.
   * @returns A new wrapper. Its current value remains the mutated input; its last result is the
   * standalone return.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} for invalid options, depths or descent callbacks.
   * @throws {TypeError} when a matched property is an accessor, is non-writable or cannot be written
   * to the destination.
   * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
   * rolled back.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepreplaceallobject-valueorpredicate-replacement-options
   */
  deepReplaceAll<const M = never, const V = never>(
    this: CollectionThis<T, R> & Wrapper<DynamicInput<T>, R>,
    valueOrPredicate: DeepMatcher<M>,
    replacement: DeepMatcher<V>,
    options?: TraversalOptions
  ): Wrapper<T, unknown[]>;
}

export interface Api {
  /**
   * Creates an updated root by setting one path without writing to the input.
   *
   * Copies only containers along the path; untouched branches retain identity. Supports frozen
   * ordinary records and arrays. Off-path aliases and cycles still refer to the original graph. Stores
   * the supplied value by reference, including functions. Missing/undefined containers can be created
   * for setting; accessors, array length edits, custom instances and unsupported array prototypes are
   * rejected.
   *
   * @param object The input object or value.
   * @param path A string, symbol, safe integer or array of those keys. String paths support dot and
   * quoted/numeric bracket syntax.
   * @param value The literal value to store by reference. Its type determines the updated result type;
   * schema changes are allowed.
   * @returns The updated root, or the original root for an existing value unchanged by `Object.is`.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} for an invalid path or key; malformed string syntax is rejected with
   * `SyntaxError`.
   * @throws {RangeError} for an empty mutation path; `TypeError` for unsafe path segments, unsupported
   * containers or forbidden writes.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @example
   * const input = { a: { n: 1 }, b: 2 };
   * Objects.setImmutable(input, ['a', 'n'], 7);  // => { a: { n: 7 }, b: 2 }
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#setimmutableobject-path-value
   */
  readonly setImmutable: typeof setImmutable;
  /**
   * Creates an updated root by computing a path value without writing to the input.
   *
   * Copies only containers along the path; untouched branches retain identity. Supports frozen
   * ordinary records and arrays. Off-path aliases and cycles still refer to the original graph. Calls
   * the updater once and stores its result without awaiting it. Callback/proxy side effects are not
   * rolled back. Missing/undefined containers can be created for setting; accessors, array length
   * edits, custom instances and unsupported array prototypes are rejected.
   *
   * @param object The input object or value.
   * @param path A string, symbol, safe integer or array of those keys. String paths support dot and
   * quoted/numeric bracket syntax.
   * @param updater Called once with the previous value; returns the replacement without awaiting it.
   * Avoid mutating the input in the callback.
   * @returns The updated root, or the original root for an existing value unchanged by `Object.is`.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection or required callback.
   * @throws {TypeError} for an invalid path or key; malformed string syntax is rejected with
   * `SyntaxError`.
   * @throws {RangeError} for an empty mutation path; `TypeError` for unsafe path segments, unsupported
   * containers or forbidden writes.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @example
   * const input = { a: { n: 1 }, b: 2 };
   * Objects.updateImmutable(input, ['a', 'n'], n => n + 1);  // => { a: { n: 2 }, b: 2 }
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#updateimmutableobject-path-updater
   */
  readonly updateImmutable: typeof updateImmutable;
  /**
   * Creates an updated root without one own property, leaving the input unchanged.
   *
   * Copies only containers along the path; untouched branches retain identity. Supports frozen
   * ordinary records and arrays. Off-path aliases and cycles still refer to the original graph. Array
   * index deletion leaves a hole. Existing `null` or scalar intermediates throw, unlike mutating
   * `unset`. Missing/undefined containers can be created for setting; accessors, array length edits,
   * custom instances and unsupported array prototypes are rejected.
   *
   * @param object The input object or value.
   * @param path A string, symbol, safe integer or array of those keys. String paths support dot and
   * quoted/numeric bracket syntax.
   * @returns The updated root, or the original root for an absent path.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} for an invalid path or key; malformed string syntax is rejected with
   * `SyntaxError`.
   * @throws {RangeError} for an empty mutation path; `TypeError` for unsafe path segments, unsupported
   * containers or forbidden writes.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @example
   * const input = { a: { n: 1 }, b: 2 };
   * Objects.unsetImmutable(input, ['a', 'n']);   // => { a: {}, b: 2 }
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#unsetimmutableobject-path
   */
  readonly unsetImmutable: typeof unsetImmutable;
  /**
   * Returns the path and observed value of the first deep match during depth-first traversal.
   *
   * Captures the independent path and value at the match without rereading the getter. Shared/circular
   * containers expand once; the root is excluded. Traversal boundaries retain their property-edge
   * semantics. Traversal is pre-order depth-first, visits own enumerable string/symbol properties and
   * expands only arrays/plain records below the root. See deep traversal rules.
   *
   * @param object The input root whose own enumerable properties are traversed.
   * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate.
   * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
   * to `undefined`.
   * @returns A `[pathSegments, observedValue]` pair, or `undefined` when no property matches.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} for invalid options, depths or descent callbacks.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @example
   * const input = { a: { n: 1 }, b: 2 };
   * Objects.deepFindEntry(input, 1);   // => [['a', 'n'], 1]
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepfindentryobject-valueorpredicate-options
   */
  readonly deepFindEntry: typeof deepFindEntry;
  /**
   * Creates a fresh wrapper for a value and starts an independent pipeline.
   * Each utility call executes immediately and returns a new wrapper. Explicit
   * mutators still share and change the underlying input data.
   * @param value The initial pipeline value, retained by reference.
   * @returns A fresh wrapper whose current value and last result equal the input.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#objectsvalue
   */
  <T>(value: T): Wrapper<T>;
  /**
   * Creates a fresh wrapper for a value and starts an independent pipeline.
   * Each utility call executes immediately and returns a new wrapper. Explicit
   * mutators still share and change the underlying input data.
   * @param value The initial pipeline value, retained by reference.
   * @returns A fresh wrapper whose current value and last result equal the input.
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#objectsvalue
   */
  new <T>(value: T): Wrapper<T>;
  readonly prototype: Wrapper<unknown>;
  /**
   * Creates a shallow copy of supported data while preserving property descriptors.
   *
   * Retains child references, accessors and ordinary-record prototypes. Supported built-ins have valid
   * copied native state but may use local-realm prototypes. Unsupported values remain references by
   * default or throw in strict mode.
   *
   * @param value The value to copy.
   * @param [options] Optional settings; see the clone support policy in the full API documentation.
   * Unknown options throw. Defaults to `undefined`.
   * @returns A supported object copy, or the original primitive/opaque value according to the
   * unsupported-value policy.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for invalid options, including unsupported values under the strict policy.
   * @throws Errors from proxy traps or native Error stack preparation propagate; custom property
   * getters are not invoked.
   * @example
   * const input = { a: { n: 1 }, b: 2 };
   * Objects.clone(input);          // => { a: { n: 1 }, b: 2 }
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#clonevalue-options
   */
  readonly clone: typeof clone;
  /**
   * Counts own enumerable properties, optionally selecting matches.
   *
   * Omitting the matcher does not read property values. Explicit `undefined` matches undefined values
   * and therefore reads values. Own enumerable strings are visited before symbols; inherited
   * properties are excluded. With a matcher, snapshot keys are fixed, deleted properties are skipped
   * and values are read when visited. Without a matcher, only keys are counted; getters are not
   * evaluated.
   *
   * @param object The input object or value.
   * @param [valueOrPredicate] A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate. Defaults to `omitted (count keys without reading
   * values)`.
   * @returns The number of own enumerable keys when the matcher is omitted; otherwise the number of
   * matching values.
   * @throws {TypeError} for an invalid collection.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @example
   * const input = { a: 1, b: 2, c: 1 };
   * Objects.count(input);          // => 3
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#countobject-valueorpredicate
   */
  readonly count: typeof count;
  /**
   * Creates a graph-preserving copy of supported nested data and property descriptors.
   *
   * Copies supported Map/Set contents and backing-buffer relationships. Unsupported values remain
   * references by default and their children are not visited. User getters are retained without
   * invocation; native Error stack materialisation can invoke `Error.prepareStackTrace`.
   *
   * @param value The value to copy.
   * @param [options] Optional settings; see the clone support policy in the full API documentation.
   * Unknown options throw. Defaults to `undefined`.
   * @returns A copied supported graph with shared identities and cycles preserved; primitives and
   * permitted opaque values retain identity.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for invalid options, including unsupported values under the strict policy.
   * @throws Errors from proxy traps or native Error stack preparation propagate; custom property
   * getters are not invoked.
   * @example
   * const input = { a: { n: 1 }, b: 2 };
   * Objects.deepClone(input);      // => { a: { n: 1 }, b: 2 }
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepclonevalue-options
   */
  readonly deepClone: typeof deepClone;
  /**
   * Counts matching property edges during depth-first traversal.
   *
   * Shared/circular containers expand once; the root is excluded. Traversal boundaries retain their
   * property-edge semantics. Traversal is pre-order depth-first, visits own enumerable string/symbol
   * properties and expands only arrays/plain records below the root. See deep traversal rules.
   *
   * @param object The input root whose own enumerable properties are traversed.
   * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate.
   * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
   * to `undefined`.
   * @returns The number of matching visited property edges, excluding the root.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} for invalid options, depths or descent callbacks.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @example
   * const input = { a: { n: 1 }, b: 2 };
   * Objects.deepCount(input, () => true);  // => 3
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepcountobject-valueorpredicate-options
   */
  readonly deepCount: typeof deepCount;
  /**
   * Creates a structure by retaining matching branches and pruning rejected containers.
   *
   * Rejecting a container excludes its descendants. Unexpanded branches and shared aliases may retain
   * data: this is not an authorisation or complete redaction boundary. Traversal is pre-order
   * depth-first, visits own enumerable string/symbol properties and expands only arrays/plain records
   * below the root. See deep traversal rules.
   *
   * @param object The input root whose own enumerable properties are traversed.
   * @param predicate Called with `(value, key, parent, path)` and `this` bound to the parent. Truthy
   * results retain the property.
   * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
   * to `undefined`.
   * @returns A new object or array of retained properties, with compacted array indexes.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection or required callback.
   * @throws {TypeError} for invalid options, depths or descent callbacks.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @example
   * const input = { a: { n: 1 }, b: 2 };
   * Objects.deepFilter(input, v => typeof v !== 'number' || v > 1);  // => { a: {}, b: 2 }
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepfilterobject-predicate-options
   */
  readonly deepFilter: typeof deepFilter;
  /**
   * Returns the first matching value during depth-first traversal.
   *
   * Shared/circular containers expand once; the root is excluded. Traversal boundaries retain their
   * property-edge semantics. Traversal is pre-order depth-first, visits own enumerable string/symbol
   * properties and expands only arrays/plain records below the root. See deep traversal rules.
   *
   * @param object The input root whose own enumerable properties are traversed.
   * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate.
   * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
   * to `undefined`.
   * @returns The matching value, or `undefined` when no property matches.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} for invalid options, depths or descent callbacks.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @example
   * const input = { a: { n: 1 }, b: 2 };
   * Objects.deepFind(input, 1);    // => 1
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepfindobject-valueorpredicate-options
   */
  readonly deepFind: typeof deepFind;
  /**
   * Returns all matching values during depth-first traversal.
   *
   * Shared/circular containers expand once; the root is excluded. Traversal boundaries retain their
   * property-edge semantics. Traversal is pre-order depth-first, visits own enumerable string/symbol
   * properties and expands only arrays/plain records below the root. See deep traversal rules.
   *
   * @param object The input root whose own enumerable properties are traversed.
   * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate.
   * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
   * to `undefined`.
   * @returns A new array of matching values in traversal order, or `[]`.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} for invalid options, depths or descent callbacks.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @example
   * const input = { a: { n: 1 }, b: 2 };
   * Objects.deepFindAll(input, v => typeof v === 'number');  // => [1, 2]
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepfindallobject-valueorpredicate-options
   */
  readonly deepFindAll: typeof deepFindAll;
  /**
   * Returns the final key of the first deep match during depth-first traversal.
   *
   * Shared/circular containers expand once; the root is excluded. Traversal boundaries retain their
   * property-edge semantics. Traversal is pre-order depth-first, visits own enumerable string/symbol
   * properties and expands only arrays/plain records below the root. See deep traversal rules.
   *
   * @param object The input root whose own enumerable properties are traversed.
   * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate.
   * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
   * to `undefined`.
   * @returns The final string or symbol key of the first match, or `undefined`.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} for invalid options, depths or descent callbacks.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @example
   * const input = { a: { n: 1 }, b: 2 };
   * Objects.deepFindKey(input, 1);   // => 'n'
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepfindkeyobject-valueorpredicate-options
   */
  readonly deepFindKey: typeof deepFindKey;
  /**
   * Returns the last matching value during depth-first traversal.
   *
   * Runs callbacks in forward pre-order and retains the last match. Shared/circular containers expand
   * once; the root is excluded. Traversal boundaries retain their property-edge semantics. Traversal
   * is pre-order depth-first, visits own enumerable string/symbol properties and expands only
   * arrays/plain records below the root. See deep traversal rules.
   *
   * @param object The input root whose own enumerable properties are traversed.
   * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate.
   * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
   * to `undefined`.
   * @returns The matching value, or `undefined` when no property matches.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} for invalid options, depths or descent callbacks.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @example
   * const input = { a: { n: 1 }, b: 2 };
   * Objects.deepFindLast(input, v => typeof v === 'number');   // => 2
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepfindlastobject-valueorpredicate-options
   */
  readonly deepFindLast: typeof deepFindLast;
  /**
   * Visits own enumerable property edges depth-first and returns the original root.
   *
   * Excludes the root itself. Shared/circular containers expand once, but each encountered property
   * edge is visited. Traversal is pre-order depth-first, visits own enumerable string/symbol
   * properties and expands only arrays/plain records below the root. See deep traversal rules.
   *
   * @param object The input root whose own enumerable properties are traversed.
   * @param callback Called with `(value, key, parent, path)` and `this` bound to the parent. Results
   * are not awaited.
   * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
   * to `undefined`.
   * @returns The original root; callback results are ignored.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection or required callback.
   * @throws {TypeError} for invalid options, depths or descent callbacks.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @example
   * const input = { a: { n: 1 }, b: 2 };
   * Objects.deepForEach(input, () => undefined);   // => { a: { n: 1 }, b: 2 }
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepforeachobject-callback-options
   */
  readonly deepForEach: typeof deepForEach;
  /**
   * Creates a structure by transforming values during depth-first traversal.
   *
   * Returning the original container requests recursive transformation; returning a different value
   * replaces the branch without traversing that replacement. Unexpanded branches and opaque leaves can
   * still reference the input. Traversal is pre-order depth-first, visits own enumerable string/symbol
   * properties and expands only arrays/plain records below the root. See deep traversal rules.
   *
   * @param object The input root whose own enumerable properties are traversed.
   * @param callback Called with `(value, key, parent, path)` and `this` bound to the parent. Results
   * are not awaited.
   * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
   * to `undefined`.
   * @returns A new object or array containing mapped branches, preserving aliases among copied
   * containers.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection or required callback.
   * @throws {TypeError} for invalid options, depths or descent callbacks.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @example
   * const input = { a: { n: 1 }, b: 2 };
   * Objects.deepMap(input, v => typeof v === 'number' ? v * 2 : v);  // => { a: { n: 2 }, b: 4 }
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepmapobject-callback-options
   */
  readonly deepMap: typeof deepMap;
  /**
   * Creates a structure by recursively renaming own enumerable keys.
   *
   * With preserved arrays, structural indexes bypass the key mapper while child records are traversed.
   * Extra properties cannot be renamed to `length` or canonical indexes. Collisions default to
   * overwrite and can throw per output container. Unexpanded branches remain references. Traversal is
   * pre-order depth-first, visits own enumerable string/symbol properties and expands only
   * arrays/plain records below the root. See deep traversal rules.
   *
   * @param object The input root whose own enumerable properties are traversed.
   * @param callback Called with `(value, key, parent, path)` and `this` bound to the parent. Must
   * return a string, symbol or safe integer key.
   * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
   * to `undefined`.
   * @returns A new record structure by default; `arrays: 'preserve'` retains arrays and their
   * structural indexes.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection or required callback.
   * @throws {TypeError} for invalid options, invalid mapped keys or a forbidden collision.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @example
   * const input = { a: { n: 1 }, b: 2 };
   * Objects.deepMapKeys(input, (_, k) => k.toUpperCase());   // => { A: { N: 1 }, B: 2 }
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepmapkeysobject-callback-options
   */
  readonly deepMapKeys: typeof deepMapKeys;
  /**
   * Removes the first deep match in place and returns its previous value.
   *
   * Deletion uses configurability, not writability, and leaves array holes. Stops at the first match.
   * Replacement objects are not traversed. Earlier writes and user side effects are not rolled back
   * after errors. Traversal is pre-order depth-first, visits own enumerable string/symbol properties
   * and expands only arrays/plain records below the root. See deep traversal rules.
   *
   * @param object The input root whose own enumerable properties are traversed.
   * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate.
   * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
   * to `undefined`.
   * @returns The previous matching value, or `undefined` when no property matches.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} for invalid options, depths or descent callbacks.
   * @throws {TypeError} when a matched property is non-configurable and cannot be deleted.
   * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
   * rolled back.
   * @example
   * const input = { a: { n: 1 }, b: 2 };
   * Objects.deepRemove(input, 1);  // => 1
   * input;                         // => { a: {}, b: 2 }
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepremoveobject-valueorpredicate-options
   */
  readonly deepRemove: typeof deepRemove;
  /**
   * Removes all selected deep matches in place and returns their previous values.
   *
   * Deletion uses configurability, not writability, and leaves array holes. Matched branches are
   * pruned: detached descendants are not subsequently changed. Replacement objects are not traversed.
   * Earlier writes and user side effects are not rolled back after errors. Traversal is pre-order
   * depth-first, visits own enumerable string/symbol properties and expands only arrays/plain records
   * below the root. See deep traversal rules.
   *
   * @param object The input root whose own enumerable properties are traversed.
   * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate.
   * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
   * to `undefined`.
   * @returns A new array of previous values in traversal order, or `[]` when nothing matches.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} for invalid options, depths or descent callbacks.
   * @throws {TypeError} when a matched property is non-configurable and cannot be deleted.
   * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
   * rolled back.
   * @example
   * const input = { a: { n: 1 }, b: 2 };
   * Objects.deepRemoveAll(input, v => typeof v === 'number');  // => [1, 2]
   * input;                                                     // => { a: {} }
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepremoveallobject-valueorpredicate-options
   */
  readonly deepRemoveAll: typeof deepRemoveAll;
  /**
   * Removes the last deep match in place and returns its previous value.
   *
   * Deletion uses configurability, not writability, and leaves array holes. Inspects the full forward
   * depth-first traversal before applying the final match. Replacement objects are not traversed.
   * Earlier writes and user side effects are not rolled back after errors. Traversal is pre-order
   * depth-first, visits own enumerable string/symbol properties and expands only arrays/plain records
   * below the root. See deep traversal rules.
   *
   * @param object The input root whose own enumerable properties are traversed.
   * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate.
   * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
   * to `undefined`.
   * @returns The previous matching value, or `undefined` when no property matches.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} for invalid options, depths or descent callbacks.
   * @throws {TypeError} when a matched property is non-configurable and cannot be deleted.
   * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
   * rolled back.
   * @example
   * const input = { a: { n: 1 }, b: 2 };
   * Objects.deepRemoveLast(input, v => typeof v === 'number');   // => 2
   * input;                                                       // => { a: { n: 1 } }
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepremovelastobject-valueorpredicate-options
   */
  readonly deepRemoveLast: typeof deepRemoveLast;
  /**
   * Replaces the first deep match in place and returns its previous value.
   *
   * A replacement function is called with the normal callback arguments; return a function from it to
   * store function data. Accessor replacement is rejected. Stops at the first match. Replacement
   * objects are not traversed. Earlier writes and user side effects are not rolled back after errors.
   * Traversal is pre-order depth-first, visits own enumerable string/symbol properties and expands
   * only arrays/plain records below the root. See deep traversal rules.
   *
   * @param object The input root whose own enumerable properties are traversed.
   * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate.
   * @param replacement A literal or synchronous replacement callback. Return a function from a
   * callback to store function data. Typed replacements must fit the matched destinations.
   * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
   * to `undefined`.
   * @returns The previous matching value, or `undefined` when no property matches.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} for invalid options, depths or descent callbacks.
   * @throws {TypeError} when a matched property is an accessor, is non-writable or cannot be written
   * to the destination.
   * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
   * rolled back.
   * @example
   * const input = { a: { n: 1 }, b: 2 };
   * Objects.deepReplace(input, 1, 7);  // => 1
   * input;                             // => { a: { n: 7 }, b: 2 }
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepreplaceobject-valueorpredicate-replacement-options
   */
  readonly deepReplace: typeof deepReplace;
  /**
   * Replaces all selected deep matches in place and returns their previous values.
   *
   * A replacement function is called with the normal callback arguments; return a function from it to
   * store function data. Accessor replacement is rejected. Matched branches are pruned: detached
   * descendants are not subsequently changed. Replacement objects are not traversed. Earlier writes
   * and user side effects are not rolled back after errors. Traversal is pre-order depth-first, visits
   * own enumerable string/symbol properties and expands only arrays/plain records below the root. See
   * deep traversal rules.
   *
   * @param object The input root whose own enumerable properties are traversed.
   * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate.
   * @param replacement A literal or synchronous replacement callback. Return a function from a
   * callback to store function data. Typed replacements must fit the matched destinations.
   * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
   * to `undefined`.
   * @returns A new array of previous values in traversal order, or `[]` when nothing matches.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} for invalid options, depths or descent callbacks.
   * @throws {TypeError} when a matched property is an accessor, is non-writable or cannot be written
   * to the destination.
   * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
   * rolled back.
   * @example
   * const input = { a: { n: 1 }, b: 2 };
   * Objects.deepReplaceAll(input, v => typeof v === 'number', 7);  // => [1, 2]
   * input;                                                         // => { a: { n: 7 }, b: 7 }
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepreplaceallobject-valueorpredicate-replacement-options
   */
  readonly deepReplaceAll: typeof deepReplaceAll;
  /**
   * Replaces the last deep match in place and returns its previous value.
   *
   * A replacement function is called with the normal callback arguments; return a function from it to
   * store function data. Accessor replacement is rejected. Inspects the full forward depth-first
   * traversal before applying the final match. Replacement objects are not traversed. Earlier writes
   * and user side effects are not rolled back after errors. Traversal is pre-order depth-first, visits
   * own enumerable string/symbol properties and expands only arrays/plain records below the root. See
   * deep traversal rules.
   *
   * @param object The input root whose own enumerable properties are traversed.
   * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate.
   * @param replacement A literal or synchronous replacement callback. Return a function from a
   * callback to store function data. Typed replacements must fit the matched destinations.
   * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
   * to `undefined`.
   * @returns The previous matching value, or `undefined` when no property matches.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} for invalid options, depths or descent callbacks.
   * @throws {TypeError} when a matched property is an accessor, is non-writable or cannot be written
   * to the destination.
   * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
   * rolled back.
   * @example
   * const input = { a: { n: 1 }, b: 2 };
   * Objects.deepReplaceLast(input, v => typeof v === 'number', 7);   // => 2
   * input;                                                           // => { a: { n: 1 }, b: 7 }
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#deepreplacelastobject-valueorpredicate-replacement-options
   */
  readonly deepReplaceLast: typeof deepReplaceLast;
  /**
   * Returns the key-and-value pairs of own enumerable properties.
   *
   * Own enumerable strings are visited before symbols; inherited properties are excluded. Snapshot
   * keys are fixed, deleted properties are skipped and values are read when visited.
   *
   * @param object The input object or value.
   * @returns A new array of `[key, value]` pairs in key order, or `[]` for a primitive input.
   * @throws {TypeError} when a required argument is omitted.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @example
   * const input = { a: 1, b: 2, c: 1 };
   * Objects.entries(input);        // => [['a', 1], ['b', 2], ['c', 1]]
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#entriesobject
   */
  readonly entries: typeof entries;
  /**
   * Determines whether every own enumerable property matches a value or predicate.
   *
   * Stops callbacks and value reads at the first failure; keys are snapshotted before searching. Own
   * enumerable strings are visited before symbols; inherited properties are excluded. Snapshot keys
   * are fixed, deleted properties are skipped and values are read when visited.
   *
   * @param object The input object or value.
   * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate.
   * @returns `false` at the first failure; otherwise `true`, including for an empty input.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @example
   * const input = { a: 1, b: 2, c: 1 };
   * Objects.every(input, n => n > 0);  // => true
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#everyobject-valueorpredicate
   */
  readonly every: typeof every;
  /**
   * Returns entries of the first object that occur in none of the other objects.
   *
   * Compares values by SameValueZero. With no additional objects, still returns a new record. Own
   * enumerable strings are visited before symbols; inherited properties are excluded. Snapshot keys
   * are fixed, deleted properties are skipped and values are read when visited.
   *
   * @param object The input object or value.
   * @param others Additional source objects in argument order.
   * @returns A new record of own enumerable key/value pairs absent from all other inputs.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @example
   * const input = { a: 1, b: 2, c: 1 };
   * Objects.except(input, { b: 2 });   // => { a: 1, c: 1 }
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#exceptobject-others
   */
  readonly except: typeof except;
  /**
   * Creates an object or array retaining properties whose predicate result is truthy.
   *
   * Retained array indexes compact; retained extra enumerable string/symbol properties remain. Own
   * enumerable strings are visited before symbols; inherited properties are excluded. Snapshot keys
   * are fixed, deleted properties are skipped and values are read when visited.
   *
   * @param object The input object or value.
   * @param predicate Called with `(value, key, object)` and `this` bound to the input. Truthy results
   * retain the property.
   * @returns A new container of retained values, preserving their references.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection or required callback.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @example
   * const input = { a: 1, b: 2, c: 1 };
   * Objects.filter(input, n => n > 1);   // => { b: 2 }
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#filterobject-predicate
   */
  readonly filter: typeof filter;
  /**
   * Returns the first own enumerable value matching a literal or predicate.
   *
   * Use `findEntry` to distinguish a found `undefined` from no match. Own enumerable strings are
   * visited before symbols; inherited properties are excluded. Snapshot keys are fixed, deleted
   * properties are skipped and values are read when visited.
   *
   * @param object The input object or value.
   * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate.
   * @returns The matching value, or `undefined` when no property matches.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @example
   * const input = { a: 1, b: 2, c: 1 };
   * Objects.find(input, n => n > 1);   // => 2
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#findobject-valueorpredicate
   */
  readonly find: typeof find;
  /**
   * Returns all own enumerable values matching a literal or predicate.
   *
   * Own enumerable strings are visited before symbols; inherited properties are excluded. Snapshot
   * keys are fixed, deleted properties are skipped and values are read when visited.
   *
   * @param object The input object or value.
   * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate.
   * @returns A new array of matching values in forward key order, or `[]`.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @example
   * const input = { a: 1, b: 2, c: 1 };
   * Objects.findAll(input, 1);     // => [1, 1]
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#findallobject-valueorpredicate
   */
  readonly findAll: typeof findAll;
  /**
   * Returns the key and observed value of the first own enumerable match.
   *
   * Captures the value during matching without rereading its getter. A pair with `undefined`
   * distinguishes a found value from no match. Own enumerable strings are visited before symbols;
   * inherited properties are excluded. Snapshot keys are fixed, deleted properties are skipped and
   * values are read when visited.
   *
   * @param object The input object or value.
   * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate.
   * @returns A `[key, observedValue]` pair, or `undefined` when no property matches.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @example
   * const input = { a: 1, b: 2, c: 1 };
   * Objects.findEntry(input, 2);   // => ['b', 2]
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#findentryobject-valueorpredicate
   */
  readonly findEntry: typeof findEntry;
  /**
   * Returns the key of the first own enumerable match.
   *
   * Own enumerable strings are visited before symbols; inherited properties are excluded. Snapshot
   * keys are fixed, deleted properties are skipped and values are read when visited.
   *
   * @param object The input object or value.
   * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate.
   * @returns The matching string or symbol key, or `undefined`.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @example
   * const input = { a: 1, b: 2, c: 1 };
   * Objects.findKey(input, 2);     // => 'b'
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#findkeyobject-valueorpredicate
   */
  readonly findKey: typeof findKey;
  /**
   * Returns the last own enumerable value matching a literal or predicate.
   *
   * Visits keys in reverse order. Use `findEntry` to distinguish a found `undefined` from no match.
   * The complete own-enumerable key list is visited in reverse, so symbols precede strings. Inherited
   * properties are excluded. Snapshot keys are fixed, deleted properties are skipped and values are
   * read when visited.
   *
   * @param object The input object or value.
   * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate.
   * @returns The matching value, or `undefined` when no property matches.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @example
   * const input = { a: 1, b: 2, c: 1 };
   * Objects.findLast(input, n => n < 2);   // => 1
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#findlastobject-valueorpredicate
   */
  readonly findLast: typeof findLast;
  /**
   * Returns the path to the first deep match during depth-first traversal.
   *
   * Shared/circular containers expand once; the root is excluded. Traversal boundaries retain their
   * property-edge semantics. Traversal is pre-order depth-first, visits own enumerable string/symbol
   * properties and expands only arrays/plain records below the root. See deep traversal rules.
   *
   * @param object The input root whose own enumerable properties are traversed.
   * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate.
   * @param [options] Optional settings; see traversal options below. Unknown options throw. Defaults
   * to `undefined`.
   * @returns A fresh array of string/symbol path segments, or `undefined`.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} for invalid options, depths or descent callbacks.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @example
   * const input = { a: { n: 1 }, b: 2 };
   * Objects.findPath(input, 1);    // => ['a', 'n']
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#findpathobject-valueorpredicate-options
   */
  readonly findPath: typeof findPath;
  /**
   * Visits each own enumerable property and returns the original object.
   *
   * Does not itself write to the input; callbacks may do so. Own enumerable strings are visited before
   * symbols; inherited properties are excluded. Snapshot keys are fixed, deleted properties are
   * skipped and values are read when visited.
   *
   * @param object The input object or value.
   * @param callback Called with `(value, key, object)` and `this` bound to the input. Results are not
   * awaited.
   * @returns The original object; callback results are ignored.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection or required callback.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @example
   * const input = { a: 1, b: 2, c: 1 };
   * Objects.forEach(input, () => undefined);   // => { a: 1, b: 2, c: 1 }
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#foreachobject-callback
   */
  readonly forEach: typeof forEach;
  /**
   * Returns a value at an own-property path, using a default when it is missing or `undefined`.
   *
   * Preserves `null`. Reads each own path step once; does not traverse primitive properties. The empty
   * string names the empty-string property.
   *
   * @param object The input object or value.
   * @param path A string, symbol, safe integer or array of those keys. String paths support dot and
   * quoted/numeric bracket syntax.
   * @param [defaultValue] The fallback for missing or `undefined` path values; preserves `null`.
   * Defaults to `undefined`.
   * @returns The observed value, or the default for a missing/`undefined` value. An empty path array
   * returns the original root.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid path or key; malformed string syntax is rejected with
   * `SyntaxError`.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @example
   * const input = { a: { n: 1 }, b: 2 };
   * Objects.get(input, 'a.n');     // => 1
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#getobject-path-defaultvalue
   */
  readonly get: typeof get;
  /**
   * Returns values at several own-property paths in the supplied order.
   *
   * Validates the complete path list before reading values. Paths can repeat. Defaults replace
   * missing/`undefined` values, not `null`.
   *
   * @param object The input object or value.
   * @param paths An actual array of paths, processed in list order.
   * @param [defaultValue] The fallback for missing or `undefined` path values; preserves `null`.
   * Defaults to `undefined`.
   * @returns A new array with one value or default per requested path.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid path or key; malformed string syntax is rejected with
   * `SyntaxError`.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @example
   * const input = { a: { n: 1 }, b: 2 };
   * Objects.getEach(input, ['a.n', 'b', 'absent'], 9);   // => [1, 2, 9]
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#geteachobject-paths-defaultvalue
   */
  readonly getEach: typeof getEach;
  /**
   * Determines whether an own-property path exists, even when its value is `undefined`.
   *
   * Includes non-enumerable properties. The terminal getter is not evaluated; intermediate getters can
   * run. `[]` identifies an object/function root; holes and inherited properties are absent.
   *
   * @param object The input object or value.
   * @param path A string, symbol, safe integer or array of those keys. String paths support dot and
   * quoted/numeric bracket syntax.
   * @returns `true` when the own path exists; otherwise `false`.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid path or key; malformed string syntax is rejected with
   * `SyntaxError`.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @example
   * const input = { a: { n: 1 }, b: 2 };
   * Objects.has(input, 'a.n');     // => true
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#hasobject-path
   */
  readonly has: typeof has;
  /**
   * Determines whether a value has an own enumerable property with a given key.
   *
   * Invalid key kinds and primitive inputs return `false` without coercion hooks. Does not evaluate
   * the property getter.
   *
   * @param object The input object or value.
   * @param key A string, symbol or safe integer literal key. Invalid key kinds return `false`.
   * @returns `true` if the property is own and enumerable; otherwise `false`.
   * @throws {TypeError} when a required argument is omitted.
   * @throws Errors from proxy traps propagate.
   * @example
   * const input = { a: 1, b: 2, c: 1 };
   * Objects.hasKey(input, 'a');    // => true
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#haskeyobject-key
   */
  readonly hasKey: typeof hasKey;
  /**
   * Determines whether a value has an own property, including a non-enumerable property.
   *
   * Inherited properties, invalid key kinds and primitive inputs return `false`. Does not evaluate the
   * property getter.
   *
   * @param object The input object or value.
   * @param key A string, symbol or safe integer literal key. Invalid key kinds return `false`.
   * @returns `true` if the property exists on the value itself; otherwise `false`.
   * @throws {TypeError} when a required argument is omitted.
   * @throws Errors from proxy traps propagate.
   * @example
   * const input = Object.defineProperty({}, 'hidden', { value: 1 });
   * Objects.hasProp(input, 'hidden');  // => true
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#haspropobject-key
   */
  readonly hasProp: typeof hasProp;
  /**
   * Determines whether an own enumerable property contains a matching value.
   *
   * `NaN` matches itself, signed zeros match and objects/functions compare by identity. Primitive
   * inputs return `false`. Own enumerable strings are visited before symbols; inherited properties are
   * excluded. Snapshot keys are fixed, deleted properties are skipped and values are read when
   * visited.
   *
   * @param object The input object or value.
   * @param value The literal value to match by SameValueZero.
   * @returns `true` if an observed value matches by SameValueZero; otherwise `false`.
   * @throws {TypeError} when a required argument is omitted.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @example
   * const input = { a: 1, b: 2, c: 1 };
   * Objects.hasValue(input, 2);    // => true
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#hasvalueobject-value
   */
  readonly hasValue: typeof hasValue;
  /**
   * Returns entries of the first object that occur in every other object.
   *
   * Compares values by SameValueZero. With no additional objects, still returns a new record. Own
   * enumerable strings are visited before symbols; inherited properties are excluded. Snapshot keys
   * are fixed, deleted properties are skipped and values are read when visited.
   *
   * @param object The input object or value.
   * @param others Additional source objects in argument order.
   * @returns A new record of matching own enumerable key/value pairs.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @example
   * const input = { a: 1, b: 2, c: 1 };
   * Objects.intersect(input, { b: 2 });  // => { b: 2 }
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#intersectobject-others
   */
  readonly intersect: typeof intersect;
  /**
   * Returns the own enumerable string and symbol keys of a value.
   *
   * String keys follow `Object.keys` order, followed by symbols. Does not read property values.
   *
   * @param object The input object or value.
   * @returns A new array of keys, or `[]` for a primitive input.
   * @throws {TypeError} when a required argument is omitted.
   * @throws Errors from proxy traps propagate.
   * @example
   * const input = { a: 1, b: 2, c: 1 };
   * Objects.keys(input);           // => ['a', 'b', 'c']
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#keysobject
   */
  readonly keys: typeof keys;
  /**
   * Creates an object or array by transforming each own enumerable value.
   *
   * Arrays retain length and holes. Values returned by callbacks are stored without awaiting them. Own
   * enumerable strings are visited before symbols; inherited properties are excluded. Snapshot keys
   * are fixed, deleted properties are skipped and values are read when visited.
   *
   * @param object The input object or value.
   * @param callback Called with `(value, key, object)` and `this` bound to the input. Results are not
   * awaited.
   * @returns A new container with the original keys and callback results.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection or required callback.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @example
   * const input = { a: 1, b: 2, c: 1 };
   * Objects.map(input, n => n * 2);  // => { a: 2, b: 4, c: 2 }
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#mapobject-callback
   */
  readonly map: typeof map;
  /**
   * Creates a record by renaming own enumerable keys while retaining their values.
   *
   * Arrays become records. The last colliding key wins by default; `onCollision: 'throw'` rejects
   * collisions. Numeric results normalise to strings before collision checks. Own enumerable strings
   * are visited before symbols; inherited properties are excluded. Snapshot keys are fixed, deleted
   * properties are skipped and values are read when visited.
   *
   * @param object The input object or value.
   * @param callback Called with `(value, key, object)` and `this` bound to the input. Must return a
   * string, symbol or safe integer key.
   * @param [options] Optional settings; see key-mapping collision rules below. Unknown options throw.
   * Defaults to `undefined`.
   * @returns A new record with mapped keys and original value references.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection or required callback.
   * @throws {TypeError} for invalid options, invalid mapped keys or a forbidden collision.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @example
   * const input = { a: 1, b: 2, c: 1 };
   * Objects.mapKeys(input, (_, k) => k.toUpperCase());   // => { A: 1, B: 2, C: 1 }
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#mapkeysobject-callback-options
   */
  readonly mapKeys: typeof mapKeys;
  /**
   * Creates a shallow merged record, with later sources overriding earlier keys.
   *
   * Does not recursively merge nested values or mutate sources. Nested values remain references. Own
   * enumerable strings are visited before symbols; inherited properties are excluded. Snapshot keys
   * are fixed, deleted properties are skipped and values are read when visited.
   *
   * @param object The input object or value.
   * @param others Additional source objects in argument order.
   * @returns A new record containing the final value for each supplied own enumerable key.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @example
   * const input = { a: 1, b: 2, c: 1 };
   * Objects.merge(input, { a: 9, d: 4 });  // => { a: 9, b: 2, c: 1, d: 4 }
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#mergeobject-others
   */
  readonly merge: typeof merge;
  /**
   * Creates a record excluding selected own enumerable keys.
   *
   * Excluded getters are not evaluated. Retained getters are read once; reflection can still trigger
   * proxy traps. Own enumerable strings are visited before symbols; inherited properties are excluded.
   * Snapshot keys are fixed, deleted properties are skipped and values are read when visited.
   *
   * @param object The input object or value.
   * @param keys An actual array of literal keys, not paths; invalid keys throw.
   * @returns A new record of properties not excluded by the key list.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} for an invalid key list.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @example
   * const input = { a: 1, b: 2, c: 1 };
   * Objects.omit(input, ['b']);    // => { a: 1, c: 1 }
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#omitobject-keys
   */
  readonly omit: typeof omit;
  /**
   * Creates a record containing requested own enumerable keys.
   *
   * The key list contains literal keys, not paths. Duplicate keys do not create duplicate result
   * properties. Requested keys are processed in list order, including duplicates. Each requested
   * property is checked when reached; properties added by earlier getters can therefore be selected.
   *
   * @param object The input object or value.
   * @param keys An actual array of literal keys, not paths; invalid keys throw.
   * @returns A new record of requested properties that were present.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} for an invalid key list.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @example
   * const input = { a: 1, b: 2, c: 1 };
   * Objects.pick(input, ['b']);    // => { b: 2 }
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#pickobject-keys
   */
  readonly pick: typeof pick;
  /**
   * Reduces own enumerable values to one accumulator in forward key order.
   *
   * Without an initial argument, the first visited value seeds the accumulator. Explicit `undefined`
   * is a supplied initial value. An empty input without an initial value throws. Own enumerable
   * strings are visited before symbols; inherited properties are excluded. Snapshot keys are fixed,
   * deleted properties are skipped and values are read when visited.
   *
   * @param object The input object or value.
   * @param reducer Called with `(accumulator, value, key, object)` and `this` bound to the input;
   * returns the next accumulator.
   * @param [initialValue] The initial accumulator. Explicit `undefined` counts as supplied. Defaults
   * to `first visited value when omitted`.
   * @returns The final accumulator, or the initial value for an empty input when one was supplied.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection or required callback.
   * @throws {TypeError} for empty input without an initial accumulator.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @example
   * const input = { a: 1, b: 2, c: 1 };
   * Objects.reduce(input, (text, n) => text + n, '');  // => '121'
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#reduceobject-reducer-initialvalue
   */
  readonly reduce: typeof reduce;
  /**
   * Reduces own enumerable values to one accumulator in reverse key order.
   *
   * Without an initial argument, the first visited value seeds the accumulator. Explicit `undefined`
   * is a supplied initial value. An empty input without an initial value throws. The complete
   * own-enumerable key list is visited in reverse, so symbols precede strings. Inherited properties
   * are excluded. Snapshot keys are fixed, deleted properties are skipped and values are read when
   * visited.
   *
   * @param object The input object or value.
   * @param reducer Called with `(accumulator, value, key, object)` and `this` bound to the input;
   * returns the next accumulator.
   * @param [initialValue] The initial accumulator. Explicit `undefined` counts as supplied. Defaults
   * to `first visited value when omitted`.
   * @returns The final accumulator, or the initial value for an empty input when one was supplied.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection or required callback.
   * @throws {TypeError} for empty input without an initial accumulator.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @example
   * const input = { a: 1, b: 2, c: 3 };
   * Objects.reduceRight(input, (text, n) => text + n, '');   // => '321'
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#reducerightobject-reducer-initialvalue
   */
  readonly reduceRight: typeof reduceRight;
  /**
   * Removes the first own enumerable match in place and returns its previous value.
   *
   * Deletion uses configurability, not writability, and leaves array holes. Visits keys in forward
   * order. Earlier writes and user side effects are not rolled back after errors. Own enumerable
   * strings are visited before symbols; inherited properties are excluded. Snapshot keys are fixed,
   * deleted properties are skipped and values are read when visited.
   *
   * @param object The input object to update in place.
   * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate.
   * @returns The previous matching value, or `undefined` when no property matches.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} when a matched property is non-configurable and cannot be deleted.
   * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
   * rolled back.
   * @example
   * const input = { a: 1, b: 2, c: 1 };
   * Objects.remove(input, 1);      // => 1
   * input;                         // => { b: 2, c: 1 }
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#removeobject-valueorpredicate
   */
  readonly remove: typeof remove;
  /**
   * Removes all selected own enumerable matches in place and returns their previous values.
   *
   * Deletion uses configurability, not writability, and leaves array holes. Visits keys in forward
   * order. Earlier writes and user side effects are not rolled back after errors. Own enumerable
   * strings are visited before symbols; inherited properties are excluded. Snapshot keys are fixed,
   * deleted properties are skipped and values are read when visited.
   *
   * @param object The input object to update in place.
   * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate.
   * @returns A new array of previous values in traversal order, or `[]` when nothing matches.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} when a matched property is non-configurable and cannot be deleted.
   * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
   * rolled back.
   * @example
   * const input = { a: 1, b: 2, c: 1 };
   * Objects.removeAll(input, 1);   // => [1, 1]
   * input;                         // => { b: 2 }
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#removeallobject-valueorpredicate
   */
  readonly removeAll: typeof removeAll;
  /**
   * Removes the last own enumerable match in place and returns its previous value.
   *
   * Deletion uses configurability, not writability, and leaves array holes. Visits keys in reverse
   * order. Earlier writes and user side effects are not rolled back after errors. The complete
   * own-enumerable key list is visited in reverse, so symbols precede strings. Inherited properties
   * are excluded. Snapshot keys are fixed, deleted properties are skipped and values are read when
   * visited.
   *
   * @param object The input object to update in place.
   * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate.
   * @returns The previous matching value, or `undefined` when no property matches.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} when a matched property is non-configurable and cannot be deleted.
   * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
   * rolled back.
   * @example
   * const input = { a: 1, b: 2, c: 1 };
   * Objects.removeLast(input, 1);  // => 1
   * input;                         // => { a: 1, b: 2 }
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#removelastobject-valueorpredicate
   */
  readonly removeLast: typeof removeLast;
  /**
   * Replaces the first own enumerable match in place and returns its previous value.
   *
   * A replacement function is called with the normal callback arguments; return a function from it to
   * store function data. Accessor replacement is rejected. Visits keys in forward order. Earlier
   * writes and user side effects are not rolled back after errors. Own enumerable strings are visited
   * before symbols; inherited properties are excluded. Snapshot keys are fixed, deleted properties are
   * skipped and values are read when visited.
   *
   * @param object The input object to update in place.
   * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate.
   * @param replacement A literal or synchronous replacement callback. Return a function from a
   * callback to store function data. Typed replacements must fit the matched destinations.
   * @returns The previous matching value, or `undefined` when no property matches.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} when a matched property is an accessor, is non-writable or cannot be written
   * to the destination.
   * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
   * rolled back.
   * @example
   * const input = { a: 1, b: 2, c: 1 };
   * Objects.replace(input, 1, 7);  // => 1
   * input;                         // => { a: 7, b: 2, c: 1 }
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#replaceobject-valueorpredicate-replacement
   */
  readonly replace: typeof replace;
  /**
   * Replaces all selected own enumerable matches in place and returns their previous values.
   *
   * A replacement function is called with the normal callback arguments; return a function from it to
   * store function data. Accessor replacement is rejected. Visits keys in forward order. Earlier
   * writes and user side effects are not rolled back after errors. Own enumerable strings are visited
   * before symbols; inherited properties are excluded. Snapshot keys are fixed, deleted properties are
   * skipped and values are read when visited.
   *
   * @param object The input object to update in place.
   * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate.
   * @param replacement A literal or synchronous replacement callback. Return a function from a
   * callback to store function data. Typed replacements must fit the matched destinations.
   * @returns A new array of previous values in traversal order, or `[]` when nothing matches.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} when a matched property is an accessor, is non-writable or cannot be written
   * to the destination.
   * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
   * rolled back.
   * @example
   * const input = { a: 1, b: 2, c: 1 };
   * Objects.replaceAll(input, 1, 7);   // => [1, 1]
   * input;                             // => { a: 7, b: 2, c: 7 }
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#replaceallobject-valueorpredicate-replacement
   */
  readonly replaceAll: typeof replaceAll;
  /**
   * Replaces the last own enumerable match in place and returns its previous value.
   *
   * A replacement function is called with the normal callback arguments; return a function from it to
   * store function data. Accessor replacement is rejected. Visits keys in reverse order. Earlier
   * writes and user side effects are not rolled back after errors. The complete own-enumerable key
   * list is visited in reverse, so symbols precede strings. Inherited properties are excluded.
   * Snapshot keys are fixed, deleted properties are skipped and values are read when visited.
   *
   * @param object The input object to update in place.
   * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate.
   * @param replacement A literal or synchronous replacement callback. Return a function from a
   * callback to store function data. Typed replacements must fit the matched destinations.
   * @returns The previous matching value, or `undefined` when no property matches.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} when a matched property is an accessor, is non-writable or cannot be written
   * to the destination.
   * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
   * rolled back.
   * @example
   * const input = { a: 1, b: 2, c: 1 };
   * Objects.replaceLast(input, 1, 7);  // => 1
   * input;                             // => { a: 1, b: 2, c: 7 }
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#replacelastobject-valueorpredicate-replacement
   */
  readonly replaceLast: typeof replaceLast;
  /**
   * Sets a value at an own-property path and returns its previous value.
   *
   * Mutates the input. Stores functions and other supplied values as data. Creates missing/`undefined`
   * intermediates, but does not replace `null` or primitive intermediates.
   *
   * @param object The input object to update in place.
   * @param path A string, symbol, safe integer or array of those keys. String paths support dot and
   * quoted/numeric bracket syntax.
   * @param value The literal value to store; typed writes must satisfy the selected path.
   * @returns The previous final value, or `undefined` when the property was absent.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} for an invalid path or key; malformed string syntax is rejected with
   * `SyntaxError`.
   * @throws {RangeError} for an empty mutation path; `TypeError` for unsafe path segments, unsupported
   * containers or forbidden writes.
   * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
   * rolled back.
   * @example
   * const input = { a: { n: 1 }, b: 2 };
   * Objects.set(input, 'a.n', 7);  // => 1
   * input;                         // => { a: { n: 7 }, b: 2 }
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#setobject-path-value
   */
  readonly set: typeof set;
  /**
   * Sets the same value at several own-property paths and returns their previous values.
   *
   * Mutates the input and stores one shared value/reference. Validates all paths before the first
   * write, but a later runtime failure does not roll back earlier writes.
   *
   * @param object The input object to update in place.
   * @param paths An actual array of paths, processed in list order.
   * @param value The literal value to store; typed writes must satisfy the selected path.
   * @returns A new array of previous values in path-list order; absent final properties contribute
   * `undefined`.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} for an invalid path or key; malformed string syntax is rejected with
   * `SyntaxError`.
   * @throws {RangeError} for an empty mutation path; `TypeError` for unsafe path segments, unsupported
   * containers or forbidden writes.
   * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
   * rolled back.
   * @example
   * const input = { a: { n: 1 }, b: 2 };
   * Objects.setEach(input, ['a.n', 'b'], 7);   // => [1, 2]
   * input;                                     // => { a: { n: 7 }, b: 7 }
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#seteachobject-paths-value
   */
  readonly setEach: typeof setEach;
  /**
   * Determines whether any own enumerable property matches a value or predicate.
   *
   * Stops callbacks and value reads after the first match; keys are snapshotted before searching. Own
   * enumerable strings are visited before symbols; inherited properties are excluded. Snapshot keys
   * are fixed, deleted properties are skipped and values are read when visited.
   *
   * @param object The input object or value.
   * @param valueOrPredicate A literal matched by SameValueZero, or a synchronous predicate using
   * truthiness. A function is always a predicate.
   * @returns `true` when a property matches; otherwise `false`, including for an empty input.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @example
   * const input = { a: 1, b: 2, c: 1 };
   * Objects.some(input, 2);        // => true
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#someobject-valueorpredicate
   */
  readonly some: typeof some;
  /**
   * Removes an own property at a path without shifting array indexes.
   *
   * Mutates the input. Missing, `null` or scalar intermediate branches count as absent. Array index
   * deletion leaves a hole and retains length. Does not create containers. A configurable terminal
   * accessor can be deleted without evaluating its getter; intermediate accessors remain forbidden.
   *
   * @param object The input object to update in place.
   * @param path A string, symbol, safe integer or array of those keys. String paths support dot and
   * quoted/numeric bracket syntax.
   * @returns `true` when deletion succeeds or the path is already absent.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection.
   * @throws {TypeError} for an invalid path or key; malformed string syntax is rejected with
   * `SyntaxError`.
   * @throws {TypeError} for unsafe paths, an invalid root, intermediate accessors or a
   * non-configurable final property.
   * @throws {RangeError} for an empty mutation path.
   * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
   * rolled back.
   * @example
   * const input = { a: { n: 1 }, b: 2 };
   * Objects.unset(input, 'a.n');   // => true
   * input;                         // => { a: {}, b: 2 }
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#unsetobject-path
   */
  readonly unset: typeof unset;
  /**
   * Updates an own-property path by calling an updater once with its previous value.
   *
   * Mutates the input. Checks the path, data descriptors and ordinary destination restrictions before
   * calling `updater(previousValue)`. Missing parents are attached only after it returns. Native value
   * validation and exotic-object write restrictions can still fail afterward. Rechecks restrictions
   * after callback side effects. Returned functions or promises are stored, not invoked or awaited.
   *
   * @param object The input object to update in place.
   * @param path A string, symbol, safe integer or array of those keys. String paths support dot and
   * quoted/numeric bracket syntax.
   * @param updater Called once with the previous value; returns the replacement without awaiting it.
   * Avoid mutating the input in the callback.
   * @returns The value observed before invoking the updater, or `undefined` when the property was
   * absent.
   * @throws {TypeError} when a required argument is omitted.
   * @throws {TypeError} for an invalid collection or required callback.
   * @throws {TypeError} for an invalid path or key; malformed string syntax is rejected with
   * `SyntaxError`.
   * @throws {RangeError} for an empty mutation path; `TypeError` for unsafe path segments, unsupported
   * containers or forbidden writes.
   * @throws Errors from getters, proxy traps or user callbacks propagate; earlier writes are not
   * rolled back.
   * @example
   * const input = { a: { n: 1 }, b: 2 };
   * Objects.update(input, 'a.n', n => n + 1);  // => 1
   * input;                                     // => { a: { n: 2 }, b: 2 }
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#updateobject-path-updater
   */
  readonly update: typeof update;
  /**
   * Returns the values of own enumerable string and symbol properties.
   *
   * Own enumerable strings are visited before symbols; inherited properties are excluded. Snapshot
   * keys are fixed, deleted properties are skipped and values are read when visited.
   *
   * @param object The input object or value.
   * @returns A new array of observed values in key order, or `[]` for a primitive input.
   * @throws {TypeError} when a required argument is omitted.
   * @throws Errors from getters, proxy traps or user callbacks propagate.
   * @example
   * const input = { a: 1, b: 2, c: 1 };
   * Objects.values(input);         // => [1, 2, 1]
   * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#valuesobject
   */
  readonly values: typeof values;
}
