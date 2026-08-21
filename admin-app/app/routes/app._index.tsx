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
  loadDraft,
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
  const [draft, palette, pages] = await Promise.all([
    loadDraft(admin, target),
    loadPalette(admin),
    listPages(admin),
  ]);
  return {
    target,
    pages,
    palette,
    layout: draft?.layout ?? null,
    version: draft?.version ?? 0,
    unpublished: draft?.unpublished ?? false,
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

  const layout = decode(String(form.get('layout') ?? ''));
  if (!layout) return {ok: false, message: 'could not read that layout'};
  return saveDraft(admin, target, layout);
};

export default function Index() {
  const {layout, version, unpublished, palette, pages, target} =
    useLoaderData<typeof loader>() as {
      layout: Layout | null;
      version: number;
      unpublished: boolean;
      palette: Palette;
      pages: PageRow[];
      target: string;
    };
  const fetcher = useFetcher<typeof action>();
  const navigate = useNavigate();

  const onSave = useCallback(
    (next: Layout) =>
      fetcher.submit({layout: encode(next), target}, {method: 'post'}),
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
      initial={layout ?? {version: 1, blocks: []}}
      missing={!layout}
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
