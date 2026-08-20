import type {Units} from './units';

const SLACK = 1;

// measure the one content wrapper, not the block. background, tint, handles and
// the badge are all children too, and the handles overhang the edge on purpose.
export function overflowRows(block: HTMLElement, u: Units): number {
  const flow = block.querySelector<HTMLElement>(':scope > .u-flow');
  if (!flow) return 0;

  const box = block.getBoundingClientRect();
  const padEnd = parseFloat(getComputedStyle(block).paddingBlockEnd) || 0;
  // rects survive the clip, so already-hidden content still reports its height
  const hidden = flow.getBoundingClientRect().bottom + padEnd - box.bottom;

  return hidden <= SLACK ? 0 : Math.ceil(hidden / (u.row + u.gutter));
}

// every identified block currently losing content, keyed by id
export function overflowing(
  grid: HTMLElement,
  u: Units,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const el of grid.querySelectorAll<HTMLElement>('.u-block[data-block]')) {
    const id = el.dataset.block;
    const rows = overflowRows(el, u);
    if (id && rows > 0) out[id] = rows;
  }
  return out;
}

export const sameOverflow = (
  a: Record<string, number>,
  b: Record<string, number>,
): boolean => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((k) => a[k] === b[k]);
};
