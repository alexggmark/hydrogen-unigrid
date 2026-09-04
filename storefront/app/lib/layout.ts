import {
  DEFAULT_PALETTE,
  SLOTS,
  collectionCounts,
  decode,
  menuHandles,
  productHandles,
  type Layout,
  type Palette,
} from '@unigrid/core';
import {
  menuPath,
  type CollectionData,
  type Collections,
  type MenuLink,
  type Menus,
  type ProductData,
  type Products,
} from '@unigrid/blocks';

// the metaobject's field shape stops here. everything above this file sees a
// Layout and nothing else.

export type Stored = {version: number; layout: Layout};

export const LAYOUT_QUERY = `#graphql
  query UnigridLayout($handle: String!) {
    metaobject(handle: {type: "unigrid_layout", handle: $handle}) {
      fields { key value }
    }
  }
` as const;

// metaobject handles cannot contain a colon, so `page:about` is stored as
// `page-about`. the target stays the name everything else uses.
const handleFor = (target: string) => target.replace(/:/g, '-');

type Fields = {key: string; value?: string | null}[];

type Queryable = {
  query: <T>(query: string, options?: {variables?: Record<string, unknown>}) => Promise<T>;
};

export function fromFields(fields: Fields, which: 'draft' | 'published'): Stored | null {
  const find = (key: string) => fields.find((f) => f.key === key)?.value ?? null;

  const json = find(which);
  if (!json) return null;

  const layout = decode(json);
  if (!layout) return null;

  const version = Number(find('version'));
  return {version: Number.isInteger(version) ? version : layout.version, layout};
}

export const THEME_QUERY = `#graphql
  query UnigridTheme {
    metaobject(handle: {type: "unigrid_theme", handle: "default"}) {
      fields { key value }
    }
  }
` as const;

// a missing or half-filled theme falls back per slot, so the page still renders
export function paletteFrom(fields: Fields | null | undefined): Palette {
  const out = {...DEFAULT_PALETTE};
  for (const slot of SLOTS) {
    const hex = fields?.find((f) => f.key === `c${slot}`)?.value;
    if (hex) out[slot] = hex;
  }
  return out;
}

export async function loadPalette(storefront: Queryable): Promise<Palette> {
  const data = await storefront.query<{metaobject?: {fields: Fields} | null}>(
    THEME_QUERY,
  );
  return paletteFrom(data?.metaobject?.fields);
}

// one request for the whole page: header, body, footer and the theme. four
// round trips to render one page would be three too many.
export const COMPOSITION_QUERY = `#graphql
  query UnigridComposition($body: String!) {
    header: metaobject(handle: {type: "unigrid_layout", handle: "header"}) {
      fields { key value }
    }
    body: metaobject(handle: {type: "unigrid_layout", handle: $body}) {
      fields { key value }
    }
    footer: metaobject(handle: {type: "unigrid_layout", handle: "footer"}) {
      fields { key value }
    }
    theme: metaobject(handle: {type: "unigrid_theme", handle: "default"}) {
      fields { key value }
    }
  }
` as const;

export type Composition = {
  header: Layout | null;
  body: Layout | null;
  footer: Layout | null;
  palette: Palette;
  menus: Menus;
  // only the ones a layout pinned. the route's own product is not a reference
  // to resolve — it is already here.
  products: Products;
  collections: Collections;
};

export const MENU_QUERY = `#graphql
  query UnigridMenu($handle: String!) {
    menu(handle: $handle) {
      items {
        id
        title
        url
      }
    }
  }
` as const;

type RawItem = {id: string; title: string; url?: string | null};

// one query per referenced handle rather than one aliased query for all of
// them: a header and a footer reference one menu each, and each caches alone.
async function loadMenus(
  storefront: Queryable,
  layouts: (Layout | null)[],
  domains: readonly string[],
): Promise<Menus> {
  const handles = [...new Set(layouts.flatMap((l) => (l ? menuHandles(l) : [])))];
  if (!handles.length) return {};

  const results = await Promise.all(
    handles.map((handle) =>
      storefront.query<{menu?: {items: RawItem[]} | null}>(MENU_QUERY, {
        variables: {handle},
      }),
    ),
  );

  const out: Menus = {};
  handles.forEach((handle, i) => {
    const items = results[i]?.menu?.items;
    if (!items) return;
    out[handle] = items.reduce<MenuLink[]>((acc, item) => {
      if (item.url) acc.push({id: item.id, title: item.title, url: menuPath(item.url, domains)});
      return acc;
    }, []);
  });
  return out;
}

export const PRODUCT_REF_QUERY = `#graphql
  query UnigridProduct($handle: String!) {
    product(handle: $handle) {
      handle
      title
      priceRange { minVariantPrice { amount currencyCode } }
      images(first: 10) { nodes { id url altText } }
    }
  }
` as const;

type RawProduct = {
  handle: string;
  title: string;
  priceRange?: {minVariantPrice?: {amount: string; currencyCode: string}};
  images?: {nodes: {id: string; url: string; altText?: string | null}[]};
};

// formatted here rather than in blocks/, which holds no currency logic and
// cannot import <Money>
export const money = (m?: {
  amount: string;
  currencyCode: string;
}): string | undefined => {
  if (!m) return undefined;
  const amount = Number(m.amount);
  if (!Number.isFinite(amount)) return undefined;
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency: m.currencyCode,
  }).format(amount);
};

export const productData = (p: RawProduct): ProductData => ({
  handle: p.handle,
  title: p.title,
  price: money(p.priceRange?.minVariantPrice),
  images: (p.images?.nodes ?? []).map((i) => ({
    id: i.id,
    url: i.url,
    ...(i.altText ? {alt: i.altText} : {}),
  })),
});

type RawCollection = {
  handle: string;
  title: string;
  products?: {nodes: RawProduct[]};
};

export const collectionData = (c: RawCollection): CollectionData => ({
  handle: c.handle,
  title: c.title,
  products: (c.products?.nodes ?? []).map(productData),
});

// one query per pinned handle, for the same reason menus take one each: a
// featured product on the homepage caches separately from the layout.
async function loadProducts(
  storefront: Queryable,
  layouts: (Layout | null)[],
): Promise<Products> {
  const handles = [...new Set(layouts.flatMap((l) => (l ? productHandles(l) : [])))];
  if (!handles.length) return {};

  const results = await Promise.all(
    handles.map((handle) =>
      storefront.query<{product?: RawProduct | null}>(PRODUCT_REF_QUERY, {
        variables: {handle},
      }),
    ),
  );

  const out: Products = {};
  for (const result of results) {
    const product = result?.product;
    if (product) out[product.handle] = productData(product);
  }
  return out;
}

export const COLLECTION_REF_QUERY = `#graphql
  query UnigridCollection($handle: String!, $first: Int!) {
    collection(handle: $handle) {
      handle
      title
      products(first: $first) {
        nodes {
          handle
          title
          priceRange { minVariantPrice { amount currencyCode } }
          images(first: 1) { nodes { id url altText } }
        }
      }
    }
  }
` as const;

// a pinned collection is fetched at the size the element asks for, so nothing
// is dropped on the way in. the route's own collection is paged instead.
async function loadCollections(
  storefront: Queryable,
  layouts: (Layout | null)[],
): Promise<Collections> {
  const wanted: Record<string, number> = {};
  for (const layout of layouts) {
    if (!layout) continue;
    for (const [handle, count] of Object.entries(collectionCounts(layout))) {
      wanted[handle] = Math.max(wanted[handle] ?? 0, count);
    }
  }
  const handles = Object.keys(wanted);
  if (!handles.length) return {};

  const results = await Promise.all(
    handles.map((handle) =>
      storefront.query<{collection?: RawCollection | null}>(COLLECTION_REF_QUERY, {
        variables: {handle, first: wanted[handle]},
      }),
    ),
  );

  const out: Collections = {};
  for (const result of results) {
    const collection = result?.collection;
    if (collection) out[collection.handle] = collectionData(collection);
  }
  return out;
}

const layoutFrom = (
  region: {fields: Fields} | null | undefined,
  which: 'draft' | 'published',
): Layout | null => {
  const stored = region ? fromFields(region.fields, which) : null;
  // an empty region is the same as no region — nothing to render, no wrapper
  return stored && stored.layout.blocks.length ? stored.layout : null;
};

export async function loadComposition(
  storefront: Queryable,
  target: string,
  which: 'draft' | 'published' = 'published',
  domains: readonly string[] = [],
): Promise<Composition> {
  const data = await storefront.query<{
    header?: {fields: Fields} | null;
    body?: {fields: Fields} | null;
    footer?: {fields: Fields} | null;
    theme?: {fields: Fields} | null;
  }>(COMPOSITION_QUERY, {variables: {body: handleFor(target)}});

  const header = layoutFrom(data?.header, which);
  const body = layoutFrom(data?.body, which);
  const footer = layoutFrom(data?.footer, which);

  const regions = [header, body, footer];
  const [menus, products, collections] = await Promise.all([
    loadMenus(storefront, regions, domains),
    loadProducts(storefront, regions),
    loadCollections(storefront, regions),
  ]);

  return {
    header,
    body,
    footer,
    palette: paletteFrom(data?.theme?.fields),
    menus,
    products,
    collections,
  };
}

export async function loadLayout(
  storefront: Queryable,
  target: string,
  which: 'draft' | 'published' = 'published',
): Promise<Stored | null> {
  const data = await storefront.query<{metaobject?: {fields: Fields} | null}>(
    LAYOUT_QUERY,
    {variables: {handle: handleFor(target)}},
  );

  const fields = data?.metaobject?.fields;
  return fields ? fromFields(fields, which) : null;
}
