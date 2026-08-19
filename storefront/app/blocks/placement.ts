import {BANDS, type Band, type Cell} from '@unigrid/core';

// bands b and c are optional here only so a caller can omit them; the engine
// resolves all three, so in practice every band arrives filled
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
