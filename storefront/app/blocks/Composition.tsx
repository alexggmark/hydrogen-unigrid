import {
  Suspense,
  createContext,
  useContext,
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {Await, Link, useFetcher, useRouteLoaderData} from 'react-router';
import {Analytics, CartForm} from '@shopify/hydrogen';
import type {RootLoader} from '~/root';
import {
  Block,
  Grid,
  ThemeFont,
  deriveAll,
  metricVars,
  pageVars,
} from '@unigrid/blocks';
import type {
  CollectionData,
  Collections,
  LogoData,
  MediaUrls,
  Menus,
  ProductData,
  Products,
  ShopState,
} from '@unigrid/blocks';
import type {Layout, Metrics, Palette, Settings} from '@unigrid/core';
import {StoreImage} from '~/blocks/image';
import {StoreLink} from '~/blocks/link';
import {Aside, useAside} from '~/components/Aside';
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
  shop,
  metrics,
  logo,
}: {
  layout: Layout;
  palette: Palette;
  menus: Menus;
  product?: ProductData;
  products?: Products;
  collection?: CollectionData;
  collections?: Collections;
  media?: MediaUrls;
  shop?: ShopState;
  metrics?: Metrics;
  logo?: LogoData;
}) {
  const at = deriveAll(layout);
  return (
    <Grid
      image={StoreImage}
      link={StoreLink}
      menus={menus}
      palette={palette}
      product={product}
      products={products}
      collection={collection}
      collections={collections}
      media={media}
      shop={shop}
      metrics={metrics}
      logo={logo}
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

// the menu element renders a button; the drawer it opens is the shell's, the
// same split the cart already has. one aside serves whichever menu asked.
function MenuDrawer({menus, handle}: {menus: Menus; handle: string | null}) {
  const {close} = useAside();
  const items = (handle && menus[handle]) || [];
  return (
    <Aside type="mobile" heading="Menu">
      <nav className="u-drawer-menu">
        {items.map((item) => (
          <Link
            key={item.id}
            className="u-drawer-link"
            to={item.url}
            onClick={close}
            prefetch="intent"
          >
            {item.title}
          </Link>
        ))}
      </nav>
    </Aside>
  );
}

type RootData = NonNullable<ReturnType<typeof useRouteLoaderData<RootLoader>>>;

// the cart is a promise and the grid must not wait on it: the count arrives
// after hydration, exactly as the skeleton's badge does.
function useCartCount(cart: RootData['cart'] | undefined): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let live = true;
    Promise.resolve(cart)
      .then((c) => live && setCount(c?.totalQuantity ?? 0))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [cart]);
  return count;
}

function useShopState(root: RootData | undefined): ShopState {
  const {open} = useAside();
  const onOpenMenu = useContext(OpenMenuCtx);
  const cartCount = useCartCount(root?.cart);
  const [loggedIn, setLoggedIn] = useState(false);
  useEffect(() => {
    let live = true;
    Promise.resolve(root?.isLoggedIn)
      .then((yes) => live && setLoggedIn(Boolean(yes)))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [root?.isLoggedIn]);

  // the same post the skeleton's <CartForm> makes, without the form: a buy
  // button inside a block cannot be wrapped in one from out here.
  const fetcher = useFetcher();
  const onAddToCart = useCallback(
    (variantId: string) => {
      void fetcher.submit(
        {
          cartFormInput: JSON.stringify({
            action: CartForm.ACTIONS.LinesAdd,
            inputs: {lines: [{merchandiseId: variantId, quantity: 1}]},
          }),
        },
        {method: 'POST', action: '/cart'},
      );
      // opened on click rather than on success: the drawer is where the result
      // shows, and waiting for the round trip reads as nothing happening
      open('cart');
    },
    [fetcher, open],
  );

  return useMemo(
    () => ({
      cartCount,
      onOpenCart: () => open('cart'),
      loggedIn,
      onAddToCart,
      addingToCart: fetcher.state !== 'idle',
      onOpenMenu,
    }),
    [cartCount, loggedIn, open, onAddToCart, fetcher.state, onOpenMenu],
  );
}

// the view events the product and collection routes already render do nothing
// without this: hydrogen's analytics context has a non-null default, so a
// missing provider is silent rather than an error.
function Shell({menus, children}: {menus: Menus; children: ReactNode}) {
  const root = useRouteLoaderData<RootLoader>('root');
  const [menuHandle, setMenuHandle] = useState<string | null>(null);

  const page = (
    <Aside.Provider>
      <CartDrawer cart={root?.cart} />
      <MenuDrawer menus={menus} handle={menuHandle} />
      <OpenMenu onHandle={setMenuHandle}>{children}</OpenMenu>
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

// records which menu was asked for and opens the one drawer. it sits below the
// provider because useAside cannot run above it.
const OpenMenuCtx = createContext<((handle: string) => void) | undefined>(
  undefined,
);

function OpenMenu({
  onHandle,
  children,
}: {
  onHandle: (handle: string) => void;
  children: ReactNode;
}) {
  const {open} = useAside();
  const openMenu = useCallback(
    (handle: string) => {
      onHandle(handle);
      open('mobile');
    },
    [onHandle, open],
  );
  return (
    <OpenMenuCtx.Provider value={openMenu}>{children}</OpenMenuCtx.Provider>
  );
}

function Page({
  header,
  body,
  footer,
  palette,
  metrics,
  settings,
  logo,
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
  metrics?: Metrics;
  settings?: Settings;
  logo?: LogoData;
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
  const shop = useShopState(useRouteLoaderData<RootLoader>('root'));

  // separate grids on purpose: each region is its own composition, so row
  // numbering and margins in one cannot reach into another. the stack holds the
  // page's vertical rhythm, so it does not change with which regions exist.
  return (
    <div
      className="unigrid-demo u-page"
      style={
        {
          ...metricVars(metrics),
          ...pageVars(palette, settings),
        } as CSSProperties
      }
    >
      <ThemeFont settings={settings} />
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
            shop={shop}
            metrics={metrics}
            logo={logo}
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
            shop={shop}
            metrics={metrics}
            logo={logo}
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
            shop={shop}
            metrics={metrics}
            logo={logo}
          />
        ) : null}
      </div>
    </div>
  );
}

// the shell is separate so the page can read the aside context it mounts: a
// cart button has to be able to open a drawer that is above it in the tree.
export function Composition(props: Parameters<typeof Page>[0]) {
  return (
    <Shell menus={props.menus}>
      <Page {...props} />
    </Shell>
  );
}
