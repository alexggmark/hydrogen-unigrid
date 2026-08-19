import {COLUMNS, WIDEST, type Band} from './bands';
import {readingOrder} from './layout';
import type {Cell, Layout} from './types';

// a narrow band is the wide band's reading order, stacked full width. blocks
// overridden in that band stay put and the derived ones flow around them.
export function derive(layout: Layout, band: Band): Map<string, Cell> {
  const out = new Map<string, Cell>();
  const order = readingOrder(layout);

  if (band === WIDEST) {
    for (const b of order) out.set(b.id, b.at.a);
    return out;
  }

  const full = COLUMNS[band];
  const fixed: Cell[] = [];
  for (const b of order) {
    const cell = b.at[band];
    if (cell) {
      out.set(b.id, cell);
      fixed.push(cell);
    }
  }

  let cursor = 1;
  for (const b of order) {
    if (out.has(b.id)) continue;
    const rowSpan = b.at.a.rowSpan;
    let row = cursor;
    // derived cells span the full width, so any fixed cell in these rows clashes
    for (;;) {
      const clash = fixed.find(
        (f) => row < f.row + f.rowSpan && f.row < row + rowSpan,
      );
      if (!clash) break;
      row = clash.row + clash.rowSpan;
    }
    out.set(b.id, {col: 1, colSpan: full, row, rowSpan});
    cursor = row + rowSpan;
  }
  return out;
}

// the cell a block occupies in a band once derivation has run
export const cellFor = (
  layout: Layout,
  id: string,
  band: Band,
): Cell | undefined => derive(layout, band).get(id);
