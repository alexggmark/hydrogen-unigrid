import {COLUMNS, WIDEST} from './bands';
import {overlaps} from './layout';
import {emptyBlock, isGroup, type Block, type Cell, type Layout, type Node} from './types';

// step past what is in the way; an insertion never moves a hand-placed block
function stepPast(layout: Layout, cell: Cell): Cell {
  let row = cell.row;
  for (;;) {
    const clash = layout.blocks.find((b) => overlaps({...cell, row}, b.at.a));
    if (!clash) return {...cell, row};
    // a clash always ends below the row it clashed at, so this terminates
    row = clash.at.a.row + clash.at.a.rowSpan;
  }
}

// a block added from a narrow band lands in the wide band directly below its
// predecessor there, inheriting that predecessor's column and span
export function insertAfter(
  layout: Layout,
  block: {id: string; rowSpan?: number},
  predecessorId: string,
): Layout {
  const anchor = layout.blocks.find((b) => b.id === predecessorId)?.at.a;
  const cell = stepPast(layout, {
    col: anchor?.col ?? 1,
    colSpan: anchor?.colSpan ?? COLUMNS[WIDEST],
    row: anchor ? anchor.row + anchor.rowSpan : 1,
    rowSpan: block.rowSpan ?? 1,
  });
  const inserted: Block = emptyBlock(block.id, {a: cell});

  return {...layout, blocks: [...layout.blocks, inserted]};
}

const idsOf = (layout: Layout): string[] =>
  layout.blocks.flatMap((b) => [
    b.id,
    ...b.children.flatMap((n) => (isGroup(n) ? [n.id, ...n.children.map((c) => c.id)] : [n.id])),
  ]);

// the copy lands directly below the original, same column and span, in rows
// opened for it the way add row opens one. nothing shares the original's
// columns across that line, so the copy cannot land on anything. narrow
// overrides are left behind: derivation gives the copy a legal cell there
export function duplicate(
  layout: Layout,
  id: string,
): {layout: Layout; id: string} | undefined {
  const original = layout.blocks.find((b) => b.id === id);
  if (!original) return undefined;

  // blocks and nodes are selected by id, so the copy cannot share any of them
  const taken = new Set(idsOf(layout));
  const fresh = (old: string): string => {
    const prefix = old.replace(/-\d+$/, '');
    let n = 1;
    while (taken.has(`${prefix}-${n}`)) n += 1;
    const next = `${prefix}-${n}`;
    taken.add(next);
    return next;
  };
  const copyNode = (node: Node): Node =>
    isGroup(node)
      ? {...node, id: fresh(node.id), children: node.children.map((c) => ({...c, id: fresh(c.id)}))}
      : {...node, id: fresh(node.id)};

  const from = original.at.a;
  const line = from.row + from.rowSpan;
  const copy: Block = {
    ...original,
    id: fresh(original.id),
    at: {a: {...from, row: line}},
    children: original.children.map(copyNode),
  };
  const opened = insertRow(layout, line, from.rowSpan);
  return {layout: {...opened, blocks: [...opened.blocks, copy]}, id: copy.id};
}

// empty rows in the wide band: everything starting at or below the line moves
// down together. a block crossing the line stays put, so no span changes and
// nothing can land on anything else
export function insertRow(layout: Layout, row: number, count = 1): Layout {
  return {
    ...layout,
    blocks: layout.blocks.map((b) =>
      b.at.a.row >= row ? {...b, at: {...b.at, a: {...b.at.a, row: b.at.a.row + count}}} : b,
    ),
  };
}
