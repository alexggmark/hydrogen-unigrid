import js from '@eslint/js';
import tseslint from 'typescript-eslint';

// boundary guard. storefront keeps its own hydrogen config and lints itself.
export default [
  {ignores: ['**/node_modules/', 'storefront/', 'admin-app/', 'core/dist/']},
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
  {
    // blocks is shared with the admin app, which is not a hydrogen app. an
    // <Image> here compiles in the storefront and breaks the other build.
    files: ['blocks/**/*.ts', 'blocks/**/*.tsx'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {ecmaFeatures: {jsx: true}},
      globals: {
        window: 'readonly',
        document: 'readonly',
        getComputedStyle: 'readonly',
        ResizeObserver: 'readonly',
        MutationObserver: 'readonly',
        HTMLElement: 'readonly',
        Element: 'readonly',
        addEventListener: 'readonly',
        removeEventListener: 'readonly',
        KeyboardEvent: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@shopify/*'],
              message: 'blocks is shared with a non-hydrogen app',
            },
            {
              group: ['react-router*'],
              message: 'blocks takes props, never router state',
            },
            {group: ['~/*'], message: 'no app aliases in a package'},
          ],
        },
      ],
    },
  },
];
