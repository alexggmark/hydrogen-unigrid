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

export async function loadLayout(
  storefront: Queryable,
  handle: string,
  which: 'draft' | 'published' = 'published',
): Promise<Stored | null> {
  const data = await storefront.query<{metaobject?: {fields: Fields} | null}>(
    LAYOUT_QUERY,
    {variables: {handle}},
  );

  const fields = data?.metaobject?.fields;
  return fields ? fromFields(fields, which) : null;
}
