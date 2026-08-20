import type {Units} from './units';

const SLACK = 1;

export function overflowRows(block: HTMLElement, u: Units): number {
  const hidden = block.scrollHeight - block.clientHeight;
  if (hidden <= SLACK) return 0;
  return Math.ceil(hidden / (u.row + u.gutter));
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
