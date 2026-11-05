// Test-owned example: adapting an import must not change a literal module name.
import Objects from './dist/go-objects.mjs';
const declaredPath = './dist/go-objects.mjs';
if (declaredPath !== './dist/' + 'go-objects.mjs') throw new Error('Literal documentation module path was modified');
if (Objects.get({ value: 7 }, 'value') !== 7) throw new Error('Documentation dependency did not load');
