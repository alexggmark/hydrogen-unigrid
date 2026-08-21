import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    // no browser, no shopify
    environment: 'node',
    include: [
      'core/**/*.test.ts',
      'blocks/**/*.test.ts',
      'storefront/app/**/*.test.ts',
      'admin-app/app/**/*.test.ts',
    ],
  },
});
