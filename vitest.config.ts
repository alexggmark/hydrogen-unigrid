import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    // CLAUDE.md §9: core/ property tests run with no browser and no Shopify.
    environment: 'node',
    include: ['core/**/*.test.ts'],
  },
});
