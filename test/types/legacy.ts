import Objects = require('go-objects');
import get = require('go-objects/get');
import has = require('go-objects/src/has.js');
const value: number | undefined = get({ a: 1 }, 'a');
const exists: boolean = has({ a: undefined }, 'a');
const mapped: { a: string } = Objects.map({ a: 1 }, (v) => String(v));
// @ts-expect-error No any fallback for dynamic paths.
const bad: string = get({ a: 1 }, String(Date.now()));
// @ts-expect-error ObjectWrapper is an implementation module, not a public package subpath.
import InternalObjectWrapper = require('go-objects/ObjectWrapper');
// @ts-expect-error Internal helpers are not supported package subpaths.
import InternalPath = require('go-objects/internal/path');
// @ts-expect-error Legacy src/internal imports are also implementation details.
import LegacyInternalPath = require('go-objects/src/internal/path');
