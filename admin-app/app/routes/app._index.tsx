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
import {DEFAULT_PALETTE, decode, encode, type Layout, type Palette} from '@unigrid/core';
import radixStyles from '@radix-ui/themes/styles.css?url';
import unigridStyles from '@unigrid/blocks/unigrid.css?url';
import editorStyles from '@unigrid/editor/editor.css?url';
import {authenticate} from '../shopify.server';
import {
  createLayout,
  createPage,
  listPages,
  loadComposition,
  loadPalette,
  publish,
  saveDraft,
  savePalette,
  type PageRow,
} from '../lib/layout.server';

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
  // header and footer are shared, so they have no page of their own. show them
  // against the homepage rather than emitting a second region with the same
  // target, which collapses to one and gives react duplicate keys.
  const bodyTarget = target === 'header' || target === 'footer' ? 'home' : target;

  const [regions, palette, pages] = await Promise.all([
    loadComposition(admin, bodyTarget),
    loadPalette(admin),
    listPages(admin),
  ]);
  const empty: Layout = {version: 1, blocks: []};
  const label = pages.find((p) => p.target === bodyTarget)?.title ?? 'Page';

  return {
    target,
    pages,
    palette,
    regions: [
      {target: 'header', label: 'Header', layout: regions.header?.layout ?? empty},
      {target: bodyTarget, label, layout: regions.body?.layout ?? empty},
      {target: 'footer', label: 'Footer', layout: regions.footer?.layout ?? empty},
    ],
    version: regions.body?.version ?? 0,
    unpublished: regions.body?.unpublished ?? false,
  };
};

export const action = async ({request}: ActionFunctionArgs) => {
  const {admin} = await authenticate.admin(request);
  const form = await request.formData();
  const target = String(form.get('target') || targetOf(request));
  const intent = form.get('intent');

  if (intent === 'publish') return publish(admin, target);
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
  const {regions, version, unpublished, palette, pages, target} =
    useLoaderData<typeof loader>() as {
      regions: {target: string; label: string; layout: Layout}[];
      version: number;
      unpublished: boolean;
      palette: Palette;
      pages: PageRow[];
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
