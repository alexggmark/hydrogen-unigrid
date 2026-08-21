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

export type Element =
  | {id: string; kind: 'headline'; level: HeadingLevel; value: string}
  | {id: string; kind: 'text'; size: TextSize; value: string}
  | {id: string; kind: 'richText'; size: TextSize; value: string}
  | {id: string; kind: 'button'; variant: ButtonVariant; label: string; href: string};

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

export type Fill = {
  color?: string;
  media?: Media;
  overlay?: {color: string; opacity: number};
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
