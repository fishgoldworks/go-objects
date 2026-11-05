import Objects, {
  has,
  update,
  some,
  every,
  findEntry,
  count,
  map,
  pick,
  get,
  deepMapKeys,
  type Path,
  type Wrapper
} from 'go-objects';
import directGet from 'go-objects/get';
import legacyGet from 'go-objects/src/get.js';
import browser, { has as browserHas, type CloneOptions } from 'go-objects/dist/go-objects.mjs';
const data = { retries: 1, count: 2 };
const value: number | undefined = get(data, 'retries');
const same: typeof get = directGet;
const legacy: typeof get = legacyGet;
const result: boolean = has(data, 'retries') && some(data, (v) => v > 0) && every(data, (v) => v >= 0);
const old: number | undefined = update(data, 'retries', (n) => (n ?? 0) + 1);
const entry: ['retries', number] | ['count', number] | undefined = findEntry(data, 1);
const size: number = count(data);
const mapped: { retries: string; count: string } = map(data, (n) => String(n));
const subset: { retries: number } = pick(data, ['retries']);
const chain: Wrapper<typeof data, number | undefined> = Objects(data).update('retries', (n) => (n ?? 0) + 1);
const path: Path = ['retries'];
const cloneOptions: CloneOptions = { unsupported: 'throw' };
browser.deepClone(data, cloneOptions);
browserHas(data, path);
deepMapKeys(data, (v, k) => k, { onCollision: 'throw' });
// @ts-expect-error Query result is boolean, not the original root.
const wrong: typeof data = Objects(data).some(1).unwrap();
// @ts-expect-error The default fallback does not establish the type of a dynamic path.
const guessed: number = get(data, String(Date.now()), 0);
