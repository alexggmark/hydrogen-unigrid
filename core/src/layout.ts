import {BANDS, COLUMNS, WIDEST, type Band} from './bands';
import type {Block, Cell, Layout} from './types';

export type Invalid =
  | {ok: false; reason: 'out-of-bounds'}
  | {ok: false; reason: 'bad-span'}
  | {ok: false; reason: 'overlap'; with: string}
  | {ok: false; reason: 'no-such-block'};

export type Result<T> = {ok: true; value: T} | Invalid;

export const inBounds = (cell: Cell, band: Band): boolean =>
  cell.col >= 1 && cell.col + cell.colSpan - 1 <= COLUMNS[band];

export const validSpan = (cell: Cell): boolean =>
  Number.isInteger(cell.col) &&
  Number.isInteger(cell.row) &&
  Number.isInteger(cell.colSpan) &&
  Number.isInteger(cell.rowSpan) &&
  cell.colSpan >= 1 &&
  cell.rowSpan >= 1 &&
  cell.row >= 1;

export function overlaps(a: Cell, b: Cell): boolean {
  const colsMeet = a.col < b.col + b.colSpan && b.col < a.col + a.colSpan;
  const rowsMeet = a.row < b.row + b.rowSpan && b.row < a.row + a.rowSpan;
  return colsMeet && rowsMeet;
}

// undefined where the band is still derived — derivation is layout-wide, so it
// cannot answer for one block
export const cellIn = (block: Block, band: Band): Cell | undefined =>
  band === WIDEST ? block.at.a : block.at[band];

export const isOverridden = (block: Block, band: Band): boolean =>
  band !== WIDEST && block.at[band] !== undefined;

export const findBlock = (layout: Layout, id: string): Block | undefined =>
  layout.blocks.find((b) => b.id === id);

function collide(
  layout: Layout,
  band: Band,
  cell: Cell,
  ignoreId: string,
): string | undefined {
  for (const other of layout.blocks) {
    if (other.id === ignoreId) continue;
    const against = cellIn(other, band);
    if (against && overlaps(cell, against)) return other.id;
  }
  return undefined;
}

export function place(
  layout: Layout,
  id: string,
  band: Band,
  cell: Cell,
): Result<Layout> {
  const block = findBlock(layout, id);
  if (!block) return {ok: false, reason: 'no-such-block'};
  if (!validSpan(cell)) return {ok: false, reason: 'bad-span'};
  if (!inBounds(cell, band)) return {ok: false, reason: 'out-of-bounds'};

  const hit = collide(layout, band, cell, id);
  if (hit) return {ok: false, reason: 'overlap', with: hit};

  return {
    ok: true,
    value: {
      ...layout,
      blocks: layout.blocks.map((b) =>
        b.id === id ? {...b, at: {...b.at, [band]: cell}} : b,
      ),
    },
  };
}

// every authored band, not just the widest: an arriving block can carry
// overrides, and each has to fit its own column count
export function add(layout: Layout, block: Block): Result<Layout> {
  for (const band of BANDS) {
    const cell = cellIn(block, band);
    if (!cell) continue;
    if (!validSpan(cell)) return {ok: false, reason: 'bad-span'};
    if (!inBounds(cell, band)) return {ok: false, reason: 'out-of-bounds'};
    const hit = collide(layout, band, cell, block.id);
    if (hit) return {ok: false, reason: 'overlap', with: hit};
  }
  return {ok: true, value: {...layout, blocks: [...layout.blocks, block]}};
}

export const remove = (layout: Layout, id: string): Layout => ({
  ...layout,
  blocks: layout.blocks.filter((b) => b.id !== id),
});

export function resetToDerived(layout: Layout, id: string, band: Band): Layout {
  if (band === WIDEST) return layout;
  return {
    ...layout,
    blocks: layout.blocks.map((b) => {
      if (b.id !== id) return b;
      const at = {...b.at};
      delete at[band];
      return {...b, at};
    }),
  };
}

export const readingOrder = (layout: Layout): Block[] =>
  [...layout.blocks].sort(
    (x, y) =>
      x.at.a.row - y.at.a.row ||
      x.at.a.col - y.at.a.col ||
      x.id.localeCompare(y.id),
  );
