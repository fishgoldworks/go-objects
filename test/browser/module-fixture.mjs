// This test-only module is loaded through the same Blob transport as the actual
// package. Import-looking data must remain byte-for-byte JavaScript data.
import get from './esm/get.mjs';

export function checkTransport() {
  const quoted = "from './esm/get.mjs'";
  const template = `before
from './esm/get.mjs'
export { default } from './esm/get.mjs';
after`;
  // from 'this-comment-is-not-an-external-module'
  const unrelated = "from 'not-an-import'";
  if (quoted !== ['from ', "'./esm/get.mjs'"].join('')) throw new Error('Quoted module text was modified');
  if (
    template !==
    [
      'before',
      ['from ', "'./esm/get.mjs'"].join(''),
      ['export { default } ', 'from ', "'./esm/get.mjs';"].join(''),
      'after'
    ].join('\n')
  )
    throw new Error('Template module text was modified');
  if (unrelated !== ['from ', "'not-an-import'"].join('')) throw new Error('Non-import text was modified');
  if (get({ value: 7 }, 'value') !== 7) throw new Error('Actual dependency did not load');
}
