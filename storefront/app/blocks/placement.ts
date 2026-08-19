// per band placement, expressed as css custom properties. bands b and c are
// partial: an absent value falls back to band a in css, which is how a block
// stays derived in a narrow band until it is overridden there.

export type Band = 'a' | 'b' | 'c';

export type Cell = {
  col: number;
  colSpan: number;
  row: number;
  rowSpan: number;
};

export type Placement = {
  a: Cell;
  b?: Partial<Cell>;
  c?: Partial<Cell>;
};

const SHORT = {col: 'c', colSpan: 'cs', row: 'r', rowSpan: 'rs'} as const;

export function placementVars(at: Placement): Record<string, number> {
  const out: Record<string, number> = {};
  for (const band of ['a', 'b', 'c'] as const) {
    const cell = at[band];
    if (!cell) continue;
    for (const key of ['col', 'colSpan', 'row', 'rowSpan'] as const) {
      const value = cell[key];
      if (value !== undefined) out[`--${SHORT[key]}${band}`] = value;
    }
  }
  return out;
}
