import {BANDS, type Band, type Measurements} from '@unigrid/core';

// text height needs a dom, so it is measured here and handed to core as numbers.
// same arithmetic as the dev hud: a block spanning n rows is n rows plus the
// n-1 gutters between them.
const rowsFor = (height: number, row: number, gutter: number): number =>
  Math.max(1, Math.ceil((height + gutter) / (row + gutter)));

function rowUnit(grid: HTMLElement): {row: number; gutter: number} {
  const cs = getComputedStyle(grid);
  const cols = Number(cs.getPropertyValue('--cols').trim());
  const gutter = parseFloat(cs.getPropertyValue('--gutter'));
  const width = grid.getBoundingClientRect().width;
  const col = (width - (cols - 1) * gutter) / cols;
  return {row: col * 0.75, gutter};
}

// all three bands without resizing the window. within a band the composition
// only zooms, so characters-per-line is constant and the row count holds at any
// width in that band — measuring band c at desktop width is not a cheat.
export function measureBands(
  host: HTMLElement,
  grid: HTMLElement,
): Record<Band, Measurements> {
  const before = host.dataset.band;
  const out = {} as Record<Band, Measurements>;

  for (const band of BANDS) {
    host.dataset.band = band;
    const {row, gutter} = rowUnit(grid);
    const found: Record<string, number> = {};
    for (const el of grid.querySelectorAll<HTMLElement>('.u-block[data-text]')) {
      const id = el.dataset.block;
      if (id) found[id] = rowsFor(el.scrollHeight, row, gutter);
    }
    out[band] = found;
  }

  if (before === undefined) delete host.dataset.band;
  else host.dataset.band = before;
  return out;
}

// measurements only move when the text or the column width under it changes,
// so this is what decides whether a remeasure is worth a reflow
export const sameMeasurements = (
  a: Record<Band, Measurements> | null,
  b: Record<Band, Measurements>,
): boolean => {
  if (!a) return false;
  return BANDS.every((band) => {
    const x = a[band];
    const y = b[band];
    const keys = new Set([...Object.keys(x), ...Object.keys(y)]);
    return [...keys].every((k) => x[k] === y[k]);
  });
};
