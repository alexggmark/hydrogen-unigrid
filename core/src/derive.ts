import {COLUMNS, TRACKS, WIDEST, type Band} from './bands';
import {readingOrder} from './layout';
import type {Cell, Layout} from './types';

export type Resolved = ReadonlyMap<string, Cell>;

// the wide band's reading order laid into a fixed number of tracks. a block
// wider than half the wide grid keeps full width; the rest pair up.
export function derive(layout: Layout, band: Band): Map<string, Cell> {
  const out = new Map<string, Cell>();
  const order = readingOrder(layout);

  if (band === WIDEST) {
    for (const b of order) out.set(b.id, b.at.a);
    return out;
  }

  const full = COLUMNS[band];
  const tracks = TRACKS[band];
  const width = Math.max(1, Math.floor(full / tracks));
  const half = COLUMNS[WIDEST] / 2;

  const fixed: Cell[] = [];
  for (const b of order) {
    const cell = b.at[band];
    if (cell) {
      out.set(b.id, cell);
      fixed.push(cell);
    }
  }

  // one cursor per track, so a full-width block clears them all and a narrower
  // one takes whichever track is currently shortest
  const cursor = new Array<number>(tracks).fill(1);
  const overlaps = (a: Cell, b: Cell) =>
    a.col < b.col + b.colSpan &&
    b.col < a.col + a.colSpan &&
    a.row < b.row + b.rowSpan &&
    b.row < a.row + a.rowSpan;

  for (const b of order) {
    if (out.has(b.id)) continue;
    const {rowSpan} = b.at.a;
    const wide = b.at.a.colSpan > half;
    const colSpan = wide ? full : width;

    // step past anything hand-placed in these columns rather than reserve the
    // whole row for it, or half the band would go dead beside one override
    const settle = (col: number, from: number): number => {
      let row = from;
      for (;;) {
        const clash = fixed.find((f) => overlaps({col, colSpan, row, rowSpan}, f));
        if (!clash) return row;
        row = clash.row + clash.rowSpan;
      }
    };

    if (wide) {
      const row = settle(1, Math.max(...cursor));
      out.set(b.id, {col: 1, colSpan, row, rowSpan});
      cursor.fill(row + rowSpan);
      continue;
    }

    // every track is tried at its own earliest free row, so a block blocked by
    // an override takes the free track beside it instead of dropping below
    let best = 0;
    let bestRow = Infinity;
    for (let t = 0; t < tracks; t++) {
      const row = settle(t * width + 1, cursor[t] ?? 1);
      if (row < bestRow) {
        bestRow = row;
        best = t;
      }
    }

    out.set(b.id, {col: best * width + 1, colSpan, row: bestRow, rowSpan});
    cursor[best] = bestRow + rowSpan;
  }
  return out;
}

export const cellFor = (
  layout: Layout,
  id: string,
  band: Band,
): Cell | undefined => derive(layout, band).get(id);
