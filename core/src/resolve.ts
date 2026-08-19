import type {Band} from './bands';
import {derive} from './derive';
import type {Cell, Layout} from './types';

// rows a block's rendered content needs, measured in the browser, keyed by id.
// absent means the block keeps its authored span — media does not grow.
export type Measurements = Readonly<Record<string, number>>;

export type Resolved = ReadonlyMap<string, Cell>;

export class ResolverDidNotConverge extends Error {
  constructor(readonly passes: number) {
    super(`resolver did not converge in ${passes} passes`);
    this.name = 'ResolverDidNotConverge';
  }
}

const columnsIntersect = (a: Cell, b: Cell): boolean =>
  a.col < b.col + b.colSpan && b.col < a.col + a.colSpan;

// y pushes x when their columns meet and x starts at or after y's *authored*
// end row. authored, so the relation is fixed and cannot cycle.
export const pushes = (y: Cell, x: Cell): boolean =>
  columnsIntersect(y, x) && x.row >= y.row + y.rowSpan;

const growthOf = (id: string, cell: Cell, m: Measurements): number => {
  const needed = m[id];
  if (needed === undefined || !Number.isFinite(needed)) return 0;
  return Math.max(0, Math.ceil(needed) - cell.rowSpan);
};

// displacement is a longest path over an acyclic relation, so relaxation
// settles in at most one pass per block. the bound is a tripwire, not a guess.
export function resolveCells(
  authored: ReadonlyMap<string, Cell>,
  measurements: Measurements,
): Map<string, Cell> {
  const ids = [...authored.keys()];
  const growth = new Map<string, number>();
  for (const [id, cell] of authored) {
    growth.set(id, growthOf(id, cell, measurements));
  }

  const displacement = new Map<string, number>(ids.map((id) => [id, 0]));
  const maxPasses = ids.length + 1;

  let pass = 0;
  for (; pass < maxPasses; pass++) {
    let changed = false;
    for (const x of ids) {
      const xc = authored.get(x);
      if (!xc) continue;
      let best = 0;
      for (const y of ids) {
        if (y === x) continue;
        const yc = authored.get(y);
        if (!yc || !pushes(yc, xc)) continue;
        const candidate = (displacement.get(y) ?? 0) + (growth.get(y) ?? 0);
        if (candidate > best) best = candidate;
      }
      if (best !== displacement.get(x)) {
        displacement.set(x, best);
        changed = true;
      }
    }
    if (!changed) break;
  }
  if (pass === maxPasses) throw new ResolverDidNotConverge(maxPasses);

  const out = new Map<string, Cell>();
  for (const [id, cell] of authored) {
    out.set(id, {
      col: cell.col,
      colSpan: cell.colSpan,
      row: cell.row + (displacement.get(id) ?? 0),
      rowSpan: cell.rowSpan + (growth.get(id) ?? 0),
    });
  }
  return out;
}

export function resolve(
  layout: Layout,
  band: Band,
  measurements: Measurements,
): Map<string, Cell> {
  return resolveCells(derive(layout, band), measurements);
}
