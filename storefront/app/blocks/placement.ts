import {BANDS, derive, type Band, type Cell, type Layout} from '@unigrid/core';

// bands b and c are optional here only so a caller can omit them; derivation
// fills all three, so in practice every band arrives filled
export type Placement = {a: Cell} & Partial<Record<Exclude<Band, 'a'>, Cell>>;

const SHORT = {col: 'c', colSpan: 'cs', row: 'r', rowSpan: 'rs'} as const;

export function placementVars(at: Placement): Record<string, number> {
  const out: Record<string, number> = {};
  for (const band of BANDS) {
    const cell = at[band];
    if (!cell) continue;
    for (const key of ['col', 'colSpan', 'row', 'rowSpan'] as const) {
      out[`--${SHORT[key]}${band}`] = cell[key];
    }
  }
  return out;
}

// every band derived up front so switching bands is a css swap, not a recompute
export function deriveAll(layout: Layout): Map<string, Placement> {
  const byBand = BANDS.map((band) => [band, derive(layout, band)] as const);
  const out = new Map<string, Placement>();
  for (const block of layout.blocks) {
    const a = byBand[0]?.[1].get(block.id);
    if (!a) continue;
    const at: Placement = {a};
    for (const [band, cells] of byBand) {
      if (band === 'a') continue;
      const cell = cells.get(block.id);
      if (cell) at[band] = cell;
    }
    out.set(block.id, at);
  }
  return out;
}
