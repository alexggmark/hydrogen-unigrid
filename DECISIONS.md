# Decisions

The calls that shaped unigrid, in the order they were made. Each one says what was chosen, what
was rejected, and the fact that decided it.

This is a sanitised version of the real dev logs, kept as decisions were made.

---

## 19 Aug 2026 — Cloudflare Workers, not Oxygen or Vercel

Oxygen's dev-store deployments sit behind a store login, and a public link needs a paid Shopify
plan. A portfolio piece that can't be clicked on is worse than anything the login protects.

Oxygen runs workerd, the same runtime as Cloudflare Workers, so Hydrogen's build output is
already a Cloudflare module worker. `@cloudflare/vite-plugin` was tried and failed on Vite 8's
Rolldown build despite claiming support; in the end no plugin was needed. `wrangler.jsonc`
points at `dist/server/index.js` and deploys it. Oxygen still works as `deploy:oxygen`.

Vercel was rejected: no Web Cache API, which Hydrogen relies on for sub-request caching, and its
runtime is now Node, so local dev would stop matching production.

## 19 Aug 2026 — Prove the editing model before persisting it

The original plan built the storefront read path, the Admin write path and metaobject
definitions before anything was draggable. Instead, an in-memory spike made the grid interactive
with no Shopify at all.

Persistence is downstream of the editing model. If driving the grid by hand showed per-breakpoint
overrides were unworkable, the metaobject definition and the save path would have been written
against a design that was about to change. The engine's property tests were already passing, so
this was not making it draggable while the engine was still a guess.

## 19 Aug 2026 — One level of nesting inside a block

A block holds elements and may hold a group; a group may not hold a group. Anything deeper is
usually the grid's job being done inside a cell, and two blocks side by side does it properly.

What decided it: the limit is cheap to relax and expensive to tighten. Going from one level to
two leaves every stored layout valid. Going back is a migration of live merchant data.

## 20 Aug 2026 — Clip, don't grow

The engine originally measured text in the browser and grew any block whose content overran its
span, pushing column-intersecting blocks below it. It was the centrepiece of the design, and it
was deleted.

Every individual behaviour was correct, but none of it was explicable at the point of the
gesture. Shrinking a grown block's authored span changed nothing on screen and moved its
neighbours instead. Moving a block sideways pushed unrelated blocks down once their columns
started to intersect. Clamping the authored span to the measured minimum was considered and
fails: the clamp itself can collide with the block below, and only the push resolves that.

Clipping needed no new code, since every block already had `overflow: hidden`. What went was the
resolver, the measurement pass and the authored-versus-rendered split that ran through the
editor. It also made `type` select a renderer and nothing else. The editor flags any block that
clips, so an under-sized block reads as a mistake rather than a design.

## 20 Aug 2026 — The public editor cannot write

`/editor` was going to save through a storefront action. That would have been an unauthenticated
write endpoint on the open internet. The real editor is now an embedded Shopify app, and
`/editor` is a playground over in-memory state whose only persistence is a JSON download.

The storefront has no write path at all, so there's nothing public to authenticate. The cost is a
rule from here on: `blocks/` is shared by both apps and cannot import Hydrogen, because the admin
app isn't a Hydrogen app. Image and price rendering are injected instead.

## 20 Aug 2026 — No iframe

Rendering the storefront in an iframe beside the editor's rail was the original plan. Pointer
events don't cross documents, so dragging a block from the palette into an iframe means
forwarding coordinates over `postMessage` and running a shadow drag in the child, plus focus
management across two documents. That puts the cost on drag, the part that already worked.

The iframe's real advantage is fidelity, and the editor already renders the same components
against the same stylesheet. Four page types is four queries in one loader, not a reason to
embed the storefront.

## 20 Aug 2026 — The editor's controls get no design budget

The rail is stock Radix Themes with almost no styling of its own. The artefact is the layout
engine, and every hour on hand-built sliders and switches is an hour not spent on it.

shadcn was rejected: it's a scaffold you copy and own, which suits customising, and it brings
Tailwind, whose global element reset would reach the grid. Radix's reset is opt-in per element,
so it can't touch block markup.

## 20 Aug 2026 — Tablet is two tracks, not desktop scaled down

Derivation first stacked every block full width at every narrower breakpoint, which made tablet
the same composition as mobile at a different size.

Scaling desktop spans by 8/12 was rejected: it means rounding fractional columns and repairing
the collisions the rounding creates, and 3-of-12 and 2-of-8 are proportionally the same and
typographically not. What shipped is one constant, two tracks on tablet and one on mobile, with
anything wider than half the desktop grid kept full width. Clash tests now compare columns, so a
hand-placed block no longer reserves its whole row range.

## 20 Aug 2026 — Freeze the wire format before anything depends on it

Two cheap changes before the first layout was stored. An unknown element kind is now skipped
rather than failing the whole page, so an older reader survives a newer layout. Bad structure,
like a broken cell, is still fatal.

Size was measured rather than guessed: a realistic homepage is 10–22KB against the 128KB field
cap. That margin exists only because defaults are omitted, so a test pins that an empty block
encodes to `{"i":"x","a":[1,1]}`.

## 20 Aug 2026 — One product template for the whole catalogue

There's one product layout, not a default with per-product overrides. Its blocks reference "the
product this route is rendering" rather than a handle, resolved per request.

The editor needs a product to preview against, and that choice is editor state in the URL. If
it reached the layout, the template would silently bind to whichever product was on screen at
the last save.

## 21 Aug 2026 — Publish promotes what is stored, not what is on screen

`publish()` takes no layout. Passing the editor's in-memory layout would let an unsaved edit go
live, leaving `published` holding something `draft` doesn't, and the next save would quietly
revert the live page. Save-then-publish is the only path.

Publish refuses a draft it can't decode, since `published` has to be known-good. It also covers
every region of the page: a header saved but not published would otherwise go live nowhere.

## 21 Aug 2026 — Images are blocks, not elements

An inline image element inside blocks was proposed and rejected. A block with a background image
and no children already is an image, sized by its span and placed by the grid. An element would
have let flex place pictures in a project whose argument is that the grid does.

## 21 Aug 2026 — Pages are Shopify Pages

A layout could have been its own page, with a catch-all route. Instead Shopify owns the page and
a layout attaches to it, because that's where a merchant expects pages to live: in the admin's
list, with SEO fields, addable to menus. It costs the `write_content` scope.

When a merchant deletes a page, its layout goes too. Without a hosted app a webhook would only
fire while a dev tunnel was up, so it reconciles on read. That runs only when the page list is
known to be complete, since a truncated list would read as deletions and destroy real work.

## 21 Aug 2026 — A block stores which colour, not what colour

A block stores a palette slot, not a hex. Store `#ff0000` and the theme can never reach it again;
store slot 3 and changing the palette moves every layout with no writes. A one-off hex is still
allowed and deliberately leaves the theme behind.

The theme has no draft. Every layout references it, so a half-applied palette would be wrong on
every page at once.

## 21 Aug 2026 — Header and footer are layouts; one region is editable at a time

Header and footer are layouts with reserved targets, in the same metaobject type as every page.
The storefront fetches header, body, footer and theme in one aliased query, and renders each
region as its own grid so row numbering can't leak between them.

Editing all three at once would need one undo history spanning three layouts. Showing all three
with one live does not: the editor keeps one history per region and switches between them, and
save sends every region that changed.

## 21 Aug 2026 — Line length is a span, not a stylesheet rule

A `62ch` cap on paragraphs had been in the grid CSS since the start. It made a twelve-column
text block render its text across about eight, while headlines in the same block had no cap.
That's geometry varying by element type, invisible at the point of the drag. A narrow measure is
now authored the way everything else is, by giving the block a narrower span.

## 27 Aug 2026 — Navigation and menus arrive by injection

Buttons stored an href that nothing rendered. Rather than special-casing links, `Grid` takes a
link component: the storefront passes React Router's `Link`, the editor passes an anchor that
doesn't navigate. It defaults to a plain `<a>`, so a surface that forgets to inject gets a working
link rather than dead markup. Images and prices use the same seam.

Menus store a handle, never the links. Merchants edit menus in the Shopify admin often, and a
copy would be stale within the week.

## 30 Aug 2026 — Product elements are universal

The plan was product-only blocks in a product-only palette. That needed a palette that varies by
page, legality rules per template and a page-aware inspector. Instead a product element is an
ordinary element with a source: the route's product, or a pinned handle. It reuses the menu's
seam, and it gives a featured product on the homepage for free.

## 3 Sep 2026 — The collection route fetches its layout first

Every other route fetches layout and content in parallel. A collection can't: the number of
products to ask for is authored in the layout. Fetching a fixed page and slicing it would fetch
too many or too few, invisibly.

Paging is plain links carrying the params Hydrogen's pagination reads back. It works without
JavaScript and the back button is correct for free.

## 4 Sep 2026 — Mobile columns must divide desktop columns

A collection grid's product count is a whole number of rows. Two independent column counts would
break that: twelve products is whole rows at three and six, but not at five. So the mobile count
must divide the desktop one, and the editor offers only those choices.

## 4 Sep 2026 — The theme is in grid units, not rem

Theme controls were asked for in rem. A gutter in rem holds still while the grid around it
scales, breaking the zoom model. At the grid's design width one unit is exactly 1rem, so the
numbers merchants enter are the numbers stored; below that width they scale with everything else.

Only block padding got a separate mobile value. The test for a mobile control is whether
proportional scaling takes it somewhere unusable, and 1% of a phone is under 4px.

## 4 Sep 2026 — Keyboard authoring stops being a gate

Full keyboard authoring was written in as a gate alongside the engine's invariants. It went
unverified for three weeks without anything breaking. The invariants describe the engine; keyboard
authoring describes the editor's chrome. dnd-kit's keyboard drag still works and must not regress,
but it no longer blocks progress.

## 21 Sep 2026 — Add row is the one edit allowed to move other blocks

No edit may move a block other than the one being edited. Add row exists to do exactly that, and
it's allowed because the merchant asked for it. Every block starting at or below the line moves
down together, so the composition below keeps its shape. A tall block crossing the line stays
put rather than being stretched.

Duplicate first stepped past occupied rows, which sent a copy of a full-width header to the
bottom of the page. It now uses add row to open space directly beneath the original.

## 29 Sep 2026 — A block with no background has no padding

A per-block "no padding" switch was rejected for a rule. Padding keeps content off a visible
edge, and a block with no fill has none. Plain blocks now sit on the grid lines, and adding a
fill brings the padding back with nothing to store.

## 2 Oct 2026 — A block's contents can be rearranged on mobile

A row of three items has to become a stack on a phone. A block or group can now carry a second
arrangement for mobile only. It overrides the whole arrangement, not single fields, because
direction decides what align and justify mean. Tablet overrides and per-breakpoint everything
were rejected to keep this a deliberate exception.

## 4 Oct 2026 — A/B tests swap whole pages, and PostHog owns the split

Hiding single blocks per variant would leave holes, since layouts are never repacked. Moving
blocks per variant would need an overlap check for every combination of arms. A variant is a
complete layout, which derives its own breakpoints exactly as the control does.

Splitting traffic in our own code was rejected once the merchant enters a PostHog flag key: the
flag already holds the split and rollout, and storing them again would be two sources of truth.
Both arms live in the page's one metaobject entry, so choosing an arm costs no extra round trip.

The arm is chosen in the worker before render, from a cookie or PostHog with a short timeout.
Components only receive the result, which is what avoids client-side test flicker.
