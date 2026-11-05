// TypeScript 5.5 infers this predicate; older consumers can annotate it explicitly.
import Objects = require('go-objects');
const profile = { id: 42, displayName: 'Michael', notes: 'Private' };
const entry = Objects.findEntry(profile, (value) => typeof value === 'number');
if (entry?.[0] === 'id') {
  const id: number = entry[1];
  void id;
}
// @ts-expect-error An inferred numeric guard removes nonnumeric alternatives.
if (entry?.[0] === 'displayName') {
}
