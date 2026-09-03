import {useState, type CSSProperties} from 'react';
import {useLinkRender} from './link';
import {useMenu} from './menu';
import {CollectionGrid, useCollection} from './collection';
import {ProductDetails, ProductMedia, useProduct} from './product';
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
  const [open, setOpen] = useState(false);

  return (
    <nav
      className="u-menu"
      data-collapse={node.collapse ? '' : undefined}
      data-dir={node.direction}
      data-open={open ? '' : undefined}
    >
      {node.collapse ? (
        <button
          aria-expanded={open}
          className="u-menu-toggle"
          onClick={() => setOpen((v) => !v)}
          type="button"
        >
          <span aria-hidden>{open ? '\u2715' : '\u2630'}</span>
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
    <ProductDetails product={product} />
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
      count={node.count}
    />
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
