import type {LinksFunction} from 'react-router';
import {useLoaderData} from 'react-router';
import type {Route} from './+types/pages.$handle';
import {Block, Grid, deriveAll} from '@unigrid/blocks';
import {DEV, gridDevLinks} from '~/blocks/grid-dev';
import {loadLayout, loadPalette} from '~/lib/layout';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';
import unigridStyles from '@unigrid/blocks/unigrid.css?url';
import demoStyles from '~/styles/unigrid-demo.css?url';

// a page with a layout renders the grid. one without keeps the shopify page
// body, so attaching a layout is opt-in per page and nothing breaks by default.
export const links: LinksFunction = () => [
  {rel: 'stylesheet', href: unigridStyles},
  {rel: 'stylesheet', href: demoStyles},
  ...gridDevLinks(),
];

export const meta: Route.MetaFunction = ({data}) => {
  return [{title: `Hydrogen | ${data?.page.title ?? ''}`}];
};

export async function loader(args: Route.LoaderArgs) {
  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  return {...deferredData, ...criticalData};
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 */
async function loadCriticalData({context, request, params}: Route.LoaderArgs) {
  if (!params.handle) {
    throw new Error('Missing page handle');
  }

  const [{page}, stored, palette] = await Promise.all([
    context.storefront.query(PAGE_QUERY, {
      variables: {
        handle: params.handle,
      },
    }),
    loadLayout(context.storefront, `page:${params.handle}`),
    loadPalette(context.storefront),
  ]);

  if (!page) {
    throw new Response('Not Found', {status: 404});
  }

  redirectIfHandleIsLocalized(request, {handle: params.handle, data: page});

  return {page, stored, palette};
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({context}: Route.LoaderArgs) {
  return {};
}

export default function Page() {
  const {page, stored, palette} = useLoaderData<typeof loader>();

  if (!stored || stored.layout.blocks.length === 0) {
    return (
      <div className="page">
        <header>
          <h1>{page.title}</h1>
        </header>
        <main dangerouslySetInnerHTML={{__html: page.body}} />
      </div>
    );
  }

  const at = deriveAll(stored.layout);

  return (
    <div className="unigrid-demo">
      <Grid dev={DEV} palette={palette}>
        {stored.layout.blocks.map((block) => {
          const placement = at.get(block.id);
          return placement ? (
            <Block key={block.id} block={block} at={placement} />
          ) : null;
        })}
      </Grid>
    </div>
  );
}

const PAGE_QUERY = `#graphql
  query Page(
    $language: LanguageCode,
    $country: CountryCode,
    $handle: String!
  )
  @inContext(language: $language, country: $country) {
    page(handle: $handle) {
      handle
      id
      title
      body
      seo {
        description
        title
      }
    }
  }
` as const;
