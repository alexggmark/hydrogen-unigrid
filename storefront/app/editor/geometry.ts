import type {Cell} from '@unigrid/core';
import {gridUnits, type Units} from '@unigrid/blocks';

export {gridUnits, type Units};

// pixels in, whole modules out

export type Edge = 'n' | 's' | 'e' | 'w' | 'se';

// round, not floor: a drag past halfway lands on the next module
export const snap = (dx: number, dy: number, u: Units) => ({
  dCol: Math.round(dx / (u.col + u.gutter)),
  dRow: Math.round(dy / (u.row + u.gutter)),
});

// a candidate past the track count makes css grid invent implicit columns, and
// the whole composition narrows mid-drag
const clampCol = (col: number, colSpan: number, cols: number): number =>
  Math.max(1, Math.min(col, cols - colSpan + 1));

export const moved = (
  from: Cell,
  dCol: number,
  dRow: number,
  cols: number,
): Cell => ({
  ...from,
  col: clampCol(from.col + dCol, from.colSpan, cols),
  row: Math.max(1, from.row + dRow),
});

// a near edge moves the origin and shrinks the span by the same amount, so the
// far edge stays put
export function resized(
  from: Cell,
  edge: Edge,
  dCol: number,
  dRow: number,
  cols: number,
): Cell {
  const next = {...from};

  if (edge === 'e' || edge === 'se') {
    next.colSpan = Math.max(1, Math.min(from.colSpan + dCol, cols - from.col + 1));
  }
  if (edge === 'w') {
    const col = Math.max(1, Math.min(from.col + dCol, from.col + from.colSpan - 1));
    next.col = col;
    next.colSpan = from.col + from.colSpan - col;
  }
  if (edge === 's' || edge === 'se') {
    next.rowSpan = Math.max(1, from.rowSpan + dRow);
  }
  if (edge === 'n') {
    const row = Math.max(1, Math.min(from.row + dRow, from.row + from.rowSpan - 1));
    next.row = row;
    next.rowSpan = from.row + from.rowSpan - row;
  }
  return next;
}

// palette blocks have no origin to offset from, so the pointer picks the module
export function cellAt(
  grid: HTMLElement,
  x: number,
  y: number,
  u: Units,
  colSpan: number,
): {col: number; row: number} {
  const rect = grid.getBoundingClientRect();
  const padding = parseFloat(getComputedStyle(grid).paddingBlockStart) || 0;
  return {
    col: clampCol(
      Math.floor((x - rect.left) / (u.col + u.gutter)) + 1,
      colSpan,
      u.cols,
    ),
    row: Math.max(1, Math.floor((y - rect.top - padding) / (u.row + u.gutter)) + 1),
  };
}
