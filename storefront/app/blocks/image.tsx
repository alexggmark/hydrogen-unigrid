import {Image} from '@shopify/hydrogen';
import type {ImageRender} from '@unigrid/blocks';

// the injected half of the image seam. <Image> is hydrogen's, so it is legal
// out here and banned in the shared package — the admin app has no such thing.
export const StoreImage: ImageRender = ({src, alt, className}) => (
  <Image
    alt={alt}
    className={className}
    data={{url: src, altText: alt}}
    sizes="(min-width: 60em) 50vw, 100vw"
  />
);
