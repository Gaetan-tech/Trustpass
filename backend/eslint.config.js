import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

// Config ESLint 9 (flat) — API backend TypeScript/Node.
export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'coverage/', '*.config.js'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    // Tests : plus permissif (mocks, any assumés).
    files: ['tests/**/*.ts', '**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
