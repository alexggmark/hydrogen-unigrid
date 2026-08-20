import type {HeadersFunction, LinksFunction, LoaderFunctionArgs} from 'react-router';
import {useLoaderData, useRouteError} from 'react-router';
import {boundary} from '@shopify/shopify-app-react-router/server';
import {Block, Grid, deriveAll} from '@unigrid/blocks';
import {decode, type Layout} from '@unigrid/core';
import unigridStyles from '@unigrid/blocks/unigrid.css?url';
import {authenticate} from '../shopify.server';

export const links: LinksFunction = () => [
  {rel: 'stylesheet', href: unigridStyles},
];

const LAYOUT_QUERY = `#graphql
  query AdminLayout($handle: String!) {
    metaobjectByHandle(handle: {type: "unigrid_layout", handle: $handle}) {
      fields { key value }
    }
  }
`;

export const loader = async ({request}: LoaderFunctionArgs) => {
  const {admin} = await authenticate.admin(request);
  const response = await admin.graphql(LAYOUT_QUERY, {
    variables: {handle: 'home'},
  });
  const body = (await response.json()) as {
    data?: {
      metaobjectByHandle?: {fields: {key: string; value?: string | null}[]} | null;
    };
  };

  const fields = body.data?.metaobjectByHandle?.fields ?? [];
  const draft = fields.find((f) => f.key === 'draft')?.value ?? null;
  return {layout: draft ? decode(draft) : null};
};

export default function Index() {
  const {layout} = useLoaderData<typeof loader>() as {layout: Layout | null};

  if (!layout) {
    return <s-page heading="unigrid">No layout found for this page.</s-page>;
  }

  const at = deriveAll(layout);

  return (
    <s-page heading="unigrid">
      <Grid>
        {layout.blocks.map((block) => {
          const placement = at.get(block.id);
          return placement ? (
            <Block key={block.id} block={block} at={placement} />
          ) : null;
        })}
      </Grid>
    </s-page>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
