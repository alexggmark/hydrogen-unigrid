import type {LinksFunction} from 'react-router';
import {redirect, useLoaderData} from 'react-router';
import type {Route} from './+types/collections.$handle';
import {getPaginationVariables, Analytics} from '@shopify/hydrogen';

import type {CollectionData} from '@unigrid/blocks';
import {PaginatedResourceSection} from '~/components/PaginatedResourceSection';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';
import {ProductItem} from '~/components/ProductItem';
import {Composition} from '~/blocks/Composition';
import {loadComposition, money} from '~/lib/layout';
import {collectionPageBy, pageHrefs} from '~/lib/paging';
import type {ProductItemFragment} from 'storefrontapi.generated';
import unigridStyles from '@unigrid/blocks/unigrid.css?url';
import demoStyles from '~/styles/unigrid-demo.css?url';

export const handle = {bare: true};

export const links: LinksFunction = () => [
  {rel: 'stylesheet', href: unigridStyles},
  {rel: 'stylesheet', href: demoStyles},
];

export const meta: Route.MetaFunction = ({data}) => {
  return [{title: `Hydrogen | ${data?.collection.title ?? ''} Collection`}];
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
async function loadCriticalData({context, params, request}: Route.LoaderArgs) {
  const {handle} = params;
  const {storefront} = context;

  if (!handle) {
    throw redirect('/collections');
  }

  // sequential on purpose: the layout owns the page size, so it cannot be
  // fetched alongside the products it is sizing. one template, target
  // 'collection', for the whole store.
  const composition = await loadComposition(storefront, 'collection', 'published', [
    context.env.PUBLIC_STORE_DOMAIN,
  ]);
  const paginationVariables = getPaginationVariables(request, {
    pageBy: collectionPageBy([
      composition.header,
      composition.body,
      composition.footer,
    ]),
  });

  const {collection} = await storefront.query(COLLECTION_QUERY, {
    variables: {handle, ...paginationVariables},
  });

  if (!collection) {
    throw new Response(`Collection ${handle} not found`, {
      status: 404,
    });
  }

  // The API handle might be localized, so redirect to the localized handle
  redirectIfHandleIsLocalized(request, {handle, data: collection});

  return {
    collection,
    composition,
    paging: pageHrefs(new URL(request.url), collection.products.pageInfo),
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
  const {collection, composition, paging} = useLoaderData<typeof loader>();

  // the contextual collection every repeater on the template binds to. one card
  // takes one image, so the fragment's featuredImage is the whole of it.
  const bound: CollectionData = {
    handle: collection.handle,
    title: collection.title,
    products: collection.products.nodes.map((product) => ({
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

  const analytics = (
    <Analytics.CollectionView
      data={{
        collection: {
          id: collection.id,
          handle: collection.handle,
        },
      }}
    />
  );

  // no template authored yet: keep the skeleton grid rather than an empty page,
  // so a store without a layout still sells
  const fallback = (
    <div className="collection">
      <h1>{collection.title}</h1>
      <p className="collection-description">{collection.description}</p>
      <PaginatedResourceSection<ProductItemFragment>
        connection={collection.products}
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
    <>
      <Composition {...composition} collection={bound}>
        {fallback}
      </Composition>
      {analytics}
    </>
  );
}

const PRODUCT_ITEM_FRAGMENT = `#graphql
  fragment MoneyProductItem on MoneyV2 {
    amount
    currencyCode
  }
  fragment ProductItem on Product {
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
        ...MoneyProductItem
      }
      maxVariantPrice {
        ...MoneyProductItem
      }
    }
  }
` as const;

// NOTE: https://shopify.dev/docs/api/storefront/2022-04/objects/collection
const COLLECTION_QUERY = `#graphql
  ${PRODUCT_ITEM_FRAGMENT}
  query Collection(
    $handle: String!
    $country: CountryCode
    $language: LanguageCode
    $first: Int
    $last: Int
    $startCursor: String
    $endCursor: String
  ) @inContext(country: $country, language: $language) {
    collection(handle: $handle) {
      id
      handle
      title
      description
      products(
        first: $first,
        last: $last,
        before: $startCursor,
        after: $endCursor
      ) {
        nodes {
          ...ProductItem
        }
        pageInfo {
          hasPreviousPage
          hasNextPage
          endCursor
          startCursor
        }
      }
    }
  }
` as const;
