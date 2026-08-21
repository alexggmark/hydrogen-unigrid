import type {CSSProperties} from 'react';
import {
  isGroup,
  isSlot,
  SLOTS,
  type Colour,
  type Element,
  type Flex,
  type Node,
  type Palette,
} from '@unigrid/core';

// a slot resolves to a variable, not a value, so changing the palette moves
// every block using it — including ones already published.
export const paint = (c: Colour): string =>
  isSlot(c) ? `var(--theme-${c.slot})` : c.hex;

export const paletteVars = (palette: Palette): Record<string, string> =>
  Object.fromEntries(SLOTS.map((slot) => [`--theme-${slot}`, palette[slot]]));

const JUSTIFY: Record<Flex['justify'], string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
};

const ALIGN: Record<Flex['align'], string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
};

// text follows whichever axis runs horizontally: `align` in a column, `justify`
// in a row. authoring it separately meant two controls that look alike and
// disagree only when a box is wider than its content.
const TEXT_IN_COLUMN: Record<Flex['align'], string> = {
  start: 'start',
  center: 'center',
  end: 'end',
  stretch: 'start',
};

const TEXT_IN_ROW: Record<Flex['justify'], string> = {
  start: 'start',
  center: 'center',
  end: 'end',
  between: 'start',
};

export const textAlign = (f: Flex): string =>
  f.direction === 'column' ? TEXT_IN_COLUMN[f.align] : TEXT_IN_ROW[f.justify];

export const flexVars = (f: Flex): CSSProperties =>
  ({
    '--fd': f.direction,
    '--jc': JUSTIFY[f.justify],
    '--ai': ALIGN[f.align],
    '--ta': textAlign(f),
    '--gap': f.gap,
  }) as CSSProperties;

const HEADINGS = ['h1', 'h2', 'h3', 'h4', 'h5'] as const;

function Leaf({node}: {node: Element}) {
  switch (node.kind) {
    case 'headline': {
      const Tag = HEADINGS[node.level - 1] ?? 'h2';
      return <Tag className={`u-hl u-hl-${node.level}`}>{node.value}</Tag>;
    }
    case 'text':
      return <p className={`u-text u-text-${node.size}`}>{node.value}</p>;
    case 'richText':
      // pre-line splits paragraphs in css, so lines need no keys of their own
      return (
        <p className={`u-text u-text-${node.size} u-lines`}>{node.value}</p>
      );
    case 'button':
      return (
        <span className="u-btn" data-variant={node.variant}>
          {node.label}
        </span>
      );
  }
}

export function Nodes({nodes}: {nodes: readonly Node[]}) {
  return (
    <>
      {nodes.map((node) =>
        isGroup(node) ? (
          <div
            key={node.id}
            className="u-flow u-group"
            data-node={node.id}
            style={flexVars(node.flex)}
          >
            <Nodes nodes={node.children} />
          </div>
        ) : (
          <div key={node.id} className="u-el" data-node={node.id}>
            <Leaf node={node} />
          </div>
        ),
      )}
    </>
  );
}
