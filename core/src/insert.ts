import {COLUMNS, WIDEST} from './bands';
import {overlaps} from './layout';
import {resolveCells} from './resolve';
import type {Block, Cell, Layout} from './types';

// a block added from a narrow band lands in the wide band directly below its
// predecessor there, inheriting that predecessor's column and span
export function insertAfter(
  layout: Layout,
  block: Omit<Block, 'at'> & {rowSpan?: number},
  predecessorId: string,
): Layout {
  const anchor = layout.blocks.find((b) => b.id === predecessorId)?.at.a;
  const rowSpan = block.rowSpan ?? 1;
  const col = anchor?.col ?? 1;
  const colSpan = anchor?.colSpan ?? COLUMNS[WIDEST];
  const sharesColumns = (c: Cell) =>
    c.col < col + colSpan && col < c.col + c.colSpan;

  // never land mid-block: step past anything straddling the insertion row
  let row = anchor ? anchor.row + anchor.rowSpan : 1;
  for (;;) {
    const straddler = layout.blocks.find(
      (b) =>
        sharesColumns(b.at.a) &&
        b.at.a.row < row &&
        b.at.a.row + b.at.a.rowSpan > row,
    );
    if (!straddler) break;
    row = straddler.at.a.row + straddler.at.a.rowSpan;
  }

  const cell: Cell = {col, colSpan, row, rowSpan};
  const inserted: Block = {
    id: block.id,
    type: block.type,
    content: block.content,
    at: {a: cell},
  };

  // a free slot displaces nothing, so authored gaps survive
  if (!layout.blocks.some((b) => overlaps(cell, b.at.a))) {
    return {...layout, blocks: [...layout.blocks, inserted]};
  }

  // otherwise it is a zero-height block growing to full height, which is the
  // push the resolver already implements — cascades included
  const authored = new Map<string, Cell>(
    layout.blocks.map((b) => [b.id, b.at.a]),
  );
  authored.set(inserted.id, {...cell, rowSpan: 0});
  const pushed = resolveCells(authored, {[inserted.id]: rowSpan});

  return {
    ...layout,
    blocks: [...layout.blocks, inserted].map((b) => {
      const moved = pushed.get(b.id);
      return moved ? {...b, at: {...b.at, a: moved}} : b;
    }),
  };
}
