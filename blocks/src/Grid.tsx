import type {CSSProperties, ReactNode} from 'react';
import {DEFAULT_PALETTE, type Metrics, type Palette} from '@unigrid/core';
import {GridDev} from './GridDev';
import {GridProbes} from './GridProbes';
import {metricVars, paletteVars} from './elements';
import {
  CollectionSource,
  type CollectionData,
  type Collections,
} from './collection';
import {ImageRenderer, type ImageRender} from './image';
import {LinkRenderer, type LinkRender} from './link';
import {MediaSource, type MediaUrls} from './media';
import {ShopSource, type ShopState} from './shop';
import {LogoSource, type LogoData} from './logo';
import {MenuSource, type Menus} from './menu';
import {ProductSource, type ProductData, type Products} from './product';

// frame and grid are separate elements on purpose — see unigrid.css
export function Grid({
  children,
  probes,
  dev,
  palette = DEFAULT_PALETTE,
  link,
  image,
  menus,
  product,
  products,
  collection,
  collections,
  media,
  shop,
  metrics,
  logo,
}: {
  children?: ReactNode;
  probes?: boolean;
  // the consumer decides, because a shared package cannot know whose build it is in
  dev?: boolean;
  palette?: Palette;
  // how this surface navigates. absent falls back to a plain anchor.
  link?: LinkRender;
  // hydrogen's <Image> on the storefront, a plain img anywhere else
  image?: ImageRender;
  // resolved by the route, keyed by handle
  menus?: Menus;
  // the product this route is rendering, if any, and any the layout pinned
  product?: ProductData;
  products?: Products;
  // the collection this route is browsing, if any, and any the layout pinned
  collection?: CollectionData;
  collections?: Collections;
  // gid to url for any block fill that references a file
  media?: MediaUrls;
  // cart count, the drawer opener, and whether anyone is signed in
  shop?: ShopState;
  // the theme's numbers. absent is the default, which is what the stylesheet
  // already does on its own.
  metrics?: Metrics;
  // the theme's mark, for any logo element on the page
  logo?: LogoData;
}) {
  return (
    <div
      className="u-frame"
      style={
        {...paletteVars(palette), ...metricVars(metrics)} as CSSProperties
      }
    >
      <div className="u-grid">
        {dev ? <GridDev /> : null}
        {probes || dev ? <GridProbes /> : null}
        <LinkRenderer render={link}>
          <ImageRenderer render={image}>
            <MenuSource menus={menus}>
              <ProductSource product={product} products={products}>
                <CollectionSource
                  collection={collection}
                  collections={collections}
                >
                  <MediaSource media={media}>
                    <ShopSource shop={shop}>
                      <LogoSource logo={logo}>{children}</LogoSource>
                    </ShopSource>
                  </MediaSource>
                </CollectionSource>
              </ProductSource>
            </MenuSource>
          </ImageRenderer>
        </LinkRenderer>
      </div>
    </div>
  );
}
