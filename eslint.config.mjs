import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
export default [
  {
    ignores: [
      'node_modules/**',
      'artifacts/**',
      '.local/**',
      'web/dist/**',
      'web/legacy/**',
      'web/.next/**',
      'web/next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['web/**/*.ts', 'web/**/*.tsx'],
  })),
  {
    files: ['web/src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: globals.browser,
    },
    rules: {
      'no-unused-vars': 'error',
      eqeqeq: 'error',
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
  {
    files: ['**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      eqeqeq: 'error',
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
];
