import js from '@eslint/js';
import tseslint from 'typescript-eslint';

// boundary guard. storefront keeps its own hydrogen config and lints itself.
export default [
  {ignores: ['**/node_modules/', 'storefront/', 'core/dist/']},
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['core/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {},
    },
    rules: {
      // ts variant, not the base rule: catches `import type` too
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            '@shopify/*',
            'react-router*',
            'react',
            'react-dom',
            '@dnd-kit/*',
            '*.css',
          ],
        },
      ],
      // backstop for tsconfig lib/types
      'no-restricted-globals': [
        'error',
        ...[
          'window',
          'document',
          'navigator',
          'localStorage',
          'sessionStorage',
          'fetch',
          'requestAnimationFrame',
          'getComputedStyle',
        ].map((name) => ({name, message: 'core has no dom'})),
      ],
    },
  },
];
