import {COLUMNS, type Band} from '../src/bands';
import {emptyBlock, type Block, type Cell, type Flex, type Layout, type Node} from '../src/types';

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

export function flex(r: () => number): Flex {
  return {
    direction: r() < 0.5 ? 'row' : 'column',
    justify: (['start', 'center', 'end', 'between'] as const)[int(r, 0, 3)] ?? 'start',
    align: (['start', 'center', 'end', 'stretch'] as const)[int(r, 0, 3)] ?? 'stretch',
    text: (['start', 'center', 'end'] as const)[int(r, 0, 2)] ?? 'start',
    gap: int(r, 0, 6),
  };
}

export function element(r: () => number, id: string): Extract<Node, {kind: 'headline' | 'text' | 'richText' | 'button'}> {
  const s = `v${int(r, 0, 9999)} — ünïcode "quotes"`;
  const pick = int(r, 0, 3);
  if (pick === 0) {
    return {id, kind: 'headline', level: int(r, 1, 5) as 1 | 2 | 3 | 4 | 5, value: s};
  }
  if (pick === 1) return {id, kind: 'text', size: r() < 0.5 ? 'lg' : 'sm', value: s};
  if (pick === 2) return {id, kind: 'richText', size: r() < 0.5 ? 'lg' : 'sm', value: s};
  return {
    id,
    kind: 'button',
    variant: r() < 0.5 ? 'primary' : 'secondary',
    label: s,
    href: r() < 0.5 ? `/x/${int(r, 0, 99)}` : '',
  };
}

export function children(r: () => number, id: string): Node[] {
  return Array.from({length: int(r, 0, 3)}, (_, i) => {
    if (r() < 0.3) {
      return {
        id: `${id}-g${i}`,
        kind: 'group' as const,
        flex: flex(r),
        children: Array.from({length: int(r, 0, 2)}, (_, j) =>
          element(r, `${id}-g${i}-e${j}`),
        ),
      };
    }
    return element(r, `${id}-e${i}`);
  });
}

export function block(r: () => number, id: string): Block {
  const at: Block['at'] = {a: cell(r, 'a')};
  if (r() < 0.5) at.b = cell(r, 'b');
  if (r() < 0.5) at.c = cell(r, 'c');
  return {
    ...emptyBlock(id, at),
    fill:
      r() < 0.5
        ? {}
        : {
            color: `#${int(r, 0, 0xffffff).toString(16).padStart(6, '0')}`,
            ...(r() < 0.5
              ? {media: {kind: r() < 0.5 ? 'image' : 'video', src: `gid://m/${int(r, 0, 999)}`} as const}
              : {}),
            ...(r() < 0.5 ? {overlay: {color: '#000000', opacity: int(r, 0, 100) / 100}} : {}),
          },
    flex: flex(r),
    invert: r() < 0.5,
    children: children(r, id),
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
    blocks.push(emptyBlock(`b${i}`, {a: {col, colSpan, row, rowSpan}}));
  }
  return {version: 1, blocks};
}
