import {DEFAULT_FLEX, type Block, type Layout, type Node} from '@unigrid/core';
import shot1 from '~/assets/demo/shot-1.svg';
import shot2 from '~/assets/demo/shot-2.svg';
import shot3 from '~/assets/demo/shot-3.svg';
import shot4 from '~/assets/demo/shot-4.svg';
import shot5 from '~/assets/demo/shot-5.svg';
import shot6 from '~/assets/demo/shot-6.svg';

// dummy content for the spike. nothing here is persisted.

const flex = (patch: Partial<Block['flex']> = {}): Block['flex'] => ({
  ...DEFAULT_FLEX,
  ...patch,
});

const block = (
  id: string,
  at: Block['at'],
  rest: Partial<Omit<Block, 'id' | 'at'>> = {},
): Block => ({
  id,
  at,
  fill: {},
  flex: flex(),
  invert: false,
  children: [],
  ...rest,
});

const hl = (id: string, level: 1 | 2 | 3 | 4 | 5, value: string): Node => ({
  id,
  kind: 'headline',
  level,
  value,
});
const text = (id: string, size: 'lg' | 'sm', value: string): Node => ({
  id,
  kind: 'text',
  size,
  value,
});
const button = (
  id: string,
  variant: 'primary' | 'outline' | 'glass',
  label: string,
): Node => ({id, kind: 'button', variant, label, href: '#'});

export const HARNESS: Layout = {
  version: 1,
  blocks: [
    block(
      'masthead',
      {
        a: {col: 1, colSpan: 8, row: 1, rowSpan: 3},
        b: {col: 1, colSpan: 8, row: 1, rowSpan: 3},
        c: {col: 1, colSpan: 4, row: 1, rowSpan: 3},
      },
      {
        flex: flex({justify: 'end', gap: 1}),
        children: [
          // the shopper's controls sit in a row group, not inside the menu:
          // siblings keep their own alignment and stay put when a menu folds
          {
            id: 'masthead-shop',
            kind: 'group',
            flex: flex({direction: 'row', justify: 'end', gap: 2}),
            children: [
              {
                id: 'masthead-menu',
                kind: 'menu',
                handle: 'main-menu',
                direction: 'row',
                collapse: true,
              },
              {id: 'masthead-account', kind: 'account', label: 'Account'},
              {id: 'masthead-cart', kind: 'cart', label: 'Cart'},
            ],
          },
          hl('masthead-h', 1, 'Zoom, not reflow.'),
          text('masthead-t', 'lg', 'A storefront on a strict modular grid.'),
        ],
      },
    ),

    block(
      'intro',
      {
        a: {col: 1, colSpan: 4, row: 4, rowSpan: 4},
        b: {col: 1, colSpan: 4, row: 4, rowSpan: 4},
        c: {col: 1, colSpan: 4, row: 4, rowSpan: 5},
      },
      {
        fill: {color: {slot: 3}},
        invert: true,
        flex: flex({justify: 'between', gap: 2}),
        children: [
          hl('intro-h', 3, 'Inverted'),
          text(
            'intro-t',
            'sm',
            'Ink and paper swap together, so the button follows the block without being told.',
          ),
          button('intro-b', 'primary', 'Primary'),
        ],
      },
    ),

    block(
      'essay',
      {
        a: {col: 5, colSpan: 5, row: 4, rowSpan: 5},
        b: {col: 5, colSpan: 4, row: 4, rowSpan: 6},
        c: {col: 1, colSpan: 4, row: 9, rowSpan: 6},
      },
      {
        flex: flex({gap: 1}),
        children: [
          hl('essay-h', 4, 'Every block is the same box'),
          text(
            'essay-t',
            'sm',
            'Type picks the renderer. Geometry is identical: a span, whole modules in both axes, and content that overruns is clipped rather than grown.',
          ),
          {
            id: 'essay-row',
            kind: 'group',
            flex: flex({direction: 'row', gap: 1, align: 'center'}),
            children: [
              {id: 'essay-b1', kind: 'button', variant: 'primary', label: 'Primary', href: '#'},
              {id: 'essay-b2', kind: 'button', variant: 'outline', label: 'Outline', href: '#'},
              {id: 'essay-b3', kind: 'button', variant: 'glass', label: 'Glass', href: '#'},
            ],
          },
        ],
      },
    ),

    block(
      'tint',
      {
        a: {col: 10, colSpan: 3, row: 4, rowSpan: 5},
        b: {col: 1, colSpan: 8, row: 10, rowSpan: 3},
        c: {col: 1, colSpan: 4, row: 15, rowSpan: 4},
      },
      {
        fill: {
          color: {slot: 4},
          // a real file in the dev store, resolved by the route rather than
          // stored as a cdn path
          media: {kind: 'image', id: 'gid://shopify/MediaImage/33216148897974'},
          overlay: {color: {hex: '#000000'}, opacity: 0.35},
        },
        invert: true,
        flex: flex({justify: 'center', align: 'center', gap: 1}),
        children: [
          hl('tint-h', 5, 'Overlay'),
          text('tint-t', 'sm', 'Colour, then a tint at any opacity.'),
          // glass over an image on an inverted block: the label follows the
          // scheme, the pane does not tint the fill underneath it
          button('tint-b', 'glass', 'Glass'),
        ],
      },
    ),

    block(
      'strip',
      {
        a: {col: 1, colSpan: 12, row: 9, rowSpan: 1},
        b: {col: 1, colSpan: 8, row: 13, rowSpan: 1},
        c: {col: 1, colSpan: 4, row: 19, rowSpan: 2},
      },
      {
        fill: {color: {slot: 1}},
        invert: true,
        flex: flex({direction: 'row', justify: 'between', align: 'center'}),
        children: [
          text('strip-a', 'sm', '01 grid'),
          text('strip-b', 'sm', '02 blocks'),
          text('strip-c', 'sm', '03 groups'),
          text('strip-d', 'sm', '04 editor'),
        ],
      },
    ),

    block(
      'catalogue',
      {
        a: {col: 1, colSpan: 12, row: 10, rowSpan: 10},
        b: {col: 1, colSpan: 8, row: 14, rowSpan: 7},
        c: {col: 1, colSpan: 4, row: 21, rowSpan: 13},
      },
      {
        children: [
          {
            id: 'catalogue-grid',
            kind: 'collection',
            source: 'context',
            columns: 4,
            // two across on a phone, so the demo shows the band split
            narrow: 2,
            count: 8,
            variant: 'outline',
          },
        ],
      },
    ),
  ],
};

// the playground has no store to query, so the menu element has something to
// render. nothing here reaches a real menu.
export const DEMO_MENUS = [
  {
    handle: 'main-menu',
    title: 'Main menu',
    items: [
      {id: 'demo-1', title: 'Shop', url: '/collections/all'},
      {id: 'demo-2', title: 'Lookbook', url: '/pages/lookbook'},
      {id: 'demo-3', title: 'About', url: '/pages/about'},
      {id: 'demo-4', title: 'Contact', url: '/pages/contact'},
    ],
  },
];

// same for products: svg assets served from this origin, because the dev csp
// blocks data uris. deliberately wider than tall, so object-fit has something
// to crop.
const SHOTS = [shot1, shot2, shot3, shot4, shot5, shot6];

const shots = (handle: string, from: number) =>
  SHOTS.map((url, i) => ({
    id: `${handle}-${i + 1}`,
    url: SHOTS[(i + from) % SHOTS.length] ?? url,
    alt: `${handle} view ${i + 1}`,
  }));

export const DEMO_PRODUCTS = [
  {
    handle: 'demo-chair',
    title: 'Cantilever chair',
    price: '£420.00',
    images: shots('demo-chair', 0),
  },
  {
    handle: 'demo-lamp',
    title: 'Column lamp',
    price: '£180.00',
    images: shots('demo-lamp', 3),
  },
];

// and a collection for the repeater, paged so the Next control has something to
// render. eight products, so four columns is two whole rows.
const CATALOGUE: [string, string][] = [
  ['Cantilever chair', '£420.00'],
  ['Column lamp', '£180.00'],
  ['Slab table', '£960.00'],
  ['Rail shelf', '£240.00'],
  ['Drum stool', '£150.00'],
  ['Grid mirror', '£310.00'],
  ['Plane desk', '£780.00'],
  ['Bracket light', '£95.00'],
];

export const DEMO_COLLECTION = {
  handle: 'demo-all',
  title: 'Everything',
  products: CATALOGUE.map(([title, price], i) => ({
    handle: `demo-item-${i + 1}`,
    title,
    price,
    images: shots(`demo-item-${i + 1}`, i),
  })),
  next: '#',
};

export const DEMO_MENU_LINKS = Object.fromEntries(
  DEMO_MENUS.map((m) => [m.handle, m.items]),
);
