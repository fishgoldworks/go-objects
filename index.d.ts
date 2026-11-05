import type * as Types from './types/api.js';
/**
 * Creates a fresh wrapper for a value and starts an independent pipeline.
 * Each utility call executes immediately and returns a new wrapper. Explicit
 * mutators still share and change the underlying input data.
 * @param value The initial pipeline value, retained by reference.
 * @returns A fresh wrapper whose current value and last result equal the input.
 * @see https://github.com/koyote130708/go-objects/blob/main/docs/API.md#objectsvalue
 */
declare const Objects: Types.Api;
declare namespace Objects {
  type Key = Types.Key;
  type Path = Types.Path;
  type CloneOptions = Types.CloneOptions;
  type TraversalOptions = Types.TraversalOptions;
  type MapKeysOptions = Types.MapKeysOptions;
  type DeepMapKeysOptions = Types.DeepMapKeysOptions;
  type Wrapper<T, R = T> = Types.Wrapper<T, R>;
}
export = Objects;
