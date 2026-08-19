import {BANDS, type Band, type Measurements} from '@unigrid/core';
import {gridUnits} from '~/blocks/units';

// text height needs a dom, so it is measured here and handed to core as numbers.
// same arithmetic as the dev hud: a block spanning n rows is n rows plus the
// n-1 gutters between them.
// n rows is n tracks plus the n-1 gutters between them, inverted.
// sub-pixel slack only: the height going in is now content, not a box, so there
// is nothing left to drift.
const SLACK = 0.5;

const rowsFor = (height: number, row: number, gutter: number): number =>
  Math.max(1, Math.ceil((height - SLACK + gutter) / (row + gutter)));

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
    const units = gridUnits(grid);
    const found: Record<string, number> = {};

    if (units) {
      // release the row span first. measuring the box measures the last
      // measurement — a block already grown to n rows reports n rows back, and
      // any rounding on the way through ratchets it up by one on every edit.
      // at max-content the number depends on the text and the column width and
      // nothing else, so measuring twice gives the same answer.
      grid.toggleAttribute('data-measuring', true);
      for (const el of grid.querySelectorAll<HTMLElement>('.u-block[data-text]')) {
        const id = el.dataset.block;
        if (!id) continue;
        // fractional, unlike scrollHeight, so no rounding enters at all
        const height = el.getBoundingClientRect().height;
        const rows = rowsFor(height, units.row, units.gutter);
        // a bad measurement is worse than none: core reads a non-finite row
        // count as no growth, so it would fail silently rather than loudly
        if (Number.isFinite(rows)) found[id] = rows;
      }
      grid.toggleAttribute('data-measuring', false);
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
