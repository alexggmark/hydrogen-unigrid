import {useCallback} from 'react';
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LinksFunction,
  LoaderFunctionArgs,
} from 'react-router';
import {
  useFetcher,
  useLoaderData,
  useNavigate,
  useRouteError,
} from 'react-router';
import {boundary} from '@shopify/shopify-app-react-router/server';
import {
  Editor,
  downloadSnapshot,
  type AbTest,
  type Snapshot,
} from '@unigrid/editor';
import {
  DEFAULT_METRICS,
  DEFAULT_PALETTE,
  decode,
  encode,
  mediaIds,
  metricsFrom,
  settingsFrom,
  type Layout,
  type Metrics,
  type Palette,
  type Settings,
} from '@unigrid/core';
import radixStyles from '@radix-ui/themes/styles.css?url';
import unigridStyles from '@unigrid/blocks/unigrid.css?url';
import editorStyles from '@unigrid/editor/editor.css?url';
import {authenticate} from '../shopify.server';
import {
  createLayout,
  createPage,
  createTest,
  rollOut,
  setFlag,
  type Arm,
  listCollections,
  listPages,
  listProducts,
  loadComposition,
  loadMenus,
  loadPalette,
  resolveMedia,
  publishAll,
  saveDraft,
  loadMetrics,
  loadSettings,
  saveTheme,
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

// which arm of a test is open. url state for the same reason as the target, so
// a reload or a shared link lands on the arm that was being edited.
const armOf = (value: unknown): Arm => (value === 'b' ? 'b' : 'a');

// header and footer are shared by every page, so they are never tested
const isBody = (target: string) => target !== 'header' && target !== 'footer';

export const loader = async ({request}: LoaderFunctionArgs) => {
  const {admin} = await authenticate.admin(request);
  const target = targetOf(request);
  const arm = armOf(new URL(request.url).searchParams.get('arm'));
  // shared regions have no page of their own. showing them against the homepage
  // avoids a second region with the same target, which collapses to one.
  const bodyTarget =
    target === 'header' || target === 'footer' ? 'home' : target;

  const [
    regions,
    palette,
    pages,
    menus,
    products,
    collections,
    metrics,
    settings,
  ] = await Promise.all([
      loadComposition(admin, bodyTarget, arm),
      loadPalette(admin),
      listPages(admin),
      loadMenus(admin),
      listProducts(admin),
      listCollections(admin),
      loadMetrics(admin),
      loadSettings(admin),
    ]);
  const empty: Layout = {version: 1, blocks: []};
  const label = pages.find((p) => p.target === bodyTarget)?.title ?? 'Page';

  // after the layouts, because which files to resolve is authored in them
  const ids = [
    ...new Set([
      ...[regions.header, regions.body, regions.footer].flatMap((r) =>
        r ? mediaIds(r.layout) : [],
      ),
      ...(settings.logo ? [settings.logo] : []),
    ]),
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
    metrics,
    settings,
    media,
    regions: [
      {
        target: 'header',
        label: 'Header',
        layout: regions.header?.layout ?? empty,
      },
      {target: bodyTarget, label, layout: regions.body?.layout ?? empty},
      {
        target: 'footer',
        label: 'Footer',
        layout: regions.footer?.layout ?? empty,
      },
    ],
    version: regions.body?.version ?? 0,
    // only on a page's own layout. the editor has no test ui without it.
    test:
      isBody(target) && regions.body
        ? {
            ...regions.body.test,
            arm: regions.body.test.hasB ? arm : ('a' as Arm),
          }
        : null,
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
  const arm = armOf(form.get('arm'));

  if (intent === 'publish') {
    const body = target === 'header' || target === 'footer' ? 'home' : target;
    return publishAll(admin, ['header', body, 'footer']);
  }
  if (intent === 'newPage')
    return createPage(admin, String(form.get('title') || 'Untitled'));
  if (intent === 'attach') return createLayout(admin, target);
  if (intent === 'abCreate') return createTest(admin, target);
  if (intent === 'abFlag') return setFlag(admin, target, String(form.get('flag') ?? ''));
  if (intent === 'abRollout') return rollOut(admin, target, arm);

  const theme = form.get('theme');
  if (typeof theme === 'string') {
    const {palette, metrics, settings} = JSON.parse(theme) as {
      palette: Palette;
      metrics: Metrics;
      settings: Settings;
    };
    return saveTheme(
      admin,
      palette,
      metricsFrom(metrics),
      settingsFrom(settings),
    );
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
    // only the page's own layout has arms. header and footer always save to a.
    const result = await saveDraft(
      admin,
      region.target,
      layout,
      isBody(region.target) ? arm : 'a',
    );
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
    metrics,
    settings,
    media,
    target,
    test,
  } = useLoaderData<typeof loader>() as {
    regions: {target: string; label: string; layout: Layout}[];
    version: number;
    unpublished: boolean;
    palette: Palette;
    pages: PageRow[];
    menus: StoreMenu[];
    products: ProductData[];
    collections: CollectionData[];
    metrics: Metrics;
    settings: Settings;
    media: MediaUrls;
    target: string;
    test: AbTest | null;
  };
  const arm = test?.arm ?? 'a';
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
          arm,
        },
        {method: 'post'},
      ),
    [fetcher, target, arm],
  );

  const onPages = useCallback(
    (intent: string, fields: Record<string, string> = {}) =>
      fetcher.submit({intent, target, ...fields}, {method: 'post'}),
    [fetcher, target],
  );

  const onSaveTheme = useCallback(
    (palette: Palette, metrics: Metrics, settings: Settings) =>
      fetcher.submit(
        {theme: JSON.stringify({palette, metrics, settings})},
        {method: 'post'},
      ),
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
    if (!resolved[0]) {
      shopify.toast.show('That file is still processing — try again shortly.', {
        isError: true,
      });
      return null;
    }
    return resolved[0];
  }, []);

  const onTest = useCallback(
    (intent: 'create' | 'arm' | 'flag' | 'rollout', value = '') => {
      if (intent === 'arm') {
        // keeps band and selection, which the editor also holds in the url
        const params = new URLSearchParams(window.location.search);
        if (value === 'b') params.set('arm', 'b');
        else params.delete('arm');
        navigate(`?${params.toString()}`);
        return;
      }
      const name = {create: 'abCreate', flag: 'abFlag', rollout: 'abRollout'}[intent];
      fetcher.submit({intent: name, target, arm, flag: value}, {method: 'post'});
      // the test is gone, so there is no b to stay on
      if (intent === 'rollout') navigate(`?target=${encodeURIComponent(target)}`);
    },
    [fetcher, navigate, target, arm],
  );

  const onPublish = useCallback(
    () => fetcher.submit({intent: 'publish'}, {method: 'post'}),
    [fetcher],
  );

  const result = fetcher.data;

  // temporary: mockups are swapped in by file while layouts are being drafted
  const onExport = useCallback(
    (snapshot: Snapshot) =>
      downloadSnapshot(snapshot, `unigrid-${target.replace(/[^a-z0-9-]+/gi, '-')}.json`),
    [target],
  );

  return (
    <Editor
      // each arm is its own undo history, so switching arm remounts like
      // switching page
      key={`${target}:${arm}`}
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
      initialMetrics={metrics ?? DEFAULT_METRICS}
      initialSettings={settings ?? {}}
      onSaveTheme={onSaveTheme}
      menus={menus}
      products={products}
      collections={collections}
      media={media}
      pickMedia={pickMedia}
      busy={fetcher.state !== 'idle'}
      version={version}
      unpublished={unpublished}
      error={result && !result.ok ? result.message : undefined}
      onExport={onExport}
      test={test ?? undefined}
      onTest={test ? onTest : undefined}
    />
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);
