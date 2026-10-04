import type {LinksFunction} from 'react-router';
import {useLoaderData} from 'react-router';
import type {Route} from './+types/pages.$handle';
import {Composition} from '~/blocks/Composition';
import {loadComposition} from '~/lib/layout';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';
import unigridStyles from '@unigrid/blocks/unigrid.css?url';
import demoStyles from '~/styles/unigrid-demo.css?url';

// bare, like every other unigrid route: the store's own header, footer and
// app.css would otherwise wrap the grid and margin it from outside.
export const handle = {bare: true};

// a page with a layout renders the grid. one without keeps the shopify page
// body, so attaching a layout is opt-in per page and nothing breaks by default.
export const links: LinksFunction = () => [
  {rel: 'stylesheet', href: unigridStyles},
  {rel: 'stylesheet', href: demoStyles},
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

  const [{page}, composition] = await Promise.all([
    context.storefront.query(PAGE_QUERY, {
      variables: {
        handle: params.handle,
      },
    }),
    loadComposition(
      context.storefront,
      `page:${params.handle}`,
      'published',
      [context.env.PUBLIC_STORE_DOMAIN],
      context.ab,
    ),
  ]);

  if (!page) {
    throw new Response('Not Found', {status: 404});
  }

  redirectIfHandleIsLocalized(request, {handle: params.handle, data: page});

  return {page, composition};
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
  const {page, composition} = useLoaderData<typeof loader>();

  // no layout for this page: keep the shopify body, but still wrap it in the
  // header and footer so the site does not change shape between pages
  const body = composition.body ? null : (
    <div className="page">
      <header>
        <h1>{page.title}</h1>
      </header>
      <main dangerouslySetInnerHTML={{__html: page.body}} />
    </div>
  );

  return <Composition {...composition}>{body}</Composition>;
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
