import {
  menuPath,
  type CollectionData,
  type MenuLink,
  type ProductData,
} from '@unigrid/blocks';
import {
  DEFAULT_PALETTE,
  metricsDiff,
  metricsFrom,
  settingsFrom,
  SLOTS,
  decode,
  emptyLayout,
  encode,
  type Layout,
  type Metrics,
  type Palette,
  type Settings,
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
// metaobject handles cannot contain a colon, so `page:about` is stored as
// `page-about`. the target stays the name everything else uses.
const handleFor = (target: string) => target.replace(/:/g, '-');

type Fields = {key: string; value?: string | null}[];

async function read(admin: Admin, target: string) {
  const response = await admin.graphql(READ, {
    variables: {handle: handleFor(target)},
  });
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

// every region the editor shows at once: the two shared ones plus the target
export async function loadComposition(admin: Admin, target: string) {
  const [header, body, footer] = await Promise.all([
    loadDraft(admin, 'header'),
    loadDraft(admin, target),
    loadDraft(admin, 'footer'),
  ]);
  return {header, body, footer};
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

// promotes every region of the page: a header saved but not promoted would go
// live nowhere, with nothing on screen to say so
export async function publishAll(
  admin: Admin,
  targets: string[],
): Promise<Result> {
  for (const target of targets) {
    const entry = await read(admin, target);
    if (!entry) continue;

    const draft = field(entry.fields, 'draft');
    // already live, or never written: not a failure, just nothing to do
    if (!draft || draft === field(entry.fields, 'published')) continue;

    const result = await publish(admin, target);
    if (!result.ok) return result;
  }
  return {ok: true};
}

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

// every measurement in one json field: a knob added later then needs no change
// to the metaobject definition, and an older entry falls back per key.
export async function loadMetrics(admin: Admin): Promise<Metrics> {
  const response = await admin.graphql(THEME_READ);
  const body = (await response.json()) as {
    data?: {metaobjectByHandle?: {fields: Fields} | null};
  };
  const raw = body.data?.metaobjectByHandle?.fields?.find(
    (f) => f.key === 'metrics',
  )?.value;
  if (!raw) return metricsFrom(undefined);
  try {
    return metricsFrom(JSON.parse(raw));
  } catch {
    return metricsFrom(undefined);
  }
}

export async function loadSettings(admin: Admin): Promise<Settings> {
  const response = await admin.graphql(THEME_READ);
  const body = (await response.json()) as {
    data?: {metaobjectByHandle?: {fields: Fields} | null};
  };
  const raw = body.data?.metaobjectByHandle?.fields?.find(
    (f) => f.key === 'settings',
  )?.value;
  if (!raw) return {};
  try {
    return settingsFrom(JSON.parse(raw));
  } catch {
    return {};
  }
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

export async function saveTheme(
  admin: Admin,
  palette: Palette,
  metrics: Metrics,
  settings: Settings,
): Promise<Result> {
  const response = await admin.graphql(THEME_READ);
  const body = (await response.json()) as {
    data?: {metaobjectByHandle?: {id: string} | null};
  };
  const id = body.data?.metaobjectByHandle?.id;
  if (!id) return {ok: false, message: 'no theme entry found'};

  // only what differs from the default is stored, so a theme nobody has touched
  // is an empty object rather than a copy of the stylesheet
  return write(admin, id, [
    ...SLOTS.map((slot) => ({key: `c${slot}`, value: palette[slot]})),
    {key: 'metrics', value: JSON.stringify(metricsDiff(metrics))},
    {key: 'settings', value: JSON.stringify(settings)},
  ]);
}

const MENUS = `#graphql
  query AdminMenus($first: Int!) {
    menus(first: $first) {
      nodes {
        id
        handle
        title
        items { id title url }
      }
    }
  }
`;

const SHOP_DOMAIN = `#graphql
  query AdminShopDomain {
    shop { primaryDomain { host } myshopifyDomain }
  }
`;

export type StoreMenu = {handle: string; title: string; items: MenuLink[]};

// every menu, not just the referenced ones: the rail offers them as a picker,
// so a merchant chooses from what exists rather than typing a handle.
export async function loadMenus(admin: Admin): Promise<StoreMenu[]> {
  const [menusRes, shopRes] = await Promise.all([
    admin.graphql(MENUS, {variables: {first: 50}}),
    admin.graphql(SHOP_DOMAIN),
  ]);

  const nodes = ((await menusRes.json()) as {
    data?: {
      menus?: {
        nodes: {
          handle: string;
          title: string;
          items: {id: string; title: string; url?: string | null}[];
        }[];
      };
    };
  }).data?.menus?.nodes ?? [];

  const shop = ((await shopRes.json()) as {
    data?: {shop?: {primaryDomain?: {host: string}; myshopifyDomain?: string}};
  }).data?.shop;
  const domains = [shop?.primaryDomain?.host, shop?.myshopifyDomain].filter(
    (d): d is string => Boolean(d),
  );

  return nodes.map((menu) => ({
    handle: menu.handle,
    title: menu.title,
    items: menu.items.reduce<MenuLink[]>((acc, item) => {
      if (item.url) {
        acc.push({id: item.id, title: item.title, url: menuPath(item.url, domains)});
      }
      return acc;
    }, []),
  }));
}

const PRODUCTS = `#graphql
  query AdminProducts($first: Int!) {
    products(first: $first, sortKey: TITLE) {
      nodes {
        handle
        title
        priceRangeV2 { minVariantPrice { amount currencyCode } }
        images(first: 10) { nodes { id url altText } }
      }
    }
  }
`;

// the whole catalogue is not the point — the rail needs a picker, and one
// product hydrates the template so it can be seen against something real.
export async function listProducts(admin: Admin): Promise<ProductData[]> {
  const response = await admin.graphql(PRODUCTS, {variables: {first: 50}});
  const nodes = ((await response.json()) as {
    data?: {
      products?: {
        nodes: {
          handle: string;
          title: string;
          priceRangeV2?: {minVariantPrice?: {amount: string; currencyCode: string}};
          images?: {nodes: {id: string; url: string; altText?: string | null}[]};
        }[];
      };
    };
  }).data?.products?.nodes ?? [];

  return nodes.map((p) => ({
    handle: p.handle,
    title: p.title,
    price: money(p.priceRangeV2?.minVariantPrice),
    images: (p.images?.nodes ?? []).map((i) => ({
      id: i.id,
      url: i.url,
      ...(i.altText ? {alt: i.altText} : {}),
    })),
  }));
}

const COLLECTIONS = `#graphql
  query AdminCollections($first: Int!, $items: Int!) {
    collections(first: $first, sortKey: TITLE) {
      nodes {
        handle
        title
        products(first: $items) {
          nodes {
            handle
            title
            priceRangeV2 { minVariantPrice { amount currencyCode } }
            images(first: 1) { nodes { id url altText } }
          }
        }
      }
    }
  }
`;

// nested connections multiply, so the numbers are deliberately small: this is a
// picker and a preview, not the catalogue. an element asking for more rows than
// this renders what it got.
export async function listCollections(admin: Admin): Promise<CollectionData[]> {
  const response = await admin.graphql(COLLECTIONS, {
    variables: {first: 30, items: 12},
  });
  const nodes = ((await response.json()) as {
    data?: {
      collections?: {
        nodes: {
          handle: string;
          title: string;
          products?: {
            nodes: {
              handle: string;
              title: string;
              priceRangeV2?: {minVariantPrice?: {amount: string; currencyCode: string}};
              images?: {nodes: {id: string; url: string; altText?: string | null}[]};
            }[];
          };
        }[];
      };
    };
  }).data?.collections?.nodes ?? [];

  return nodes.map((c) => ({
    handle: c.handle,
    title: c.title,
    products: (c.products?.nodes ?? []).map((p) => ({
      handle: p.handle,
      title: p.title,
      price: money(p.priceRangeV2?.minVariantPrice),
      images: (p.images?.nodes ?? []).map((i) => ({
        id: i.id,
        url: i.url,
        ...(i.altText ? {alt: i.altText} : {}),
      })),
    })),
  }));
}

const MEDIA = `#graphql
  query AdminMedia($ids: [ID!]!) {
    nodes(ids: $ids) {
      id
      __typename
      ... on MediaImage { image { url } }
        ... on Video { sources { url height } }
    }
  }
`;

export type ResolvedMedia = {id: string; url: string; kind: 'image' | 'video'};

// the file picker hands back ids, so both the editor's preview and the loader
// need the same lookup. the layout stores the id and never the cdn path.
export async function resolveMedia(
  admin: Admin,
  ids: string[],
): Promise<ResolvedMedia[]> {
  if (!ids.length) return [];
  const response = await admin.graphql(MEDIA, {variables: {ids}});
  const nodes = ((await response.json()) as {
    data?: {
      nodes?: ({
        id: string;
        __typename: string;
        image?: {url: string} | null;
        sources?: {url: string; height?: number}[] | null;
      } | null)[];
    };
  }).data?.nodes ?? [];

  const best = (sources: {url: string; height?: number}[]) =>
    [...sources].sort((a, b) => (b.height ?? 0) - (a.height ?? 0))[0]?.url;

  const out: ResolvedMedia[] = [];
  for (const node of nodes) {
    if (!node) continue;
    const url = node.image?.url ?? best(node.sources ?? []);
    if (url) {
      out.push({id: node.id, url, kind: node.__typename === 'Video' ? 'video' : 'image'});
    }
  }
  return out;
}

// formatted here, because blocks/ holds no currency logic and <Money> is
// hydrogen's, which the admin app cannot import
const money = (m?: {amount: string; currencyCode: string}): string | undefined => {
  if (!m) return undefined;
  const amount = Number(m.amount);
  if (!Number.isFinite(amount)) return undefined;
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency: m.currencyCode,
  }).format(amount);
};

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

// header and footer are layouts like any other, they just are not pages. fixed
// rows so they are always reachable, and never candidates for reconciliation.
export const REGIONS = [
  {target: 'header', title: 'Header'},
  {target: 'footer', title: 'Footer'},
] as const;

// one layout renders the whole catalogue, so the templates are fixed rows too —
// there is nothing per-product or per-collection for a merchant to create
export const TEMPLATES = [
  {target: 'product', title: 'Product template'},
  {target: 'collection', title: 'Collection template'},
] as const;

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

  // a deleted page takes its layout with it. only when the page list is
  // complete: a truncated one would read as deletions and destroy real work.
  if (pageData && !pageData.pageInfo.hasNextPage) {
    const live = new Set(pages.map((x) => `page:${x.handle}`));
    for (const [target, id] of byTarget) {
      if (!target.startsWith('page:') || live.has(target)) continue;
      await deleteLayout(admin, id);
      byTarget.delete(target);
    }
  }

  return [
    ...REGIONS.map((r) => ({
      target: r.target as string,
      title: r.title as string,
      handle: '',
      hasLayout: byTarget.has(r.target),
      ...(byTarget.get(r.target) ? {layoutId: byTarget.get(r.target)!} : {}),
    })),
    ...TEMPLATES.map((t) => ({
      target: t.target as string,
      title: t.title as string,
      handle: '',
      hasLayout: byTarget.has(t.target),
      ...(byTarget.get(t.target) ? {layoutId: byTarget.get(t.target)!} : {}),
    })),
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
        handle: handleFor(target),
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
