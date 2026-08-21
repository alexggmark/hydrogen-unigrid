import type {ReactNode} from 'react';
import {Block, Grid, deriveAll} from '@unigrid/blocks';
import type {Layout, Palette} from '@unigrid/core';
import {DEV} from '~/blocks/grid-dev';

// every unigrid route renders through here, so there is one assembly of a page
// rather than one per route.

function Region({layout, palette}: {layout: Layout; palette: Palette}) {
  const at = deriveAll(layout);
  return (
    <Grid dev={DEV} palette={palette}>
      {layout.blocks.map((block) => {
        const placement = at.get(block.id);
        return placement ? (
          <Block key={block.id} block={block} at={placement} />
        ) : null;
      })}
    </Grid>
  );
}

export function Composition({
  header,
  body,
  footer,
  palette,
  children,
}: {
  header: Layout | null;
  body: Layout | null;
  footer: Layout | null;
  palette: Palette;
  // what to render in place of the body when there is no layout for it
  children?: ReactNode;
}) {
  // separate grids on purpose: each region is its own composition, so row
  // numbering and margins in one cannot reach into another
  return (
    <div className="unigrid-demo">
      {header ? <Region layout={header} palette={palette} /> : null}
      {body ? <Region layout={body} palette={palette} /> : children}
      {footer ? <Region layout={footer} palette={palette} /> : null}
    </div>
  );
}
