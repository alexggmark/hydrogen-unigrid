import type {Cell} from '@unigrid/core';
import {gridUnits, type Units} from '~/blocks/units';

export {gridUnits, type Units};

// pixels in, whole modules out. the grid layer is the only thing that knows its
// own size, so everything here reads it back off the dom rather than guessing.

export type Edge = 'n' | 's' | 'e' | 'w' | 'se';

// round rather than floor: a drag past halfway should land on the next module,
// which is what makes snapping feel like magnetism instead of truncation
export const snap = (dx: number, dy: number, u: Units) => ({
  dCol: Math.round(dx / (u.col + u.gutter)),
  dRow: Math.round(dy / (u.row + u.gutter)),
});

// clamped to the band rather than allowed past it. an unclamped candidate draws
// a ghost outside the track count, and css grid answers that by inventing
// implicit columns — the whole composition narrows mid-drag.
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

// dragging a near edge moves the origin and shrinks the span by the same amount,
// so the far edge stays put. clamped at one module rather than inverting.
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

// for blocks arriving from the palette there is no origin to offset from, so the
// pointer picks the module directly
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
