import {createContext, useContext, type ReactNode} from 'react';
import type {ButtonVariant, ProductRef} from '@unigrid/core';
import {useImageRender} from './image';
import {useShop} from './shop';

// what a product element renders from. a plain shape, resolved by the route:
// this package cannot fetch, and money formatting is the storefront's job.
export type ProductImage = {id: string; url: string; alt?: string};

export type ProductData = {
  handle: string;
  title: string;
  price?: string;
  images: ProductImage[];
  // what a cart line is actually made of. absent means nothing to add — a
  // product with no variant resolved, or a shell that never fetched one.
  variantId?: string;
  availableForSale?: boolean;
};

export type Products = Record<string, ProductData>;

type Source = {
  // the product the route is rendering, if it is rendering one
  context?: ProductData;
  byHandle: Products;
};

const Ctx = createContext<Source>({byHandle: {}});

export const useProduct = (ref: ProductRef): ProductData | undefined => {
  const source = useContext(Ctx);
  return ref === 'context' ? source.context : source.byHandle[ref.handle];
};

export function ProductSource({
  product,
  products,
  children,
}: {
  product?: ProductData;
  products?: Products;
  children: ReactNode;
}) {
  return (
    <Ctx.Provider value={{context: product, byHandle: products ?? {}}}>
      {children}
    </Ctx.Provider>
  );
}

// enough squares to read as a strip before any product is bound
const PLACEHOLDERS = 5;

export function ProductMedia({product}: {product?: ProductData}) {
  const Image = useImageRender();
  const images = product?.images ?? [];
  const main = images[0];
  const thumbs = images.length ? images : new Array<null>(PLACEHOLDERS).fill(null);

  return (
    <div className="u-pmedia">
      {main ? (
        <Image
          className="u-pmain"
          src={main.url}
          alt={main.alt ?? product?.title ?? ''}
        />
      ) : (
        <div className="u-pmain" data-empty aria-hidden />
      )}
      {/* scrolls rather than wraps: a wrapping strip would change the element's
          height with the image count, and the span is the merchant's decision */}
      <div className="u-pthumbs">
        {thumbs.map((image, i) =>
          image ? (
            <Image key={image.id} className="u-pthumb" src={image.url} alt="" />
          ) : (
            <div key={i} className="u-pthumb" data-empty aria-hidden />
          ),
        )}
      </div>
    </div>
  );
}

export function ProductDetails({
  product,
  variant = 'primary',
}: {
  product?: ProductData;
  variant?: ButtonVariant;
}) {
  const {onAddToCart, addingToCart} = useShop();
  // dimmed until one is bound, so an unresolved element reads as a placeholder
  const dim = product ? '' : ' u-dim';
  const variantId = product?.variantId;
  const soldOut = product ? product.availableForSale === false : false;
  // a shell with no cart renders the same span it always did, so the admin and
  // an unbound element look alike
  const buyable = Boolean(variantId) && Boolean(onAddToCart) && !soldOut;

  return (
    <div className="u-pdetails">
      <p className={`u-hl u-hl-3${dim}`}>{product?.title ?? 'Product title'}</p>
      <p className={`u-text u-text-lg${dim}`}>{product?.price ?? '—'}</p>
      {buyable ? (
        <button
          className="u-btn"
          data-variant={variant}
          type="button"
          disabled={addingToCart}
          onClick={() => onAddToCart?.(variantId!)}
        >
          {addingToCart ? 'Adding…' : 'Add to cart'}
        </button>
      ) : (
        <span className="u-btn" data-variant={variant}>
          {soldOut ? 'Sold out' : 'Add to cart'}
        </span>
      )}
    </div>
  );
}
