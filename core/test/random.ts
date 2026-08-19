import {COLUMNS, type Band} from '../src/bands';
import type {Block, BlockType, Cell, ContentRef, Layout} from '../src/types';

// mulberry32. seeded so any failing case is reproducible from its seed alone.
export function rng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export const int = (r: () => number, lo: number, hi: number): number =>
  lo + Math.floor(r() * (hi - lo + 1));

const TYPES: BlockType[] = ['text', 'richText', 'image', 'product', 'rule'];

export function cell(r: () => number, band: Band): Cell {
  const cols = COLUMNS[band];
  const colSpan = int(r, 1, cols);
  return {
    col: int(r, 1, cols - colSpan + 1),
    colSpan,
    row: int(r, 1, 40),
    rowSpan: int(r, 1, 6),
  };
}

export function content(r: () => number): ContentRef {
  const pick = int(r, 0, 4);
  const s = `v${int(r, 0, 9999)}`;
  if (pick === 0) return {kind: 'none'};
  if (pick === 1) return {kind: 'text', value: `text ${s} — ünïcode "quotes"`};
  if (pick === 2) return {kind: 'richText', id: `gid://meta/${s}`};
  if (pick === 3) return {kind: 'image', gid: `gid://shopify/MediaImage/${s}`};
  return {kind: 'product', handle: `handle-${s}`};
}

export function block(r: () => number, id: string): Block {
  const at: Block['at'] = {a: cell(r, 'a')};
  if (r() < 0.5) at.b = cell(r, 'b');
  if (r() < 0.5) at.c = cell(r, 'c');
  return {
    id,
    type: TYPES[int(r, 0, TYPES.length - 1)] as BlockType,
    content: content(r),
    at,
  };
}

export function layout(r: () => number, count: number): Layout {
  return {
    version: int(r, 1, 50),
    blocks: Array.from({length: count}, (_, i) => block(r, `b${i}`)),
  };
}

// dense layouts, non-overlapping by construction: stack each block below
// whatever already occupies its columns, leaving a random gap. random cells
// collide so often that add() rejects most, which makes for a weak fuzz.
export function densePacked(r: () => number, count: number): Layout {
  const cols = COLUMNS.a;
  const nextFree = new Array<number>(cols + 1).fill(1);
  const blocks: Layout['blocks'] = [];
  for (let i = 0; i < count; i++) {
    const colSpan = int(r, 1, Math.min(6, cols));
    const col = int(r, 1, cols - colSpan + 1);
    let row = 1;
    for (let c = col; c < col + colSpan; c++)
      row = Math.max(row, nextFree[c] ?? 1);
    row += int(r, 0, 3);
    const rowSpan = int(r, 1, 5);
    for (let c = col; c < col + colSpan; c++) nextFree[c] = row + rowSpan;
    blocks.push({
      id: `b${i}`,
      type: 'text',
      content: {kind: 'none'},
      at: {a: {col, colSpan, row, rowSpan}},
    });
  }
  return {version: 1, blocks};
}
