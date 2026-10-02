import type {Band} from './bands';

export type Cell = {
  col: number;
  colSpan: number;
  row: number;
  rowSpan: number;
};

// presence is the override flag, so a derived placement can never go stale
export type Placement = {a: Cell} & Partial<Record<Exclude<Band, 'a'>, Cell>>;

export type HeadingLevel = 1 | 2 | 3 | 4 | 5;
export type TextSize = 'lg' | 'sm';
// outline was called secondary until the glass variant arrived and made the
// name describe a rank rather than a shape
export type ButtonVariant = 'primary' | 'outline' | 'glass';
export const BUTTON_VARIANTS: ButtonVariant[] = ['primary', 'outline', 'glass'];
export type MenuDirection = 'row' | 'column';

export type ProductView = 'media' | 'details';

export const COLUMNS_MAX = 6;
export type Columns = 1 | 2 | 3 | 4 | 5 | 6;
export const COLUMN_CHOICES: Columns[] = [1, 2, 3, 4, 5, 6];

// 'context' is whatever product the route is rendering, so one template serves
// the whole catalogue. a handle pins one product, for a feature elsewhere.
export type ProductRef = 'context' | {handle: string};

// same shape, different resource. 'context' on a collection template is the
// collection being browsed.
export type CollectionRef = 'context' | {handle: string};

export const DEFAULT_STARS = 5;
export const STAR_CHOICES = ['1', '2', '3', '4', '5'] as const;

export const DEFAULT_LOGO_WIDTH = 20;
// a logo needs more of a phone than of a desktop to stay legible
export const DEFAULT_LOGO_NARROW = 40;
export const LOGO_RANGE: [number, number, number] = [2, 100, 1];

export const DEFAULT_COLUMNS: Columns = 3;
export const DEFAULT_COUNT = 12;
export const ROWS_MAX = 20;

// a page is a whole number of rows. a count that is not a multiple of columns
// leaves a short row on every page rather than only the last one.
export const fitCount = (count: number, columns: number): number => {
  const rows = Math.round(count / columns);
  return Math.min(ROWS_MAX, Math.max(1, rows)) * columns;
};

// the narrow band's columns have to divide the wide band's, or a count that is
// a whole number of rows in one is ragged in the other. picking from divisors
// is what keeps one count correct in every band.
export const divisorsOf = (columns: number): Columns[] =>
  COLUMN_CHOICES.filter((c) => columns % c === 0);

export const fitNarrow = (narrow: number, columns: number): Columns => {
  const legal = divisorsOf(columns).filter((c) => c <= narrow);
  return legal.at(-1) ?? 1;
};

export type Element =
  | {id: string; kind: 'headline'; level: HeadingLevel; value: string}
  | {id: string; kind: 'text'; size: TextSize; value: string}
  | {id: string; kind: 'richText'; size: TextSize; value: string}
  | {id: string; kind: 'button'; variant: ButtonVariant; label: string; href: string}
  // a handle, never the links. the menu is authored in the shopify admin, and a
  // copy taken here would go stale the moment it is edited there.
  | {
      id: string;
      kind: 'menu';
      handle: string;
      direction: MenuDirection;
      // narrowest band only, so the same element serves a header and a footer
      collapse: boolean;
    }
  // a reference, never the product. geometry is identical to every other
  // element; only the binding differs.
  | {
      id: string;
      kind: 'product';
      view: ProductView;
      source: ProductRef;
      // the buy button. every element that renders one lets the merchant pick it.
      variant: ButtonVariant;
    }
  // the image is the theme's, so one logo changes everywhere at once. the width
  // is the element's, because a header and a footer want different ones. both
  // are --u multiples, so 20 is a fifth of the grid at any width.
  | {id: string; kind: 'logo'; width: number; narrow: number}
  // stars take a colour of their own because a rating is a mark, not text; the
  // label beside them follows the block like everything else, so inverting a
  // block inverts the words and leaves the stars alone.
  | {id: string; kind: 'rating'; stars: number; label: string; colour?: Colour}
  // the shopper's own two controls. no reference to resolve: the shell knows the
  // cart count and whether anyone is signed in, and hands both in.
  | {id: string; kind: 'cart'; label: string}
  | {id: string; kind: 'account'; label: string}
  // a repeater with fixed internals: the merchant sizes the block and chooses
  // the grid, the card inside is code. count stays a multiple of columns, so
  // only the last page can have a short row. narrow is band c's column count,
  // the one place a composition is authored twice — four across is unreadable
  // on a phone whatever the block is doing.
  | {
      id: string;
      kind: 'collection';
      source: CollectionRef;
      columns: Columns;
      narrow: Columns;
      count: number;
      // the pager's buttons
      variant: ButtonVariant;
    };

export type ElementKind = Element['kind'];

export type TextAlign = 'start' | 'center' | 'end';

export type Flex = {
  direction: 'row' | 'column';
  justify: 'start' | 'center' | 'end' | 'between';
  align: 'start' | 'center' | 'end' | 'stretch';
  // in --u multiples, so gap scales with the grid like everything else
  gap: number;
};

// width caps the group horizontally, in --u multiples, so a headline can be
// held to a measure without narrowing the block it sits in. horizontal only: a
// height cap would be a second way to say what the block's span already says.
export type Group = {
  id: string;
  kind: 'group';
  flex: Flex;
  narrowFlex?: Flex;
  width?: number;
  children: Element[];
};

export const GROUP_WIDTH_RANGE: [number, number, number] = [10, 100, 1];

// one level only: nested groups make this a page builder
export type Node = Element | Group;

export type MediaKind = 'image' | 'video';

// a url is what layouts authored before the file picker hold; a gid is what the
// picker gives. both render, so nothing already saved needs migrating.
export type Media =
  | {kind: MediaKind; src: string}
  | {kind: MediaKind; id: string};

export const isMediaRef = (m: Media): m is {kind: MediaKind; id: string} =>
  'id' in m;

export const SLOTS = [1, 2, 3, 4, 5] as const;
export type Slot = (typeof SLOTS)[number];

// a slot, not a hex. storing the colour would make the palette unreachable —
// changing it later could not find the blocks already using it.
export type Colour = {slot: Slot} | {hex: string};

export const isSlot = (c: Colour): c is {slot: Slot} => 'slot' in c;

export type Palette = Record<Slot, string>;

export const DEFAULT_PALETTE: Palette = {
  1: '#111110',
  2: '#fbfbf9',
  3: '#d8261c',
  4: '#1b3fa0',
  5: '#f2c200',
};

export type Fill = {
  color?: Colour;
  media?: Media;
  overlay?: {color: Colour; opacity: number};
};

export type Block = {
  id: string;
  at: Placement;
  fill: Fill;
  flex: Flex;
  // the phone's own arrangement. absent means it follows flex
  narrowFlex?: Flex;
  // flips the ink/paper pair for everything inside, buttons included
  invert: boolean;
  children: Node[];
};

export type Layout = {
  version: number;
  blocks: Block[];
};

export const DEFAULT_FLEX: Flex = {
  direction: 'column',
  justify: 'start',
  align: 'stretch',
  gap: 1,
};

export const emptyLayout = (version = 1): Layout => ({version, blocks: []});

export const emptyBlock = (id: string, at: Placement): Block => ({
  id,
  at,
  fill: {},
  flex: {...DEFAULT_FLEX},
  invert: false,
  children: [],
});

export const isGroup = (node: Node): node is Group => node.kind === 'group';
