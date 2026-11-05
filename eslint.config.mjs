import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
export default [
  {
    ignores: [
      'package/**',
      'artifacts/**',
      '.go-objects-build-*/**',
      '**/.tmp/**',
      '**/temp/**',
      'coverage/**',
      'node_modules/**'
    ]
  },
  {
    ...js.configs.recommended,
    files: ['**/*.{js,cjs,mjs}'],
    languageOptions: { globals: globals.node, sourceType: 'commonjs' }
  },
  { files: ['**/*.mjs'], languageOptions: { sourceType: 'module' } },
  ...tseslint.configs.recommended.map((config) => ({ ...config, files: ['**/*.{ts,cts,mts}'] })),
  {
    files: ['**/*.{js,cjs,mjs}'],
    rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }] }
  },
  // CommonJS declaration entrypoints and consumer fixtures intentionally use import-equals.
  {
    files: ['**/*.d.ts', '**/*.cts', 'test/types/*.ts'],
    rules: { '@typescript-eslint/no-require-imports': ['error', { allowAsImport: true }] }
  },
  // These bindings and expressions assert compiler inference without runtime consumption.
  {
    files: ['test/types/*.{ts,cts,mts}'],
    rules: { '@typescript-eslint/no-unused-vars': 'off', '@typescript-eslint/no-unused-expressions': 'off' }
  }
];
