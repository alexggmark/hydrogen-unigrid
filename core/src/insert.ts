import {COLUMNS, WIDEST} from './bands';
import {overlaps} from './layout';
import {emptyBlock, type Block, type Cell, type Layout} from './types';

// a block added from a narrow band lands in the wide band directly below its
// predecessor there, inheriting that predecessor's column and span
export function insertAfter(
  layout: Layout,
  block: {id: string; rowSpan?: number},
  predecessorId: string,
): Layout {
  const anchor = layout.blocks.find((b) => b.id === predecessorId)?.at.a;
  const rowSpan = block.rowSpan ?? 1;
  const col = anchor?.col ?? 1;
  const colSpan = anchor?.colSpan ?? COLUMNS[WIDEST];

  // step past what is in the way; an insertion never moves a hand-placed block
  let row = anchor ? anchor.row + anchor.rowSpan : 1;
  for (;;) {
    const clash = layout.blocks.find((b) =>
      overlaps({col, colSpan, row, rowSpan}, b.at.a),
    );
    if (!clash) break;
    // a clash always ends below the row it clashed at, so this terminates
    row = clash.at.a.row + clash.at.a.rowSpan;
  }

  const cell: Cell = {col, colSpan, row, rowSpan};
  const inserted: Block = emptyBlock(block.id, {a: cell});

  return {...layout, blocks: [...layout.blocks, inserted]};
}
