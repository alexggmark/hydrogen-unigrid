import {BANDS, type Band} from './bands';
import {DEFAULT_FLEX} from './types';
import type {
  Block,
  ButtonVariant,
  Cell,
  Element,
  Fill,
  Flex,
  Group,
  HeadingLevel,
  Layout,
  Media,
  Node,
  TextSize,
} from './types';

// short keys, defaults omitted, nothing derivable written. the storefront json
// metafield caps at 128kb.
//
//   {v, b:[block]}
//   block   = {i, a:cell, b?:cell, c?:cell, f?:fill, x?:flex, n?:1, k?:[node]}
//   cell    = [col, row] | [col, row, colSpan] | [col, row, colSpan, rowSpan]
//   node    = {i, k:'h'|'t'|'x'|'b'|'g', ...}
//   fill    = {c?:hex, m?:[kind, src], o?:[hex, opacity]}

const encodeCell = (c: Cell): number[] =>
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

type Obj = Record<string, unknown>;
const obj = (w: unknown): Obj | undefined =>
  typeof w === 'object' && w !== null && !Array.isArray(w) ? (w as Obj) : undefined;
const str = (w: unknown): string | undefined =>
  typeof w === 'string' ? w : undefined;

function encodeFlex(f: Flex): Obj | undefined {
  const out: Obj = {};
  if (f.direction !== DEFAULT_FLEX.direction) out.d = f.direction;
  if (f.justify !== DEFAULT_FLEX.justify) out.j = f.justify;
  if (f.align !== DEFAULT_FLEX.align) out.a = f.align;
  if (f.text !== DEFAULT_FLEX.text) out.t = f.text;
  if (f.gap !== DEFAULT_FLEX.gap) out.g = f.gap;
  return Object.keys(out).length ? out : undefined;
}

const DIRECTIONS = ['row', 'column'] as const;
const JUSTIFY = ['start', 'center', 'end', 'between'] as const;
const ALIGN = ['start', 'center', 'end', 'stretch'] as const;
const TEXT = ['start', 'center', 'end'] as const;

const oneOf = <T extends string>(
  w: unknown,
  allowed: readonly T[],
  fallback: T,
): T => (allowed.includes(w as T) ? (w as T) : fallback);

function decodeFlex(w: unknown): Flex {
  const o = obj(w);
  if (!o) return {...DEFAULT_FLEX};
  return {
    direction: oneOf(o.d, DIRECTIONS, DEFAULT_FLEX.direction),
    justify: oneOf(o.j, JUSTIFY, DEFAULT_FLEX.justify),
    align: oneOf(o.a, ALIGN, DEFAULT_FLEX.align),
    text: oneOf(o.t, TEXT, DEFAULT_FLEX.text),
    gap: typeof o.g === 'number' && Number.isFinite(o.g) ? o.g : DEFAULT_FLEX.gap,
  };
}

function encodeFill(f: Fill): Obj | undefined {
  const out: Obj = {};
  if (f.color) out.c = f.color;
  if (f.media) out.m = [f.media.kind === 'video' ? 'v' : 'i', f.media.src];
  if (f.overlay) out.o = [f.overlay.color, f.overlay.opacity];
  return Object.keys(out).length ? out : undefined;
}

function decodeFill(w: unknown): Fill {
  const o = obj(w);
  if (!o) return {};
  const out: Fill = {};
  const color = str(o.c);
  if (color) out.color = color;
  if (Array.isArray(o.m) && o.m.length === 2) {
    const src = str(o.m[1]);
    if (src) out.media = {kind: o.m[0] === 'v' ? 'video' : 'image', src} as Media;
  }
  if (Array.isArray(o.o) && o.o.length === 2) {
    const color2 = str(o.o[0]);
    const opacity = o.o[1];
    if (color2 && typeof opacity === 'number') {
      out.overlay = {color: color2, opacity};
    }
  }
  return out;
}

function encodeNode(n: Node): Obj {
  switch (n.kind) {
    case 'group': {
      const flex = encodeFlex(n.flex);
      return {
        i: n.id,
        k: 'g',
        ...(flex ? {x: flex} : {}),
        c: n.children.map(encodeNode),
      };
    }
    case 'headline':
      return {i: n.id, k: 'h', ...(n.level !== 2 ? {l: n.level} : {}), v: n.value};
    case 'text':
      return {i: n.id, k: 't', ...(n.size !== 'sm' ? {s: n.size} : {}), v: n.value};
    case 'richText':
      return {i: n.id, k: 'x', ...(n.size !== 'sm' ? {s: n.size} : {}), v: n.value};
    case 'button':
      return {
        i: n.id,
        k: 'b',
        ...(n.variant !== 'primary' ? {p: n.variant} : {}),
        v: n.label,
        ...(n.href ? {h: n.href} : {}),
      };
  }
}

const LEVELS: HeadingLevel[] = [1, 2, 3, 4, 5];

function decodeNode(w: unknown): Node | undefined {
  const o = obj(w);
  if (!o) return undefined;
  const id = str(o.i);
  if (!id) return undefined;
  const size: TextSize = o.s === 'lg' ? 'lg' : 'sm';
  const value = str(o.v) ?? '';

  switch (o.k) {
    case 'g': {
      const raw = Array.isArray(o.c) ? o.c : [];
      const children: Element[] = [];
      for (const c of raw) {
        const node = decodeNode(c);
        // a group holds elements only; a nested group is dropped, not represented
        if (node && node.kind !== 'group') children.push(node);
      }
      return {id, kind: 'group', flex: decodeFlex(o.x), children} satisfies Group;
    }
    case 'h': {
      const level = LEVELS.includes(o.l as HeadingLevel)
        ? (o.l as HeadingLevel)
        : 2;
      return {id, kind: 'headline', level, value};
    }
    case 't':
      return {id, kind: 'text', size, value};
    case 'x':
      return {id, kind: 'richText', size, value};
    case 'b': {
      const variant: ButtonVariant = o.p === 'secondary' ? 'secondary' : 'primary';
      return {id, kind: 'button', variant, label: value, href: str(o.h) ?? ''};
    }
    default:
      return undefined;
  }
}

export function encode(layout: Layout): string {
  const blocks = layout.blocks.map((b) => {
    const out: Obj = {i: b.id, a: encodeCell(b.at.a)};
    for (const band of BANDS.slice(1) as Exclude<Band, 'a'>[]) {
      const cell = b.at[band];
      if (cell) out[band] = encodeCell(cell);
    }
    const fill = encodeFill(b.fill);
    if (fill) out.f = fill;
    const flex = encodeFlex(b.flex);
    if (flex) out.x = flex;
    if (b.invert) out.n = 1;
    if (b.children.length) out.k = b.children.map(encodeNode);
    return out;
  });
  return JSON.stringify({v: layout.version, b: blocks});
}

export function decode(json: string): Layout | undefined {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return undefined;
  }
  const top = obj(raw);
  if (!top || !Number.isInteger(top.v) || !Array.isArray(top.b)) return undefined;

  const blocks: Block[] = [];
  for (const w of top.b) {
    const o = obj(w);
    if (!o) return undefined;
    const id = str(o.i);
    const a = decodeCell(o.a);
    if (!id || !a) return undefined;

    const at: Block['at'] = {a};
    for (const band of BANDS.slice(1) as Exclude<Band, 'a'>[]) {
      if (o[band] === undefined) continue;
      const cell = decodeCell(o[band]);
      if (!cell) return undefined;
      at[band] = cell;
    }

    // switching this to failsafe version, if node instead of if !node return
    const children: Node[] = [];
    for (const c of Array.isArray(o.k) ? o.k : []) {
      const node = decodeNode(c);
      if (node) children.push(node);
    }

    blocks.push({
      id,
      at,
      fill: decodeFill(o.f),
      flex: decodeFlex(o.x),
      invert: o.n === 1,
      children,
    });
  }
  return {version: top.v as number, blocks};
}
