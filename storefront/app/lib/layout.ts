import {DEFAULT_PALETTE, SLOTS, decode, type Layout, type Palette} from '@unigrid/core';

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
};

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
): Promise<Composition> {
  const data = await storefront.query<{
    header?: {fields: Fields} | null;
    body?: {fields: Fields} | null;
    footer?: {fields: Fields} | null;
    theme?: {fields: Fields} | null;
  }>(COMPOSITION_QUERY, {variables: {body: handleFor(target)}});

  return {
    header: layoutFrom(data?.header, which),
    body: layoutFrom(data?.body, which),
    footer: layoutFrom(data?.footer, which),
    palette: paletteFrom(data?.theme?.fields),
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
