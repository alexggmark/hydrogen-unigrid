import {useCallback} from 'react';
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LinksFunction,
  LoaderFunctionArgs,
} from 'react-router';
import {useFetcher, useLoaderData, useNavigate, useRouteError} from 'react-router';
import {boundary} from '@shopify/shopify-app-react-router/server';
import {Editor} from '@unigrid/editor';
import {
  DEFAULT_PALETTE,
  decode,
  encode,
  mediaIds,
  type Layout,
  type Palette,
} from '@unigrid/core';
import radixStyles from '@radix-ui/themes/styles.css?url';
import unigridStyles from '@unigrid/blocks/unigrid.css?url';
import editorStyles from '@unigrid/editor/editor.css?url';
import {authenticate} from '../shopify.server';
import {
  createLayout,
  createPage,
  listCollections,
  listPages,
  listProducts,
  loadComposition,
  loadMenus,
  loadPalette,
  resolveMedia,
  publishAll,
  saveDraft,
  savePalette,
  type PageRow,
  type StoreMenu,
} from '../lib/layout.server';
import type {CollectionData, MediaUrls, ProductData} from '@unigrid/blocks';

export const links: LinksFunction = () => [
  {rel: 'stylesheet', href: radixStyles},
  {rel: 'stylesheet', href: unigridStyles},
  {rel: 'stylesheet', href: editorStyles},
];

// the target is editor state, so it lives in the url beside band and selection
const targetOf = (request: Request) =>
  new URL(request.url).searchParams.get('target') || 'home';

export const loader = async ({request}: LoaderFunctionArgs) => {
  const {admin} = await authenticate.admin(request);
  const target = targetOf(request);
  // shared regions have no page of their own. showing them against the homepage
  // avoids a second region with the same target, which collapses to one.
  const bodyTarget = target === 'header' || target === 'footer' ? 'home' : target;

  const [regions, palette, pages, menus, products, collections] = await Promise.all([
    loadComposition(admin, bodyTarget),
    loadPalette(admin),
    listPages(admin),
    loadMenus(admin),
    listProducts(admin),
    listCollections(admin),
  ]);
  const empty: Layout = {version: 1, blocks: []};
  const label = pages.find((p) => p.target === bodyTarget)?.title ?? 'Page';

  // after the layouts, because which files to resolve is authored in them
  const ids = [
    ...new Set(
      [regions.header, regions.body, regions.footer].flatMap((r) =>
        r ? mediaIds(r.layout) : [],
      ),
    ),
  ];
  const media: MediaUrls = Object.fromEntries(
    (await resolveMedia(admin, ids)).map((m) => [m.id, m.url]),
  );

  return {
    target,
    pages,
    palette,
    menus,
    products,
    collections,
    media,
    regions: [
      {target: 'header', label: 'Header', layout: regions.header?.layout ?? empty},
      {target: bodyTarget, label, layout: regions.body?.layout ?? empty},
      {target: 'footer', label: 'Footer', layout: regions.footer?.layout ?? empty},
    ],
    version: regions.body?.version ?? 0,
    // any region, not just the body — a saved header is unpublished work too
    unpublished: [regions.header, regions.body, regions.footer].some(
      (r) => r?.unpublished,
    ),
  };
};

export const action = async ({request}: ActionFunctionArgs) => {
  const {admin} = await authenticate.admin(request);
  const form = await request.formData();
  const target = String(form.get('target') || targetOf(request));
  const intent = form.get('intent');

  if (intent === 'publish') {
    const body = target === 'header' || target === 'footer' ? 'home' : target;
    return publishAll(admin, ['header', body, 'footer']);
  }
  if (intent === 'newPage') return createPage(admin, String(form.get('title') || 'Untitled'));
  if (intent === 'attach') return createLayout(admin, target);

  const theme = form.get('palette');
  if (typeof theme === 'string') {
    return savePalette(admin, JSON.parse(theme) as Palette);
  }

  // one submit carries every region that changed, so switching region cannot
  // strand an edit in a tab nobody saved
  const changed = JSON.parse(String(form.get('changed') ?? '[]')) as {
    target: string;
    layout: string;
  }[];

  for (const region of changed) {
    const layout = decode(region.layout);
    if (!layout) return {ok: false, message: `could not read ${region.target}`};
    const result = await saveDraft(admin, region.target, layout);
    if (!result.ok) return result;
  }
  return {ok: true};
};

export default function Index() {
  const {
    regions,
    version,
    unpublished,
    palette,
    pages,
    menus,
    products,
    collections,
    media,
    target,
  } = useLoaderData<typeof loader>() as {
      regions: {target: string; label: string; layout: Layout}[];
      version: number;
      unpublished: boolean;
      palette: Palette;
      pages: PageRow[];
      menus: StoreMenu[];
      products: ProductData[];
      collections: CollectionData[];
      media: MediaUrls;
      target: string;
    };
  const fetcher = useFetcher<typeof action>();
  const navigate = useNavigate();

  const onSave = useCallback(
    (changed: {target: string; layout: Layout}[]) =>
      fetcher.submit(
        {
          changed: JSON.stringify(
            changed.map((c) => ({target: c.target, layout: encode(c.layout)})),
          ),
          target,
        },
        {method: 'post'},
      ),
    [fetcher, target],
  );

  const onPages = useCallback(
    (intent: string, fields: Record<string, string> = {}) =>
      fetcher.submit({intent, target, ...fields}, {method: 'post'}),
    [fetcher, target],
  );

  const onSavePalette = useCallback(
    (next: Palette) => fetcher.submit({palette: JSON.stringify(next)}, {method: 'post'}),
    [fetcher],
  );

  // app bridge's own file browser, so there is no picker of ours to build. it
  // returns ids, so the url comes back from our own resource route.
  const pickMedia = useCallback(async () => {
    const activity = await shopify.intents.invoke('pick:shopify/File', {
      data: {mediaTypes: ['MediaImage', 'Video'], multiSelect: false},
    });
    const response = await activity.complete;
    // closed is the merchant cancelling, which is not a failure
    if (!response || response.code !== 'ok') return null;
    const [id] = response.data?.ids ?? [];
    if (!id) return null;
    const found = await fetch(`/app/media?id=${encodeURIComponent(id)}`);
    const {media: resolved} = (await found.json()) as {
      media: {id: string; url: string; kind: 'image' | 'video'}[];
    };
    return resolved[0] ?? null;
  }, []);

  const onPublish = useCallback(
    () => fetcher.submit({intent: 'publish'}, {method: 'post'}),
    [fetcher],
  );

  const result = fetcher.data;

  return (
    <Editor
      key={target}
      initial={regions[1]?.layout ?? {version: 1, blocks: []}}
      regions={regions}
      activeTarget={target}
      pages={pages}
      target={target}
      onPages={onPages}
      onOpen={(next) => navigate(`?target=${encodeURIComponent(next)}`)}
      onSave={onSave}
      onPublish={onPublish}
      initialPalette={palette ?? DEFAULT_PALETTE}
      menus={menus}
      products={products}
      collections={collections}
      media={media}
      pickMedia={pickMedia}
      onSavePalette={onSavePalette}
      busy={fetcher.state !== 'idle'}
      version={version}
      unpublished={unpublished}
      error={result && !result.ok ? result.message : undefined}
    />
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
