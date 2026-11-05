'use strict';
const assert = require('assert');
const O = require('go-objects');
require('./contracts')(O);
for (const name of Object.keys(O))
  for (const suffix of [name, 'src/' + name, 'src/' + name + '.js'])
    assert.strictEqual(require('go-objects/' + suffix), O[name], suffix);
for (const bundle of ['go-objects.js', 'go-objects.min.js'])
  require('./contracts')(require('go-objects/dist/' + bundle));
console.log(process.version + ': CommonJS root, legacy subpaths and UMD consumer contracts passed');
