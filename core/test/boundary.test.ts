import {describe, expect, it} from 'vitest';

import {UNIGRID_CORE} from '../src/index.js';

describe('@unigrid/core', () => {
  it('is importable with no browser and no Shopify', () => {
    expect(UNIGRID_CORE).toBe('unigrid-core');
  });
});
