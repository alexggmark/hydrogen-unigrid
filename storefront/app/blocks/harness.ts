import {DEFAULT_FLEX, type Block, type Layout, type Node} from '@unigrid/core';

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
  variant: 'primary' | 'secondary',
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
        fill: {color: '#d8261c'},
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
              {id: 'essay-b2', kind: 'button', variant: 'secondary', label: 'Secondary', href: '#'},
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
          color: '#1b3fa0',
          overlay: {color: '#000000', opacity: 0.35},
        },
        invert: true,
        flex: flex({justify: 'center', align: 'center', gap: 1}),
        children: [
          hl('tint-h', 5, 'Overlay'),
          text('tint-t', 'sm', 'Colour, then a tint at any opacity.'),
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
        fill: {color: '#111110'},
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
  ],
};
