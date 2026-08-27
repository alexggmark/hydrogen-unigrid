import type {CSSProperties, ReactNode} from 'react';
import {DEFAULT_PALETTE, type Palette} from '@unigrid/core';
import {GridDev} from './GridDev';
import {GridProbes} from './GridProbes';
import {paletteVars} from './elements';
import {LinkRenderer, type LinkRender} from './link';
import {MenuSource, type Menus} from './menu';

// frame and grid are separate elements on purpose — see unigrid.css
export function Grid({
  children,
  probes,
  dev,
  palette = DEFAULT_PALETTE,
  link,
  menus,
}: {
  children?: ReactNode;
  probes?: boolean;
  // the consumer decides, because a shared package cannot know whose build it is in
  dev?: boolean;
  palette?: Palette;
  // how this surface navigates. absent falls back to a plain anchor.
  link?: LinkRender;
  // resolved by the route, keyed by handle
  menus?: Menus;
}) {
  return (
    <div className="u-frame" style={paletteVars(palette) as CSSProperties}>
      <div className="u-grid">
        {dev ? <GridDev /> : null}
        {probes || dev ? <GridProbes /> : null}
        <LinkRenderer render={link}>
          <MenuSource menus={menus}>{children}</MenuSource>
        </LinkRenderer>
      </div>
    </div>
  );
}
