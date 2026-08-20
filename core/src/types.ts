import type {Band} from './bands';

export type BlockType = 'text' | 'richText' | 'image' | 'product' | 'rule';

// references, never payloads. short text is small enough to sit inline.
export type ContentRef =
  | {kind: 'none'}
  | {kind: 'text'; value: string}
  | {kind: 'richText'; id: string}
  | {kind: 'image'; gid: string}
  | {kind: 'product'; handle: string};

export type Cell = {
  col: number;
  colSpan: number;
  row: number;
  rowSpan: number;
};

// presence is the override flag, so a derived placement can never go stale
export type Placement = {a: Cell} & Partial<Record<Exclude<Band, 'a'>, Cell>>;

export type Block = {
  id: string;
  type: BlockType;
  content: ContentRef;
  at: Placement;
};

export type Layout = {
  version: number;
  blocks: Block[];
};

export const emptyLayout = (version = 1): Layout => ({version, blocks: []});
