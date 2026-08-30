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
export type ButtonVariant = 'primary' | 'secondary';
export type MenuDirection = 'row' | 'column';

export type ProductView = 'media' | 'details';

// 'context' is whatever product the route is rendering, so one template serves
// the whole catalogue. a handle pins one product, for a feature elsewhere.
export type ProductRef = 'context' | {handle: string};

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
  | {id: string; kind: 'product'; view: ProductView; source: ProductRef};

export type ElementKind = Element['kind'];

export type TextAlign = 'start' | 'center' | 'end';

export type Flex = {
  direction: 'row' | 'column';
  justify: 'start' | 'center' | 'end' | 'between';
  align: 'start' | 'center' | 'end' | 'stretch';
  // in --u multiples, so gap scales with the grid like everything else
  gap: number;
};

export type Group = {id: string; kind: 'group'; flex: Flex; children: Element[]};

// one level only: nested groups make this a page builder
export type Node = Element | Group;

export type Media = {kind: 'image' | 'video'; src: string};

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
