import {BANDS, type Band} from './bands';
import type {Block, BlockType, Cell, ContentRef, Layout} from './types';

// wire format is positional and drops defaults. the storefront json metafield
// caps at 128kb, so nothing derivable is written.
//
//   [version, [block, ...]]
//   block = [id, type, content, cellA, cellB?, cellC?]
//   cell  = [col, row] | [col, row, colSpan] | [col, row, colSpan, rowSpan]

const TYPE_CODE: Record<BlockType, string> = {
  text: 't',
  richText: 'x',
  image: 'i',
  product: 'p',
  rule: 'l',
};
const TYPE_OF = Object.fromEntries(
  Object.entries(TYPE_CODE).map(([k, v]) => [v, k as BlockType]),
) as Record<string, BlockType>;

type WireCell = number[];
type WireContent = 0 | [string, string];
type WireBlock = [string, string, WireContent, ...WireCell[]];
type Wire = [number, WireBlock[]];

const encodeCell = (c: Cell): WireCell =>
  c.rowSpan !== 1
    ? [c.col, c.row, c.colSpan, c.rowSpan]
    : c.colSpan !== 1
      ? [c.col, c.row, c.colSpan]
      : [c.col, c.row];

function decodeCell(w: unknown): Cell | undefined {
  if (!Array.isArray(w) || w.length < 2 || w.length > 4) return undefined;
  if (!w.every((n) => Number.isInteger(n))) return undefined;
  const [col, row, colSpan = 1, rowSpan = 1] = w as number[];
  if (col === undefined || row === undefined) return undefined;
  return {col, row, colSpan, rowSpan};
}

const encodeContent = (c: ContentRef): WireContent => {
  switch (c.kind) {
    case 'none':
      return 0;
    case 'text':
      return ['t', c.value];
    case 'richText':
      return ['x', c.id];
    case 'image':
      return ['i', c.gid];
    case 'product':
      return ['p', c.handle];
  }
};

function decodeContent(w: unknown): ContentRef | undefined {
  if (w === 0) return {kind: 'none'};
  if (!Array.isArray(w) || w.length !== 2) return undefined;
  const [tag, value] = w as [unknown, unknown];
  if (typeof value !== 'string') return undefined;
  switch (tag) {
    case 't':
      return {kind: 'text', value};
    case 'x':
      return {kind: 'richText', id: value};
    case 'i':
      return {kind: 'image', gid: value};
    case 'p':
      return {kind: 'product', handle: value};
    default:
      return undefined;
  }
}

export function encode(layout: Layout): string {
  const blocks: WireBlock[] = layout.blocks.map((b) => {
    const cells: WireCell[] = [encodeCell(b.at.a)];
    // trailing absent bands drop off; a present band after an absent one needs
    // a hole, which an empty array marks
    const rest: (WireCell | [])[] = [];
    for (const band of BANDS.slice(1) as Exclude<Band, 'a'>[]) {
      const cell = b.at[band];
      rest.push(cell ? encodeCell(cell) : []);
    }
    while (rest.length && rest[rest.length - 1]?.length === 0) rest.pop();
    return [
      b.id,
      TYPE_CODE[b.type],
      encodeContent(b.content),
      ...cells,
      ...(rest as WireCell[]),
    ];
  });
  return JSON.stringify([layout.version, blocks] satisfies Wire);
}

export function decode(json: string): Layout | undefined {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return undefined;
  }
  if (!Array.isArray(raw) || raw.length !== 2) return undefined;
  const [version, wireBlocks] = raw as [unknown, unknown];
  if (!Number.isInteger(version) || !Array.isArray(wireBlocks))
    return undefined;

  const blocks: Block[] = [];
  for (const w of wireBlocks) {
    if (!Array.isArray(w) || w.length < 4) return undefined;
    const [id, code, content, ...cells] = w as unknown[];
    if (typeof id !== 'string' || typeof code !== 'string') return undefined;
    const type = TYPE_OF[code];
    const ref = decodeContent(content);
    if (!type || !ref) return undefined;

    const a = decodeCell(cells[0]);
    if (!a) return undefined;
    const at: Block['at'] = {a};
    for (const [i, band] of (
      BANDS.slice(1) as Exclude<Band, 'a'>[]
    ).entries()) {
      const slot = cells[i + 1];
      if (slot === undefined) continue;
      if (Array.isArray(slot) && slot.length === 0) continue;
      const cell = decodeCell(slot);
      if (!cell) return undefined;
      at[band] = cell;
    }
    blocks.push({id, type, content: ref, at});
  }
  return {version: version as number, blocks};
}
