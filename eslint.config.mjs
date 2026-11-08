import js from '@eslint/js';
import nxPlugin from '@nx/eslint-plugin';
import tseslint from 'typescript-eslint';
export default tseslint.config(
  ...nxPlugin.configs['flat/base'],
  ...nxPlugin.configs['flat/typescript'],
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.nx/**',
      '.angular/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      '.local/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    plugins: { '@nx': nxPlugin },
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          allow: [],
          // AuthPage is isolated as a lazy library, while its singleton AuthStore is shared eagerly.
          checkDynamicDependenciesExceptions: ['@mirhal/auth'],
          depConstraints: [
            { sourceTag: 'scope:shared', onlyDependOnLibsWithTags: ['scope:shared'] },
            { sourceTag: 'scope:web', onlyDependOnLibsWithTags: ['scope:web', 'scope:shared'] },
            { sourceTag: 'scope:admin', onlyDependOnLibsWithTags: ['scope:admin', 'scope:shared'] },
            { sourceTag: 'scope:api', onlyDependOnLibsWithTags: ['scope:api', 'scope:shared'] },
          ],
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['**/*.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
      },
    },
  },
);
