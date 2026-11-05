'use strict';
function checkBrowserBundle(api) {
  function equal(actual, expected) {
    if (JSON.stringify(actual) !== JSON.stringify(expected))
      throw new Error('Expected ' + JSON.stringify(expected) + '; received ' + JSON.stringify(actual));
  }
  const input = { account: { active: true } };
  equal(api.get(input, 'account.active'), true);
  const copy = api.deepClone(input);
  equal(copy, input);
  equal(copy === input, false);
  equal(copy.account === input.account, false);
  const cycle = {};
  cycle.self = cycle;
  const cloned = api.deepClone(cycle);
  equal(cloned.self === cloned, true);
}
if (typeof module === 'object') module.exports = checkBrowserBundle;
