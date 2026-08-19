// grid geometry in px, measured off real elements.
//
// not from the custom properties: an unregistered custom property computes to
// its own token stream, so --gutter comes back as the literal text
// "calc(1cqw * 1.5)" and parseFloat gives NaN. that silently produced NaN row
// counts, which core reads as no growth, and NaN drag deltas, which fail as
// bad spans. reading resolved css would fix the first hazard but bets on how
// cqw lengths resolve in getComputedStyle. three hidden probes bet on nothing:
// they are laid out by the same grid everything else is.

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
