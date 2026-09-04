import {COLUMNS, type Band} from '../src/bands';
import {
  BUTTON_VARIANTS,
  divisorsOf,
  emptyBlock,
  type Block,
  type Cell,
  type Colour,
  type Flex,
  type Layout,
  type Node,
  type Slot,
} from '../src/types';

// mulberry32. seeded so any failing case is reproducible from its seed alone.
export function rng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export const int = (r: () => number, lo: number, hi: number): number =>
  lo + Math.floor(r() * (hi - lo + 1));

export function cell(r: () => number, band: Band): Cell {
  const cols = COLUMNS[band];
  const colSpan = int(r, 1, cols);
  return {
    col: int(r, 1, cols - colSpan + 1),
    colSpan,
    row: int(r, 1, 40),
    rowSpan: int(r, 1, 6),
  };
}

const colour = (n: number): Colour =>
  n % 2 === 0
    ? {slot: ((n % 5) + 1) as Slot}
    : {hex: `#${n.toString(16).padStart(6, '0')}`};

export function flex(r: () => number): Flex {
  return {
    direction: r() < 0.5 ? 'row' : 'column',
    justify: (['start', 'center', 'end', 'between'] as const)[int(r, 0, 3)] ?? 'start',
    align: (['start', 'center', 'end', 'stretch'] as const)[int(r, 0, 3)] ?? 'stretch',
    gap: int(r, 0, 6),
  };
}

export function element(
  r: () => number,
  id: string,
): Extract<
  Node,
  {
    kind:
      | 'headline'
      | 'text'
      | 'richText'
      | 'button'
      | 'menu'
      | 'product'
      | 'collection'
      | 'cart'
      | 'account'
      | 'logo'
      | 'rating';
  }
> {
  const s = `v${int(r, 0, 9999)} — ünïcode "quotes"`;
  const pick = int(r, 0, 10);
  if (pick === 0) {
    return {id, kind: 'headline', level: int(r, 1, 5) as 1 | 2 | 3 | 4 | 5, value: s};
  }
  if (pick === 1) return {id, kind: 'text', size: r() < 0.5 ? 'lg' : 'sm', value: s};
  if (pick === 2) return {id, kind: 'richText', size: r() < 0.5 ? 'lg' : 'sm', value: s};
  if (pick === 3) {
    return {
      id,
      kind: 'button',
      // every variant, so the wire has to carry each of them
      variant: BUTTON_VARIANTS[int(r, 0, BUTTON_VARIANTS.length - 1)]!,
      label: s,
      href: r() < 0.5 ? `/x/${int(r, 0, 99)}` : '',
    };
  }
  if (pick === 4) {
    return {
      id,
      kind: 'menu',
      handle: r() < 0.5 ? `menu-${int(r, 0, 9)}` : '',
      direction: r() < 0.5 ? 'row' : 'column',
      collapse: r() < 0.5,
    };
  }
  if (pick === 5) {
    return {id, kind: 'cart', label: s};
  }
  if (pick === 8) {
    return {id, kind: 'logo', width: int(r, 2, 100), narrow: int(r, 2, 100)};
  }
  if (pick === 9) {
    return {
      id,
      kind: 'rating',
      stars: int(r, 1, 5),
      label: s,
      // both shapes and absent, because all three have to survive the wire
      ...(r() < 0.66
        ? {colour: r() < 0.5 ? {slot: int(r, 1, 5) as Slot} : {hex: '#a1b2c3'}}
        : {}),
    };
  }
  if (pick === 6) {
    return {id, kind: 'account', label: s};
  }
  if (pick === 7) {
    return {
      id,
      kind: 'product',
      view: r() < 0.5 ? 'media' : 'details',
      source: r() < 0.5 ? 'context' : {handle: `p-${int(r, 0, 99)}`},
      variant: BUTTON_VARIANTS[int(r, 0, BUTTON_VARIANTS.length - 1)]!,
    };
  }
  const columns = int(r, 1, 6) as 1 | 2 | 3 | 4 | 5 | 6;
  const legal = divisorsOf(columns);
  return {
    id,
    kind: 'collection',
    source: r() < 0.5 ? 'context' : {handle: `c-${int(r, 0, 99)}`},
    columns,
    // a divisor, for the same reason the count is a whole number of rows: the
    // model is never allowed to hold a grid that ragged one of its bands
    narrow: legal[int(r, 0, legal.length - 1)]!,
    // only ever generated as a whole number of rows, because that is the only
    // state the model is allowed to hold
    count: columns * int(r, 1, 8),
    variant: BUTTON_VARIANTS[int(r, 0, BUTTON_VARIANTS.length - 1)]!,
  };
}

export function children(r: () => number, id: string): Node[] {
  return Array.from({length: int(r, 0, 3)}, (_, i) => {
    if (r() < 0.3) {
      return {
        id: `${id}-g${i}`,
        kind: 'group' as const,
        flex: flex(r),
        // capped and uncapped, because both have to survive the wire
        ...(r() < 0.5 ? {width: int(r, 10, 100)} : {}),
        children: Array.from({length: int(r, 0, 2)}, (_, j) =>
          element(r, `${id}-g${i}-e${j}`),
        ),
      };
    }
    return element(r, `${id}-e${i}`);
  });
}

export function block(r: () => number, id: string): Block {
  const at: Block['at'] = {a: cell(r, 'a')};
  if (r() < 0.5) at.b = cell(r, 'b');
  if (r() < 0.5) at.c = cell(r, 'c');
  return {
    ...emptyBlock(id, at),
    fill:
      r() < 0.5
        ? {}
        : {
            // one draw, split two ways. an extra r() here shifts every value
            // after it, and seeded layouts are fixtures other tests rely on.
            color: colour(int(r, 0, 0xffffff)),
            ...(r() < 0.5
              ? {
                  media: {
                    kind: r() < 0.5 ? ('image' as const) : ('video' as const),
                    // both shapes, because both have to survive the wire
                    ...(int(r, 0, 1)
                      ? {id: `gid://shopify/MediaImage/${int(r, 0, 999)}`}
                      : {src: `https://cdn.test/${int(r, 0, 999)}.jpg`}),
                  },
                }
              : {}),
            ...(r() < 0.5
              ? {overlay: {color: {hex: '#000000'}, opacity: int(r, 0, 100) / 100}}
              : {}),
          },
    flex: flex(r),
    invert: r() < 0.5,
    children: children(r, id),
  };
}

export function layout(r: () => number, count: number): Layout {
  return {
    version: int(r, 1, 50),
    blocks: Array.from({length: count}, (_, i) => block(r, `b${i}`)),
  };
}

// dense layouts, non-overlapping by construction: stack each block below
// whatever already occupies its columns, leaving a random gap. random cells
// collide so often that add() rejects most, which makes for a weak fuzz.
export function densePacked(r: () => number, count: number): Layout {
  const cols = COLUMNS.a;
  const nextFree = new Array<number>(cols + 1).fill(1);
  const blocks: Layout['blocks'] = [];
  for (let i = 0; i < count; i++) {
    const colSpan = int(r, 1, Math.min(6, cols));
    const col = int(r, 1, cols - colSpan + 1);
    let row = 1;
    for (let c = col; c < col + colSpan; c++)
      row = Math.max(row, nextFree[c] ?? 1);
    row += int(r, 0, 3);
    const rowSpan = int(r, 1, 5);
    for (let c = col; c < col + colSpan; c++) nextFree[c] = row + rowSpan;
    blocks.push(emptyBlock(`b${i}`, {a: {col, colSpan, row, rowSpan}}));
  }
  return {version: 1, blocks};
}
