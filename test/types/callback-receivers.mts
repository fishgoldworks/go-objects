import O from 'go-objects';
import replace from 'go-objects/replace';

function expectType<T>(_value: T): void {}

const input = { left: 1, right: 2 };
type Input = typeof input;
function predicate(this: Input, value: number, key: 'left' | 'right', parent: Input): boolean {
  const receiver: number = this.left;
  return value === receiver && parent[key] === value;
}
O.some(input, predicate);
O(input).find(predicate);
O.map(input, function (value, key, parent) {
  expectType<Input>(this);
  return this[key] + value + parent.left;
});
O.replace(input, predicate, function (value, key, parent) {
  expectType<Input>(this);
  return value + this[key] + parent.left;
});
replace(input, predicate.bind(input), (value) => value + 1);
O(input).replace(predicate, function (value) {
  expectType<Input>(this);
  return value + this.left;
});
const receiverFree = (value: number): boolean => value === 1;
O.some(input, receiverFree);
O.some(input, predicate.bind(input));
function wrongReceiver(this: { absent: string }, value: number): boolean {
  return this.absent.length === value;
}
// @ts-expect-error The callback receiver is the collection, not an unrelated shape.
O.some(input, wrongReceiver);
// @ts-expect-error Wrapped callbacks have the same receiver contract.
O(input).replace(wrongReceiver, 3);
function numericResult(this: Input, value: number): number {
  return this.left + value;
}
O.update(input, 'left', (previous) => (previous ?? 0) + 1);
// @ts-expect-error A receiver-free updater cannot require a collection receiver.
O.update(input, 'left', numericResult);

const functions = { calculate: (value: number) => String(value) };
const found = O.find(functions, () => true);
if (found) {
  const result: string = found(3);
  // @ts-expect-error Returned callable values retain their argument types.
  found('3');
  void result;
}
const replaced = O.replace(
  functions,
  () => true,
  () => (value: number) => String(value + 1)
);
if (replaced) {
  const result: string = replaced(2);
  void result;
}
const wrapped = O(functions).replace(
  () => true,
  () => (value: number) => String(value + 1)
);
const previous = wrapped.result();
if (previous) previous(1);
const current: string = wrapped.unwrap().calculate(1);
O.deepForEach({ nested: input }, function (value, key, parent, path) {
  expectType<object>(this);
  const container: object = parent;
  const segment: string | symbol = key;
  const segments: (string | symbol)[] = path;
  void [container, segment, segments, value];
});
void current;
