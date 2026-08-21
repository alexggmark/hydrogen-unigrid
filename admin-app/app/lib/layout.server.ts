import {
  DEFAULT_PALETTE,
  SLOTS,
  decode,
  emptyLayout,
  encode,
  type Layout,
  type Palette,
} from '@unigrid/core';

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

const THEME_READ = `#graphql
  query AdminTheme {
    metaobjectByHandle(handle: {type: "unigrid_theme", handle: "default"}) {
      id
      fields { key value }
    }
  }
`;

export async function loadPalette(admin: Admin): Promise<Palette> {
  const response = await admin.graphql(THEME_READ);
  const body = (await response.json()) as {
    data?: {metaobjectByHandle?: {id: string; fields: Fields} | null};
  };
  const fields = body.data?.metaobjectByHandle?.fields;

  const out = {...DEFAULT_PALETTE};
  for (const slot of SLOTS) {
    const hex = fields?.find((f) => f.key === `c${slot}`)?.value;
    if (hex) out[slot] = hex;
  }
  return out;
}

// the theme has no draft. it is referenced by every layout, so a half-applied
// palette would be visible everywhere at once — saving is publishing.
export async function savePalette(admin: Admin, palette: Palette): Promise<Result> {
  const response = await admin.graphql(THEME_READ);
  const body = (await response.json()) as {
    data?: {metaobjectByHandle?: {id: string} | null};
  };
  const id = body.data?.metaobjectByHandle?.id;
  if (!id) return {ok: false, message: 'no theme entry found'};

  return write(
    admin,
    id,
    SLOTS.map((slot) => ({key: `c${slot}`, value: palette[slot]})),
  );
}

const PAGES = `#graphql
  query AdminPages($first: Int!) {
    pages(first: $first) {
      nodes { id handle title }
      pageInfo { hasNextPage }
    }
  }
`;

const LAYOUTS = `#graphql
  query AdminLayouts($first: Int!) {
    metaobjects(type: "unigrid_layout", first: $first) {
      nodes { id handle fields { key value } }
    }
  }
`;

const PAGE_CREATE = `#graphql
  mutation NewPage($page: PageCreateInput!) {
    pageCreate(page: $page) { page { handle } userErrors { field message } }
  }
`;

const LAYOUT_CREATE = `#graphql
  mutation NewLayout($m: MetaobjectCreateInput!) {
    metaobjectCreate(metaobject: $m) {
      metaobject { handle }
      userErrors { field message }
    }
  }
`;

const LAYOUT_DELETE = `#graphql
  mutation DropLayout($id: ID!) {
    metaobjectDelete(id: $id) { deletedId userErrors { field message } }
  }
`;

export type PageRow = {
  target: string;
  title: string;
  handle: string;
  hasLayout: boolean;
  layoutId?: string;
};

export async function listPages(admin: Admin): Promise<PageRow[]> {
  const [pagesRes, layoutsRes] = await Promise.all([
    admin.graphql(PAGES, {variables: {first: 250}}),
    admin.graphql(LAYOUTS, {variables: {first: 250}}),
  ]);

  const pageData = ((await pagesRes.json()) as {
    data?: {
      pages?: {nodes: {handle: string; title: string}[]; pageInfo: {hasNextPage: boolean}};
    };
  }).data?.pages;
  const pages = pageData?.nodes ?? [];

  const layouts = ((await layoutsRes.json()) as {
    data?: {metaobjects?: {nodes: {id: string; fields: Fields}[]}};
  }).data?.metaobjects?.nodes ?? [];

  const byTarget = new Map(
    layouts.map((l) => [field(l.fields, 'target') ?? '', l.id]),
  );

  // a page deleted in Shopify takes its layout with it. done on read rather than
  // by webhook, because a webhook needs a host and there is not one yet.
  //
  // only when the page list is known to be complete: a truncated list would
  // read as "these pages no longer exist" and delete real work.
  if (pageData && !pageData.pageInfo.hasNextPage) {
    const live = new Set(pages.map((x) => `page:${x.handle}`));
    for (const [target, id] of byTarget) {
      if (!target.startsWith('page:') || live.has(target)) continue;
      await deleteLayout(admin, id);
      byTarget.delete(target);
    }
  }

  return [
    {
      target: 'home',
      title: 'Home',
      handle: '',
      hasLayout: byTarget.has('home'),
      ...(byTarget.get('home') ? {layoutId: byTarget.get('home')!} : {}),
    },
    ...pages.map((x) => ({
      target: `page:${x.handle}`,
      title: x.title,
      handle: x.handle,
      hasLayout: byTarget.has(`page:${x.handle}`),
      ...(byTarget.get(`page:${x.handle}`)
        ? {layoutId: byTarget.get(`page:${x.handle}`)!}
        : {}),
    })),
  ];
}

export async function createPage(
  admin: Admin,
  title: string,
): Promise<Result & {handle?: string}> {
  const res = await admin.graphql(PAGE_CREATE, {variables: {page: {title}}});
  const body = (await res.json()) as {
    data?: {pageCreate?: {page?: {handle: string}; userErrors: {message: string}[]}};
  };
  const errors = body.data?.pageCreate?.userErrors ?? [];
  const handle = body.data?.pageCreate?.page?.handle;
  if (errors.length || !handle) {
    return {ok: false, message: errors[0]?.message ?? 'could not create the page'};
  }

  const made = await createLayout(admin, `page:${handle}`);
  return made.ok ? {ok: true, handle} : made;
}

export async function createLayout(admin: Admin, target: string): Promise<Result> {
  const res = await admin.graphql(LAYOUT_CREATE, {
    variables: {
      m: {
        type: 'unigrid_layout',
        capabilities: {publishable: {status: 'ACTIVE'}},
        fields: [
          {key: 'target', value: target},
          {key: 'version', value: '1'},
          {key: 'draft', value: encode(emptyLayout())},
          {key: 'published', value: encode(emptyLayout())},
        ],
      },
    },
  });
  const body = (await res.json()) as {
    data?: {metaobjectCreate?: {userErrors: {message: string}[]}};
  };
  const errors = body.data?.metaobjectCreate?.userErrors ?? [];
  return errors.length
    ? {ok: false, message: errors[0]?.message ?? 'could not create the layout'}
    : {ok: true};
}

export async function deleteLayout(admin: Admin, id: string): Promise<Result> {
  const res = await admin.graphql(LAYOUT_DELETE, {variables: {id}});
  const body = (await res.json()) as {
    data?: {metaobjectDelete?: {userErrors: {message: string}[]}};
  };
  const errors = body.data?.metaobjectDelete?.userErrors ?? [];
  return errors.length
    ? {ok: false, message: errors[0]?.message ?? 'could not delete the layout'}
    : {ok: true};
}
