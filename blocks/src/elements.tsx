import {useState, type CSSProperties} from 'react';
import {useImageRender} from './image';
import {useLinkRender} from './link';
import {useMenu} from './menu';
import {CollectionGrid, useCollection} from './collection';
import {useShop} from './shop';
import {useLogo} from './logo';
import {ProductDetails, ProductMedia, useProduct} from './product';
import type {Metrics, Settings} from '@unigrid/core';
import {DISPLAY_SERIF} from './font';
import {
  isGroup,
  isSlot,
  SLOTS,
  type Colour,
  type Element,
  type Flex,
  type Node,
  type Palette,
} from '@unigrid/core';

// a slot resolves to a variable, not a value, so changing the palette moves
// every block using it — including ones already published.
export const paint = (c: Colour): string =>
  isSlot(c) ? `var(--theme-${c.slot})` : c.hex;

export const paletteVars = (palette: Palette): Record<string, string> =>
  Object.fromEntries(SLOTS.map((slot) => [`--theme-${slot}`, palette[slot]]));

// the page's own background. it sits above the frame, so it needs the palette
// with it or a slot would have nothing to resolve against.
// sRGB relative luminance, gamma corrected: a naive channel average calls a
// saturated blue light and a saturated yellow dark, and both would be wrong
const luminance = (hex: string): number => {
  const v = hex.replace('#', '');
  const channel = (i: number) => {
    const c = parseInt(v.slice(i * 2, i * 2 + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
};

// a block with no fill of its own sits on the page, so the page decides whether
// its ink is light or dark. an unset background is the stylesheet's own, which
// is light.
export const pageIsDark = (palette: Palette, settings?: Settings): boolean => {
  const c = settings?.background;
  if (!c) return false;
  const hex = isSlot(c) ? palette[c.slot] : c.hex;
  return /^#[0-9a-f]{6}$/i.test(hex) && luminance(hex) < 0.4;
};

export const pageVars = (
  palette: Palette,
  settings?: Settings,
): Record<string, string> => ({
  ...paletteVars(palette),
  ...(settings?.background ? {'--page-bg': paint(settings.background)} : {}),
  ...(settings?.headingFont === 'serif'
    ? {'--font-display': DISPLAY_SERIF, '--display-weight': '400'}
    : {}),
  // anything the page itself renders — a route's fallback content — has to
  // follow the background too, not just the blocks
  ...(pageIsDark(palette, settings) ? {'--page-ink': '#fbfbf9'} : {}),
});

// unitless numbers, not lengths: the stylesheet multiplies each by --u so the
// theme scales with the grid instead of pinning it. the two page boundaries are
// the exception the grid layer already makes for itself.
export const metricVars = (metrics?: Metrics): Record<string, string> => {
  if (!metrics) return {};
  const m = metrics;
  return {
    '--grid-max': `${m.pageMax}rem`,
    '--margin-vw': String(m.pageMargin),
    '--margin-narrow-vw': String(m.pageMarginNarrow),
    '--pad-u': String(m.pagePadY),
    '--pad-narrow-u': String(m.pagePadYNarrow),
    '--gutter-u': String(m.gutter),
    '--gutter-narrow-u': String(m.gutterNarrow),
    '--block-pad-x-u': String(m.blockPadX),
    '--block-pad-y-u': String(m.blockPadY),
    '--block-pad-x-c-u': String(m.blockPadXNarrow),
    '--block-pad-y-c-u': String(m.blockPadYNarrow),
    '--block-radius-u': String(m.blockRadius),
    '--image-radius-u': String(m.imageRadius),
    '--btn-pad-x-u': String(m.buttonPadX),
    '--btn-pad-y-u': String(m.buttonPadY),
    '--btn-radius-u': String(m.buttonRadius),
  };
};

const JUSTIFY: Record<Flex['justify'], string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
};

const ALIGN: Record<Flex['align'], string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
};

// text follows whichever axis runs horizontally: align in a column, justify in
// a row
const TEXT_IN_COLUMN: Record<Flex['align'], string> = {
  start: 'start',
  center: 'center',
  end: 'end',
  stretch: 'start',
};

const TEXT_IN_ROW: Record<Flex['justify'], string> = {
  start: 'start',
  center: 'center',
  end: 'end',
  between: 'start',
};

export const textAlign = (f: Flex): string =>
  f.direction === 'column' ? TEXT_IN_COLUMN[f.align] : TEXT_IN_ROW[f.justify];

export const flexVars = (f: Flex): CSSProperties =>
  ({
    '--fd': f.direction,
    '--jc': JUSTIFY[f.justify],
    '--ai': ALIGN[f.align],
    '--ta': textAlign(f),
    '--gap': f.gap,
  }) as CSSProperties;

const HEADINGS = ['h1', 'h2', 'h3', 'h4', 'h5'] as const;

// top level only, like the hydrogen header it is modelled on. nested items in a
// clipped box would open into a space the block does not have.
function Menu({node}: {node: Extract<Element, {kind: 'menu'}>}) {
  const Link = useLinkRender();
  const items = useMenu(node.handle);
  const {onOpenMenu} = useShop();
  const [open, setOpen] = useState(false);
  // the drawer belongs to the shell, so this stays a button and never learns
  // what a portal is. without one, the list still expands in place.
  const drawer = Boolean(onOpenMenu);

  return (
    <nav
      className="u-menu"
      data-collapse={node.collapse ? '' : undefined}
      data-dir={node.direction}
      data-open={open && !drawer ? '' : undefined}
    >
      {node.collapse ? (
        <button
          aria-expanded={drawer ? undefined : open}
          aria-haspopup={drawer ? 'dialog' : undefined}
          className="u-menu-toggle"
          onClick={() =>
            drawer ? onOpenMenu?.(node.handle) : setOpen((v) => !v)
          }
          type="button"
        >
          <span aria-hidden>{open && !drawer ? '\u2715' : '\u2630'}</span>
          <span className="u-sr">Menu</span>
        </button>
      ) : null}
      <ul className="u-menu-list">
        {items.map((item) => (
          <li key={item.id}>
            <Link className="u-menu-link" href={item.url}>
              {item.title}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// binding is the only thing that separates this from a text element: it takes
// its content from the route rather than from the layout
function Product({node}: {node: Extract<Element, {kind: 'product'}>}) {
  const product = useProduct(node.source);
  return node.view === 'details' ? (
    <ProductDetails product={product} variant={node.variant} />
  ) : (
    <ProductMedia product={product} />
  );
}

function Collection({node}: {node: Extract<Element, {kind: 'collection'}>}) {
  const collection = useCollection(node.source);
  return (
    <CollectionGrid
      collection={collection}
      columns={node.columns}
      narrow={node.narrow}
      count={node.count}
      variant={node.variant}
    />
  );
}

function Rating({node}: {node: Extract<Element, {kind: 'rating'}>}) {
  // five glyphs, not n: the scale is half the information, and at five they
  // read as the row of stars this was asked for anyway
  const stars = [1, 2, 3, 4, 5];
  return (
    <span
      className="u-rating"
      style={
        (node.colour ? {'--star': paint(node.colour)} : {}) as CSSProperties
      }
    >
      <span
        className="u-stars"
        role="img"
        aria-label={`${node.stars} out of 5 stars`}
      >
        {stars.map((n) => (
          <span key={n} className="u-star" data-off={n > node.stars ? '' : undefined}>
            {'\u2605'}
          </span>
        ))}
      </span>
      {node.label ? <span className="u-rating-text">{node.label}</span> : null}
    </span>
  );
}

function Logo({node}: {node: Extract<Element, {kind: 'logo'}>}) {
  const Image = useImageRender();
  const logo = useLogo();
  const style = {
    '--logo-w': node.width,
    '--logo-w-c': node.narrow,
  } as CSSProperties;

  // no image set is a placeholder, the same as an unbound product
  return (
    <span className="u-logo" style={style}>
      {logo ? (
        <Image className="u-logo-img" src={logo.url} alt={logo.alt ?? ''} />
      ) : (
        <span className="u-logo-img u-dim" data-empty aria-hidden />
      )}
    </span>
  );
}

function Cart({node}: {node: Extract<Element, {kind: 'cart'}>}) {
  const {cartCount, onOpenCart} = useShop();
  // a button either way: without an opener it is inert rather than disabled, so
  // the admin sees what the storefront renders
  return (
    <button className="u-shop-link" type="button" onClick={onOpenCart}>
      {node.label}
      {cartCount ? <span className="u-shop-count">{cartCount}</span> : null}
    </button>
  );
}

function Account({node}: {node: Extract<Element, {kind: 'account'}>}) {
  const Link = useLinkRender();
  const {accountHref, loggedIn} = useShop();
  return (
    <Link
      className="u-shop-link"
      href={accountHref ?? '/account'}
      data-in={loggedIn ? '' : undefined}
    >
      {node.label}
    </Link>
  );
}

function Leaf({node}: {node: Element}) {
  const Link = useLinkRender();
  switch (node.kind) {
    case 'headline': {
      const Tag = HEADINGS[node.level - 1] ?? 'h2';
      return <Tag className={`u-hl u-hl-${node.level}`}>{node.value}</Tag>;
    }
    case 'text':
      return <p className={`u-text u-text-${node.size}`}>{node.value}</p>;
    case 'richText':
      // pre-line splits paragraphs in css, so lines need no keys of their own
      return (
        <p className={`u-text u-text-${node.size} u-lines`}>{node.value}</p>
      );
    case 'button':
      // no href is a label, not a broken link
      return node.href ? (
        <Link className="u-btn" href={node.href} variant={node.variant}>
          {node.label}
        </Link>
      ) : (
        <span className="u-btn" data-variant={node.variant}>
          {node.label}
        </span>
      );
    case 'menu':
      return <Menu node={node} />;
    case 'product':
      return <Product node={node} />;
    case 'collection':
      return <Collection node={node} />;
    case 'logo':
      return <Logo node={node} />;
    case 'rating':
      return <Rating node={node} />;
    case 'cart':
      return <Cart node={node} />;
    case 'account':
      return <Account node={node} />;
  }
}

export function Nodes({nodes}: {nodes: readonly Node[]}) {
  return (
    <>
      {nodes.map((node) =>
        isGroup(node) ? (
          <div
            key={node.id}
            className="u-flow u-group"
            data-node={node.id}
            style={flexVars(node.flex)}
          >
            <Nodes nodes={node.children} />
          </div>
        ) : (
          <div
            key={node.id}
            className="u-el"
            data-kind={node.kind}
            data-node={node.id}
          >
            <Leaf node={node} />
          </div>
        ),
      )}
    </>
  );
}
