import type {ReactNode} from 'react';
import {Block, Grid, deriveAll} from '@unigrid/blocks';
import type {Menus, ProductData, Products} from '@unigrid/blocks';
import type {Layout, Palette} from '@unigrid/core';
import {DEV} from '~/blocks/grid-dev';
import {StoreImage} from '~/blocks/image';
import {StoreLink} from '~/blocks/link';

// every unigrid route renders through here, so there is one assembly of a page
// rather than one per route.

function Region({
  layout,
  palette,
  menus,
  product,
  products,
}: {
  layout: Layout;
  palette: Palette;
  menus: Menus;
  product?: ProductData;
  products?: Products;
}) {
  const at = deriveAll(layout);
  return (
    <Grid
      dev={DEV}
      image={StoreImage}
      link={StoreLink}
      menus={menus}
      palette={palette}
      product={product}
      products={products}
    >
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
  menus,
  product,
  products,
  children,
}: {
  header: Layout | null;
  body: Layout | null;
  footer: Layout | null;
  palette: Palette;
  menus: Menus;
  // the product this route renders, if it renders one, and any the layout pinned
  product?: ProductData;
  products?: Products;
  // what to render in place of the body when there is no layout for it
  children?: ReactNode;
}) {
  // separate grids on purpose: each region is its own composition, so row
  // numbering and margins in one cannot reach into another. the stack holds the
  // page's vertical rhythm, so it does not change with which regions exist.
  return (
    <div className="unigrid-demo u-page">
      <div className="u-stack">
        {header ? (
          <Region
            layout={header}
            menus={menus}
            palette={palette}
            product={product}
            products={products}
          />
        ) : null}
        {body ? (
          <Region
            layout={body}
            menus={menus}
            palette={palette}
            product={product}
            products={products}
          />
        ) : (
          children
        )}
        {footer ? (
          <Region
            layout={footer}
            menus={menus}
            palette={palette}
            product={product}
            products={products}
          />
        ) : null}
      </div>
    </div>
  );
}
