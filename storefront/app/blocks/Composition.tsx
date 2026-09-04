import {Suspense, type ReactNode} from 'react';
import {Await, useRouteLoaderData} from 'react-router';
import {Analytics} from '@shopify/hydrogen';
import type {RootLoader} from '~/root';
import {Block, Grid, deriveAll} from '@unigrid/blocks';
import type {
  CollectionData,
  Collections,
  MediaUrls,
  Menus,
  ProductData,
  Products,
} from '@unigrid/blocks';
import type {Layout, Palette} from '@unigrid/core';
import {DEV} from '~/blocks/grid-dev';
import {StoreImage} from '~/blocks/image';
import {StoreLink} from '~/blocks/link';
import {Aside} from '~/components/Aside';
import {CartMain} from '~/components/CartMain';

// every unigrid route renders through here, so there is one assembly of a page
// rather than one per route.

function Region({
  layout,
  palette,
  menus,
  product,
  products,
  collection,
  collections,
  media,
}: {
  layout: Layout;
  palette: Palette;
  menus: Menus;
  product?: ProductData;
  products?: Products;
  collection?: CollectionData;
  collections?: Collections;
  media?: MediaUrls;
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
      collection={collection}
      collections={collections}
      media={media}
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

// bare routes return <Outlet /> straight from root, so PageLayout — and with it
// Aside.Provider and the cart drawer — never mounts. the unigrid shell has to
// bring its own or nothing on the page can open one.
function CartDrawer({cart}: {cart: RootData['cart'] | undefined}) {
  return (
    <Aside type="cart" heading="Cart">
      <Suspense fallback={<p>Loading cart…</p>}>
        <Await resolve={cart ?? Promise.resolve(null)}>
          {(cart) => <CartMain cart={cart} layout="aside" />}
        </Await>
      </Suspense>
    </Aside>
  );
}

type RootData = NonNullable<ReturnType<typeof useRouteLoaderData<RootLoader>>>;

// the view events the product and collection routes already render do nothing
// without this: hydrogen's analytics context has a non-null default, so a
// missing provider is silent rather than an error.
function Shell({children}: {children: ReactNode}) {
  const root = useRouteLoaderData<RootLoader>('root');

  const page = (
    <Aside.Provider>
      <CartDrawer cart={root?.cart} />
      {children}
    </Aside.Provider>
  );

  return root ? (
    <Analytics.Provider
      cart={root.cart}
      shop={root.shop}
      consent={root.consent}
    >
      {page}
    </Analytics.Provider>
  ) : (
    page
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
  collection,
  collections,
  media,
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
  // the collection this route is browsing, if it browses one, and any pinned
  collection?: CollectionData;
  collections?: Collections;
  media?: MediaUrls;
  // what to render in place of the body when there is no layout for it
  children?: ReactNode;
}) {
  // separate grids on purpose: each region is its own composition, so row
  // numbering and margins in one cannot reach into another. the stack holds the
  // page's vertical rhythm, so it does not change with which regions exist.
  return (
    <Shell>
      <div className="unigrid-demo u-page">
        <div className="u-stack">
          {header ? (
            <Region
              layout={header}
              menus={menus}
              palette={palette}
              product={product}
              products={products}
              collection={collection}
              collections={collections}
              media={media}
            />
          ) : null}
          {body ? (
            <Region
              layout={body}
              menus={menus}
              palette={palette}
              product={product}
              products={products}
              collection={collection}
              collections={collections}
              media={media}
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
              collection={collection}
              collections={collections}
              media={media}
            />
          ) : null}
        </div>
      </div>
    </Shell>
  );
}
