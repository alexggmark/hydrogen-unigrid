# unigrid

A Shopify Hydrogen storefront on a strict modular grid, with a drag-and-drop layout editor.

Inspired by Massimo Vignelli's Unigrid, the modular system behind the US National Park Service. Visual editors tend to give you freedom without structure. Shopify's Horizon theme gets closer, but layout still lives in nested sidebar settings rather than on the page, so it never feels like true WYSIWYG. unigrid puts the grid first: you place blocks directly on it, and the grid keeps every layout coherent.

**Try the editor:** https://unigrid.unigrid.workers.dev/editor — no login needed.

The point of it is the layout engine. The editor sits on top of it.

## What it does

- Lay out a page by dragging blocks onto a fixed grid: product, collection, menu, text, image and so on
- Three breakpoints: **desktop** (12 columns), **tablet** (8) and **mobile** (4). Each has its own fixed layout.
- Tablet and mobile are worked out from the desktop layout, and you can override any block by hand at either one.
- Four page types: home, page, product and collection. Product and collection each use one template for the whole catalogue.
- Save a draft, then publish. Changes reach the storefront on the next page load.

## Key ideas

- **The page zooms instead of reflowing.** Within a breakpoint, nothing moves. The whole layout scales from one value, `--u = 1cqw` (1% of the grid's own width). Gutters, cells, type and spacing are all multiples of it. There are no px values in the grid layer.
- **A block is the size you gave it.** Content that doesn't fit is clipped, and the editor flags it. Blocks never grow, and an edit never pushes another block. (Blocks that grew with their content were built first and then removed: the editor's handles stopped matching what got saved.)
- **Gaps are allowed.** A layout with empty space is valid, and nothing is ever shuffled up to close the gaps.
- **Overrides are per block, per breakpoint.** A mobile layout can be 90% worked out automatically and 10% placed by hand.
- **The editor renders the same components as the storefront, in the same document.** No iframe, and no second copy of the grid.
- **Drops are checked before they're applied.** A block can't be dropped where it would overlap another or go off the grid.

## Structure

```
core/        grid math, block model, breakpoint derivation, serialisation, undo
             zero dependencies: no React, no Shopify, no DOM
blocks/      block renderers + grid CSS, shared by both apps
             React + core only; Hydrogen pieces (Image, Money) are injected
editor/      editing UI: rail, selection, drag (dnd-kit), inspector
storefront/  Hydrogen app. Reads only, deploys to Cloudflare Workers
admin-app/   embedded Shopify app. The only thing that writes
```

### Why `core/` is separate

- **Testable on its own.** Pure functions, no browser or Shopify, so the property tests run in under a second.
- **Proven before drag existed.** Later bugs were drag bugs, not layout bugs in disguise.
- **One engine everywhere.** Storefront, admin and playground share it, and framework upgrades can't reach it.

- Lint rules enforce the boundaries: `core/` can't import React, Shopify or the router, and `blocks/` can't import Hydrogen.
- Layouts are stored in Shopify metaobjects. The admin app writes them through the Admin API, and the storefront reads them through the Storefront API.
- Blocks store references (product handle, image ID), never copies of the data.
- `/editor` on the storefront is a public instance of the same editor, with no write access. Export downloads the layout as JSON.

## Stack

- Hydrogen 2026.4 / React Router 7, TypeScript strict, Vite
- Cloudflare Workers hosting (the same runtime Oxygen uses)
- @dnd-kit (the newer `@dnd-kit/react` packages)
- Radix Themes for the editor's controls
- Plain CSS for the grid: custom properties, container queries, subgrid
- Vitest, Playwright

## Running it

```bash
npm install
npm run dev          # storefront, needs storefront/.env
npm run dev:admin    # admin app, via shopify app dev
npm test             # core + blocks unit/property tests
npm run test:e2e     # playwright visual regression per breakpoint
npm run lint && npm run typecheck
```

- Deploy: `npm run deploy --workspace storefront`, which builds and runs `wrangler deploy`.

## Tests

- Property tests on `core/`, with no browser and no network:
  - blocks never overlap, at any breakpoint
  - every drop lands on whole grid cells
  - the rendered size is exactly the size you set
  - save → load gives back the same layout
  - undo/redo gives back an identical state
  - an edit changes only the block being edited
- Playwright screenshot tests at one width per breakpoint.
- CI runs lint (which includes the boundary rules), typecheck and the unit tests.
