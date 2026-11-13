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

The design calls behind all this, dated, with what was rejected: [DECISIONS.md](DECISIONS.md).

## Stack

- Hydrogen 2026.4 / React Router 7, TypeScript strict, Vite
- Cloudflare Workers hosting (the same runtime Oxygen uses)
- @dnd-kit (the newer `@dnd-kit/react` packages)
- Radix Themes for the editor's controls
- Plain CSS for the grid: custom properties, container queries, subgrid
- Vitest, Playwright
- Built with Claude Code

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

## How it works

unigrid is a headless Shopify storefront. Shopify holds the data — products, collections, menus,
files, and the page layouts themselves — but renders nothing. It is not a Liquid theme, and the
admin app replaces the theme editor. Checkout is still Shopify's own.

```
 admin-app (Node, embedded in Shopify admin)        storefront (Hydrogen on Cloudflare Workers)
 ┌───────────────────────────────┐                  ┌──────────────────────────────────┐
 │ <Editor> from editor/         │                  │ <Composition> → <Grid>/<Block>   │
 │ loader/action → layout.server │                  │ loader → lib/layout.ts           │
 └──────────────┬────────────────┘                  └───────────────┬──────────────────┘
                │ Admin GraphQL API (write)                         │ Storefront API (read)
                ▼                                                   ▼
        ┌─────────────────────────────────────────────────────────────────┐
        │ Shopify metaobjects:  unigrid_layout (one per page or region)   │
        │                       unigrid_theme  (palette, metrics, logo)   │
        └─────────────────────────────────────────────────────────────────┘
```

### The admin app

1. Shopify loads it in an iframe inside the admin (`embedded = true` in `shopify.app.toml`).
2. On install it runs OAuth under `/auth/*` and stores an offline token in a Prisma session table.
3. Every request goes through `authenticate.admin(request)`, which verifies App Bridge's session
   token. App Bridge also supplies toasts and Shopify's own file picker.
4. `app._index.tsx` loads the header, body and footer drafts, the theme, and the pages, menus,
   products and collections the editor's pickers offer. The page being edited and the A/B arm
   are URL state (`?target=product&arm=b`).
5. It renders `<Editor>` from `editor/` — the same component as the public `/editor` playground,
   with save and publish wired to Shopify instead of a JSON download.

### Saving and publishing

Each `unigrid_layout` entry has `draft`, `published` and `version` fields, plus `draft_b`,
`published_b` and `flag` while an A/B test runs. Layouts are stored as compact JSON from `core`'s
`encode()`.

- **Save** writes `draft` only. One submit carries every region that changed. Nothing goes live,
  because the storefront never reads `draft`.
- **Publish** copies `draft → published` for header, body and footer together and bumps
  `version`. A draft that fails to decode is refused.
- **Theme** changes have no draft: every page references the theme, so saving is publishing.
- **A/B tests** copy A's draft into `draft_b`, attach a PostHog flag key, and publish both arms
  together. Rolling out promotes one arm and clears the test.

All of it lives in `admin-app/app/lib/layout.server.ts`, framework-free; the route action is a
thin dispatcher into it.

### Rendering a page

1. `storefront/server.ts` builds the Hydrogen context per request — Storefront API client, Cache
   API, session, cart — and hands off to React Router.
2. Each route's loader asks for a fixed target: `home`, `product`, `collection` or
   `page:<handle>`. Product and collection use one template for the whole catalogue.
3. One aliased GraphQL query fetches header, body, footer and theme in a single round trip,
   reading `published`.
4. If the page has a live test, the worker picks an arm before render: from a cookie, or from
   PostHog with a 300ms timeout that falls back to A. Those pages are served `private, no-store`.
5. Layouts hold references — menu and product handles, file IDs — so only what a layout names is
   fetched, in parallel.
6. `<Composition>` renders each region as its own `<Grid>`. Placements for all three breakpoints
   are derived up front as CSS custom properties, and container queries pick the active one.
7. Hydrogen's `<Image>` and router links are injected into `<Grid>`, which is what lets `blocks/`
   build inside the admin app too.

Published changes reach the storefront within seconds: layout queries use Hydrogen's short cache.

### Setting up a store

The metaobject definitions are created in the Shopify admin, not in code:

- `unigrid_layout` with `target`, `version`, `draft`, `published`, `draft_b`, `published_b`,
  `flag`
- `unigrid_theme` (handle `default`) with colour slots, `metrics` and `settings`

Both need **Storefront API access** enabled and entries published, or the storefront's queries
return nothing. Products must be published to the Hydrogen sales channel.
