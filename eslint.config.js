import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Root config. Its only job is the CLAUDE.md §3 boundary guard on `core/`.
 * `storefront/` keeps the Hydrogen-shipped config it was scaffolded with and is
 * linted by its own workspace script — two configs, one per boundary, so a
 * Hydrogen template update can never quietly relax the guard.
 */
export default [
  {ignores: ['**/node_modules/', 'storefront/', 'core/dist/']},
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['core/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      // No browser and no node globals: core/ runs in the resolver, not a runtime.
      globals: {},
    },
    rules: {
      /* The §3 rule. Uses the typescript-eslint variant rather than the base
         rule so `import type {ProductFragment} from '@shopify/hydrogen'` is
         caught too — §10 lists codegen types in core/ as a named pitfall. */
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            '@shopify/*',
            'react-router*',
            'react',
            'react-dom',
            '@dnd-kit/*',
            // §11: core/ carries no styling. Grid geometry is CSS in storefront/.
            '*.css',
          ],
        },
      ],
      // Belt and braces with tsconfig `lib: ES2022` / `types: []` (see core/tsconfig.json).
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
        ].map((name) => ({
          name,
          message: 'core/ has no DOM (CLAUDE.md §3). Measurement is passed in as data (§6).',
        })),
      ],
    },
  },
];
