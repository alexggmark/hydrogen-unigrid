import type {LinksFunction} from 'react-router';
import type {Route} from './+types/collections.all';
import {useLoaderData} from 'react-router';
import {getPaginationVariables} from '@shopify/hydrogen';
import type {CollectionData} from '@unigrid/blocks';
import {PaginatedResourceSection} from '~/components/PaginatedResourceSection';
import {ProductItem} from '~/components/ProductItem';
import {Composition} from '~/blocks/Composition';
import {loadComposition, money} from '~/lib/layout';
import {collectionPageBy, pageHrefs} from '~/lib/paging';
import type {CollectionItemFragment} from 'storefrontapi.generated';
import unigridStyles from '@unigrid/blocks/unigrid.css?url';
import demoStyles from '~/styles/unigrid-demo.css?url';

export const handle = {bare: true};

export const links: LinksFunction = () => [
  {rel: 'stylesheet', href: unigridStyles},
  {rel: 'stylesheet', href: demoStyles},
];

export const meta: Route.MetaFunction = () => {
  return [{title: `Hydrogen | Products`}];
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
async function loadCriticalData({context, request}: Route.LoaderArgs) {
  const {storefront} = context;

  // every product is a collection with no collection behind it, so it renders
  // the collection template like any other. sequential for the same reason
  // collections.$handle is: the layout owns the page size.
  const composition = await loadComposition(
    storefront,
    'collection',
    'published',
    [context.env.PUBLIC_STORE_DOMAIN],
    context.ab,
  );
  const paginationVariables = getPaginationVariables(request, {
    pageBy: collectionPageBy([
      composition.header,
      composition.body,
      composition.footer,
    ]),
  });

  const {products} = await storefront.query(CATALOG_QUERY, {
    variables: {...paginationVariables},
  });

  return {
    products,
    composition,
    paging: pageHrefs(new URL(request.url), products.pageInfo),
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({context}: Route.LoaderArgs) {
  return {};
}

export default function Collection() {
  const {products, composition, paging} = useLoaderData<typeof loader>();

  // no collection record behind this one, so the handle is the route's own
  const bound: CollectionData = {
    handle: 'all',
    title: 'Products',
    products: products.nodes.map((product) => ({
      handle: product.handle,
      title: product.title,
      price: money(product.priceRange?.minVariantPrice),
      images: product.featuredImage
        ? [
            {
              id: product.featuredImage.id ?? product.featuredImage.url,
              url: product.featuredImage.url,
              ...(product.featuredImage.altText
                ? {alt: product.featuredImage.altText}
                : {}),
            },
          ]
        : [],
    })),
    ...paging,
  };

  const fallback = (
    <div className="collection">
      <h1>Products</h1>
      <PaginatedResourceSection<CollectionItemFragment>
        connection={products}
        resourcesClassName="products-grid"
      >
        {({node: product, index}) => (
          <ProductItem
            key={product.id}
            product={product}
            loading={index < 8 ? 'eager' : undefined}
          />
        )}
      </PaginatedResourceSection>
    </div>
  );

  return (
    <Composition {...composition} collection={bound}>
      {fallback}
    </Composition>
  );
}

const COLLECTION_ITEM_FRAGMENT = `#graphql
  fragment MoneyCollectionItem on MoneyV2 {
    amount
    currencyCode
  }
  fragment CollectionItem on Product {
    id
    handle
    title
    featuredImage {
      id
      altText
      url
      width
      height
    }
    priceRange {
      minVariantPrice {
        ...MoneyCollectionItem
      }
      maxVariantPrice {
        ...MoneyCollectionItem
      }
    }
  }
` as const;

// NOTE: https://shopify.dev/docs/api/storefront/latest/objects/product
const CATALOG_QUERY = `#graphql
  query Catalog(
    $country: CountryCode
    $language: LanguageCode
    $first: Int
    $last: Int
    $startCursor: String
    $endCursor: String
  ) @inContext(country: $country, language: $language) {
    products(first: $first, last: $last, before: $startCursor, after: $endCursor) {
      nodes {
        ...CollectionItem
      }
      pageInfo {
        hasPreviousPage
        hasNextPage
        startCursor
        endCursor
      }
    }
  }
  ${COLLECTION_ITEM_FRAGMENT}
` as const;
