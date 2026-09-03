import {createContext, useContext, type CSSProperties, type ReactNode} from 'react';
import type {CollectionRef, Columns} from '@unigrid/core';
import {useImageRender} from './image';
import {useLinkRender} from './link';
import type {ProductData} from './product';

// resolved by the route, like everything else this package renders. the cards
// are products, so a collection needs no shape of its own for them.
export type CollectionData = {
  handle: string;
  title: string;
  products: ProductData[];
  // hrefs, because paging is the route's business and this package has no
  // router. absent means there is no page that way.
  prev?: string;
  next?: string;
};

export type Collections = Record<string, CollectionData>;

type Source = {
  // the collection the route is browsing, if it is browsing one
  context?: CollectionData;
  byHandle: Collections;
};

const Ctx = createContext<Source>({byHandle: {}});

export const useCollection = (ref: CollectionRef): CollectionData | undefined => {
  const source = useContext(Ctx);
  return ref === 'context' ? source.context : source.byHandle[ref.handle];
};

export function CollectionSource({
  collection,
  collections,
  children,
}: {
  collection?: CollectionData;
  collections?: Collections;
  children: ReactNode;
}) {
  return (
    <Ctx.Provider value={{context: collection, byHandle: collections ?? {}}}>
      {children}
    </Ctx.Provider>
  );
}

function Card({product}: {product?: ProductData}) {
  const Image = useImageRender();
  const Link = useLinkRender();
  const image = product?.images[0];
  const card = (
    <>
      {image ? (
        <Image className="u-card-img" src={image.url} alt={image.alt ?? ''} />
      ) : (
        <div className="u-card-img" data-empty aria-hidden />
      )}
      <p className="u-card-title">{product?.title ?? 'Product'}</p>
      <p className="u-card-price">{product?.price ?? '—'}</p>
    </>
  );
  // no product is a placeholder, not a link to nowhere
  return product ? (
    <Link className="u-card" href={`/products/${product.handle}`}>
      {card}
    </Link>
  ) : (
    <div className="u-card u-dim">{card}</div>
  );
}

// enough cards to read as a grid before a collection is bound
const placeholders = (n: number) => new Array<null>(n).fill(null);

export function CollectionGrid({
  collection,
  columns,
  count,
}: {
  collection?: CollectionData;
  columns: Columns;
  count: number;
}) {
  const Link = useLinkRender();
  const products = collection?.products.slice(0, count) ?? [];
  const cards = products.length ? products : placeholders(count);

  return (
    <div className="u-repeat" style={{'--cols-in': columns} as CSSProperties}>
      <div className="u-repeat-grid">
        {cards.map((product, i) => (
          <Card key={product ? product.handle : i} product={product ?? undefined} />
        ))}
      </div>
      {collection?.prev || collection?.next ? (
        <div className="u-repeat-pages">
          {collection.prev ? (
            <Link className="u-btn" href={collection.prev} variant="secondary">
              Previous
            </Link>
          ) : null}
          {collection.next ? (
            <Link className="u-btn" href={collection.next} variant="secondary">
              Next
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
