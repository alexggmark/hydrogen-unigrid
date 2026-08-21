// measured off hidden probes: an unregistered custom property reads back as its
// own token stream, so --gutter comes out as "calc(1cqw * 1.5)" and parses NaN

export type Units = {col: number; row: number; gutter: number; cols: number};

export function gridUnits(grid: HTMLElement): Units | null {
  const one = grid.querySelector<HTMLElement>('[data-probe="one"]');
  const across = grid.querySelector<HTMLElement>('[data-probe="across"]');
  const down = grid.querySelector<HTMLElement>('[data-probe="down"]');
  if (!one || !across || !down) return null;

  const a = one.getBoundingClientRect();
  const b = across.getBoundingClientRect();
  const c = down.getBoundingClientRect();

  const col = a.width;
  const gutter = b.left - a.right;
  // the tall probe is two rows and the one gutter between them
  const row = (c.height - gutter) / 2;

  // a plain number does parse, unlike a length
  const cols = Number(getComputedStyle(grid).getPropertyValue('--cols').trim());

  if (!Number.isFinite(col) || col <= 0) return null;
  if (!Number.isFinite(row) || row <= 0) return null;
  if (!Number.isFinite(gutter) || gutter < 0) return null;

  return {col, row, gutter, cols: Number.isFinite(cols) ? cols : 12};
}
