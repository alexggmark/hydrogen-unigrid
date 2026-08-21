import {decode, encode, type Layout} from '@unigrid/core';

// the metaobject's field shape stops here, exactly as it does on the storefront

const READ = `#graphql
  query AdminLayout($handle: String!) {
    metaobjectByHandle(handle: {type: "unigrid_layout", handle: $handle}) {
      id
      fields { key value }
    }
  }
`;

const WRITE = `#graphql
  mutation SaveDraft($id: ID!, $fields: [MetaobjectFieldInput!]!) {
    metaobjectUpdate(id: $id, metaobject: {fields: $fields}) {
      userErrors { field message }
    }
  }
`;

// structural, so this module stays free of the app framework's types
type Admin = {
  graphql: (
    query: string,
    options?: {variables?: Record<string, unknown>},
  ) => Promise<{json: () => Promise<unknown>}>;
};
type Fields = {key: string; value?: string | null}[];

async function read(admin: Admin, handle: string) {
  const response = await admin.graphql(READ, {variables: {handle}});
  const body = (await response.json()) as {
    data?: {metaobjectByHandle?: {id: string; fields: Fields} | null};
  };
  return body.data?.metaobjectByHandle ?? null;
}

export async function loadDraft(admin: Admin, handle: string) {
  const entry = await read(admin, handle);
  if (!entry) return null;
  const json = entry.fields.find((f) => f.key === 'draft')?.value ?? null;
  const layout = json ? decode(json) : null;
  return layout ? {id: entry.id, layout} : null;
}

// framework-free on purpose: the action is a thin call into this
export async function saveDraft(
  admin: Admin,
  handle: string,
  layout: Layout,
): Promise<{ok: true} | {ok: false; message: string}> {
  const entry = await read(admin, handle);
  if (!entry) return {ok: false, message: `no layout entry for "${handle}"`};

  const response = await admin.graphql(WRITE, {
    variables: {id: entry.id, fields: [{key: 'draft', value: encode(layout)}]},
  });
  const body = (await response.json()) as {
    data?: {metaobjectUpdate?: {userErrors: {message: string}[]}};
  };

  const errors = body.data?.metaobjectUpdate?.userErrors ?? [];
  return errors.length ? {ok: false, message: errors[0]?.message ?? 'save failed'} : {ok: true};
}
