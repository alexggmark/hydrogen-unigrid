/**
 * @unigrid/core — grid math, block model, layout resolver, serialisation, undo.
 *
 * CLAUDE.md §3: zero dependencies. No React, no Shopify, no router, no DOM.
 * The resolver is a pure function of (authoredLayout, measurements); measurement
 * happens in the browser and is handed in as data (§6).
 */

/** Placeholder until Phase 3 lands the block model. */
export const UNIGRID_CORE = 'unigrid-core' as const;
