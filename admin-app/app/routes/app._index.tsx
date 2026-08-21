import {useCallback} from 'react';
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LinksFunction,
  LoaderFunctionArgs,
} from 'react-router';
import {useFetcher, useLoaderData, useRouteError} from 'react-router';
import {boundary} from '@shopify/shopify-app-react-router/server';
import {Editor} from '@unigrid/editor';
import {decode, encode, type Layout} from '@unigrid/core';
import radixStyles from '@radix-ui/themes/styles.css?url';
import unigridStyles from '@unigrid/blocks/unigrid.css?url';
import editorStyles from '@unigrid/editor/editor.css?url';
import {authenticate} from '../shopify.server';
import {loadDraft, publish, saveDraft} from '../lib/layout.server';

const TARGET = 'home';

export const links: LinksFunction = () => [
  {rel: 'stylesheet', href: radixStyles},
  {rel: 'stylesheet', href: unigridStyles},
  {rel: 'stylesheet', href: editorStyles},
];

export const loader = async ({request}: LoaderFunctionArgs) => {
  const {admin} = await authenticate.admin(request);
  const draft = await loadDraft(admin, TARGET);
  return {
    layout: draft?.layout ?? null,
    version: draft?.version ?? 0,
    unpublished: draft?.unpublished ?? false,
  };
};

export const action = async ({request}: ActionFunctionArgs) => {
  const {admin} = await authenticate.admin(request);
  const form = await request.formData();

  if (form.get('intent') === 'publish') return publish(admin, TARGET);

  const layout = decode(String(form.get('layout') ?? ''));
  if (!layout) return {ok: false, message: 'could not read that layout'};
  return saveDraft(admin, TARGET, layout);
};

export default function Index() {
  const {layout, version, unpublished} = useLoaderData<typeof loader>() as {
    layout: Layout | null;
    version: number;
    unpublished: boolean;
  };
  const fetcher = useFetcher<typeof action>();

  const onSave = useCallback(
    (next: Layout) => fetcher.submit({layout: encode(next)}, {method: 'post'}),
    [fetcher],
  );

  const onPublish = useCallback(
    () => fetcher.submit({intent: 'publish'}, {method: 'post'}),
    [fetcher],
  );

  if (!layout) {
    return <s-page heading="unigrid">No layout entry for “{TARGET}”.</s-page>;
  }

  const result = fetcher.data;

  return (
    <Editor
      initial={layout}
      onSave={onSave}
      onPublish={onPublish}
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
