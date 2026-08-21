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

const field = (fields: Fields, key: string) =>
  fields.find((f) => f.key === key)?.value ?? null;

export type Result = {ok: true} | {ok: false; message: string};

async function write(admin: Admin, id: string, fields: Fields): Promise<Result> {
  const response = await admin.graphql(WRITE, {variables: {id, fields}});
  const body = (await response.json()) as {
    data?: {metaobjectUpdate?: {userErrors: {message: string}[]}};
  };
  const errors = body.data?.metaobjectUpdate?.userErrors ?? [];
  return errors.length
    ? {ok: false, message: errors[0]?.message ?? 'write failed'}
    : {ok: true};
}

export async function loadDraft(admin: Admin, handle: string) {
  const entry = await read(admin, handle);
  if (!entry) return null;

  // fall back to published, so a page that has only ever been published is
  // still editable rather than opening empty
  const json = field(entry.fields, 'draft') ?? field(entry.fields, 'published');
  const layout = json ? decode(json) : null;
  if (!layout) return null;

  const published = field(entry.fields, 'published');
  return {
    id: entry.id,
    layout,
    version: Number(field(entry.fields, 'version')) || 1,
    // the editor cannot know this by comparing to its own state, since the
    // draft it holds is whatever was last saved, not what is live
    unpublished: field(entry.fields, 'draft') !== published,
  };
}

// framework-free on purpose: the action is a thin call into this
export async function saveDraft(
  admin: Admin,
  handle: string,
  layout: Layout,
): Promise<Result> {
  const entry = await read(admin, handle);
  if (!entry) return {ok: false, message: `no layout entry for "${handle}"`};

  return write(admin, entry.id, [{key: 'draft', value: encode(layout)}]);
}

// reads the draft back from the store, so an unsaved edit cannot go live
export async function publish(admin: Admin, handle: string): Promise<Result> {
  const entry = await read(admin, handle);
  if (!entry) return {ok: false, message: `no layout entry for "${handle}"`};

  const draft = field(entry.fields, 'draft');
  if (!draft) return {ok: false, message: 'nothing to publish — save a draft first'};
  if (!decode(draft)) return {ok: false, message: 'the draft is unreadable, refusing to publish'};

  const version = (Number(field(entry.fields, 'version')) || 0) + 1;
  return write(admin, entry.id, [
    {key: 'published', value: draft},
    {key: 'version', value: String(version)},
  ]);
}
