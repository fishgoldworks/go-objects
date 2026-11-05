'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const O = require('..');

test('immutable copies retain supported cross-realm record and array prototypes', () => {
  const input = vm.runInNewContext('({row:{n:1}, list:[{n:1}]})');
  const rootProto = Object.getPrototypeOf(input);
  const rowProto = Object.getPrototypeOf(input.row);
  const listProto = Object.getPrototypeOf(input.list);
  const itemProto = Object.getPrototypeOf(input.list[0]);

  const rowChanged = O.setImmutable(input, ['row', 'n'], 2);
  assert.equal(Object.getPrototypeOf(rowChanged), rootProto);
  assert.equal(Object.getPrototypeOf(rowChanged.row), rowProto);

  const listChanged = O.setImmutable(input, ['list', 0, 'n'], 2);
  assert.equal(Object.getPrototypeOf(listChanged), rootProto);
  assert.equal(Object.getPrototypeOf(listChanged.list), listProto);
  assert.equal(Object.getPrototypeOf(listChanged.list[0]), itemProto);
});
