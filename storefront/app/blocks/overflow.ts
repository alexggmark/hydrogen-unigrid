import type {Units} from './units';

const SLACK = 1;

// editor chrome lives inside the block and the resize handles overhang its
// edges on purpose, so scrollHeight measures the handles rather than the text
const isChrome = (el: Element): boolean =>
  el instanceof HTMLElement && el.dataset.chrome !== undefined;

export function overflowRows(block: HTMLElement, u: Units): number {
  const content = [...block.children].filter((el) => !isChrome(el));
  if (!content.length) return 0;

  // rects survive the clip, so an already-hidden child still reports its height
  const box = block.getBoundingClientRect();
  const padEnd = parseFloat(getComputedStyle(block).paddingBlockEnd) || 0;
  const reach = Math.max(
    ...content.map((el) => el.getBoundingClientRect().bottom - box.top),
  );

  const hidden = reach + padEnd - box.height;
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
