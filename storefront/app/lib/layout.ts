import {decode, type Layout} from '@unigrid/core';

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

export function fromFields(fields: Fields, which: 'draft' | 'published'): Stored | null {
  const find = (key: string) => fields.find((f) => f.key === key)?.value ?? null;

  const json = find(which);
  if (!json) return null;

  const layout = decode(json);
  if (!layout) return null;

  const version = Number(find('version'));
  return {version: Number.isInteger(version) ? version : layout.version, layout};
}

type Queryable = {
  query: <T>(query: string, options?: {variables?: Record<string, unknown>}) => Promise<T>;
};

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
