import {describe, expect, it} from 'vitest';
import {BANDS, COLUMNS, WIDEST, type Band} from '../src/bands';
import {derive} from '../src/derive';
import {insertAfter} from '../src/insert';
import {overlaps, readingOrder, resetToDerived} from '../src/layout';
import {emptyBlock, type Block, type Cell, type Layout} from '../src/types';
import {densePacked, int, rng} from './random';

const clean = (cells: Iterable<Cell>): boolean => {
  const all = [...cells];
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i];
      const b = all[j];
      if (a && b && overlaps(a, b)) return false;
    }
  }
  return true;
};

// materialise a band's derived cells as overrides, so the whole band is hand-placed
const freeze = (layout: Layout, band: Band): Layout => {
  const cells = derive(layout, band);
  return {
    ...layout,
    blocks: layout.blocks.map((b) => ({
      ...b,
      at: {...b.at, [band]: cells.get(b.id)},
    })),
  };
};

// band a is authored, never overridden, so this only applies to narrow bands
const withOverrides = (layout: Layout, band: Band, seed: number): Layout => {
  if (band === WIDEST) return layout;
  const r = rng(seed);
  const full = COLUMNS[band];
  return {
    ...layout,
    blocks: layout.blocks.map((b, i) =>
      r() < 0.25
        ? {
            ...b,
            at: {
              ...b.at,
              [band]: {col: 1, colSpan: full, row: 1 + i * 7, rowSpan: 2},
            },
          }
        : b,
    ),
  };
};

describe('derivation', () => {
  it('is the widest band unchanged', () => {
    for (let seed = 0; seed < 100; seed++) {
      const layout = densePacked(rng(seed), 10);
      const cells = derive(layout, WIDEST);
      for (const b of layout.blocks) expect(cells.get(b.id)).toEqual(b.at.a);
    }
  });

  it('stacks band c full width, in reading order', () => {
    const layout = densePacked(rng(5), 12);
    const cells = derive(layout, 'c');
    let previousEnd = 0;
    for (const b of readingOrder(layout)) {
      const c = cells.get(b.id);
      expect(c).toBeDefined();
      if (!c) continue;
      expect(c.col).toBe(1);
      expect(c.colSpan).toBe(COLUMNS.c);
      expect(c.row).toBeGreaterThanOrEqual(previousEnd);
      previousEnd = c.row + c.rowSpan;
    }
  });

  it('lays band b into two tracks, keeping wide blocks full width', () => {
    const layout = densePacked(rng(5), 12);
    const cells = derive(layout, 'b');
    const half = COLUMNS.a / 2;
    for (const b of layout.blocks) {
      const c = cells.get(b.id);
      expect(c).toBeDefined();
      if (!c) continue;
      if (b.at.a.colSpan > half) {
        expect(c).toMatchObject({col: 1, colSpan: COLUMNS.b});
      } else {
        expect(c.colSpan).toBe(COLUMNS.b / 2);
        expect([1, COLUMNS.b / 2 + 1]).toContain(c.col);
      }
    }
  });

  // the two bands were the same layout at two sizes before tracks existed
  it('gives band b a different composition from band c', () => {
    const mk = (id: string, col: number, colSpan: number, row: number): Block =>
      emptyBlock(id, {a: {col, colSpan, row, rowSpan: 2}});
    const layout: Layout = {
      version: 1,
      blocks: [mk('left', 1, 4, 1), mk('right', 5, 4, 1)],
    };
    expect(derive(layout, 'b').get('right')).toEqual({
      col: 5,
      colSpan: 4,
      row: 1,
      rowSpan: 2,
    });
    expect(derive(layout, 'c').get('right')).toEqual({
      col: 1,
      colSpan: 4,
      row: 3,
      rowSpan: 2,
    });
  });

  it('fills the track beside a hand-placed block rather than reserving its rows', () => {
    const mk = (id: string, col: number, colSpan: number, row: number): Block =>
      emptyBlock(id, {a: {col, colSpan, row, rowSpan: 2}});
    const pinned = mk('pinned', 1, 4, 1);
    pinned.at.b = {col: 1, colSpan: 4, row: 1, rowSpan: 2};
    const layout: Layout = {
      version: 1,
      blocks: [pinned, mk('next', 5, 4, 1)],
    };
    // beside the override, not below it
    expect(derive(layout, 'b').get('next')).toEqual({
      col: 5,
      colSpan: 4,
      row: 1,
      rowSpan: 2,
    });
  });

  it('never overlaps, with or without overrides', () => {
    for (let seed = 0; seed < 500; seed++) {
      const base = densePacked(rng(seed), int(rng(seed), 3, 14));
      for (const band of BANDS) {
        const layout = withOverrides(base, band, seed);
        expect(
          clean(derive(layout, band).values()),
          `seed ${seed} ${band}`,
        ).toBe(true);
      }
    }
  });

  it('is a pure function of the wide band and the override set', () => {
    for (let seed = 0; seed < 200; seed++) {
      const layout = withOverrides(densePacked(rng(seed), 10), 'c', seed);
      expect(derive(layout, 'c')).toEqual(derive(layout, 'c'));
    }
  });

  it('re-deriving a derived band is a no-op', () => {
    for (let seed = 0; seed < 200; seed++) {
      const layout = withOverrides(densePacked(rng(seed), 10), 'c', seed);
      const once = derive(layout, 'c');
      const twice = derive(freeze(layout, 'c'), 'c');
      expect(twice, `seed ${seed}`).toEqual(once);
    }
  });

  it('leaves overridden blocks exactly where they were put', () => {
    const layout = withOverrides(densePacked(rng(9), 10), 'c', 9);
    const cells = derive(layout, 'c');
    for (const b of layout.blocks) {
      const override = b.at.c;
      if (override) expect(cells.get(b.id)).toEqual(override);
    }
  });

  it('flows derived blocks around a hand-placed one', () => {
    const mk = (id: string, row: number, rowSpan: number): Block =>
      emptyBlock(id, {a: {col: 1, colSpan: 4, row, rowSpan}});
    const pinned = mk('pinned', 3, 1);
    pinned.at.c = {col: 1, colSpan: 4, row: 1, rowSpan: 3};
    const layout: Layout = {
      version: 1,
      blocks: [mk('first', 1, 2), mk('second', 2, 1), pinned],
    };
    const cells = derive(layout, 'c');
    expect(cells.get('pinned')).toEqual({
      col: 1,
      colSpan: 4,
      row: 1,
      rowSpan: 3,
    });
    // derived blocks start after the pinned rows rather than under them
    expect(cells.get('first')).toEqual({
      col: 1,
      colSpan: 4,
      row: 4,
      rowSpan: 2,
    });
    expect(cells.get('second')).toEqual({
      col: 1,
      colSpan: 4,
      row: 6,
      rowSpan: 1,
    });
  });

  it('editing a narrow band never changes the wide band', () => {
    const before = densePacked(rng(21), 10);
    const after = withOverrides(before, 'c', 21);
    for (const b of after.blocks) {
      const original = before.blocks.find((x) => x.id === b.id);
      expect(b.at.a).toEqual(original?.at.a);
    }
    expect(derive(after, WIDEST)).toEqual(derive(before, WIDEST));
  });

  it('reset returns a block to the derived flow', () => {
    const layout = withOverrides(densePacked(rng(33), 8), 'c', 33);
    const pinned = layout.blocks.find((b) => b.at.c);
    expect(pinned).toBeDefined();
    if (!pinned) return;
    const after = resetToDerived(layout, pinned.id, 'c');
    const cells = derive(after, 'c');
    expect(cells.get(pinned.id)?.colSpan).toBe(COLUMNS.c);
    expect(after.blocks.find((b) => b.id === pinned.id)?.at.c).toBeUndefined();
  });
});

describe('every band', () => {
  it('derives without overlap', () => {
    for (let seed = 0; seed < 500; seed++) {
      const r = rng(seed);
      const layout = withOverrides(densePacked(r, int(r, 3, 14)), 'c', seed);
      for (const band of BANDS) {
        expect(
          clean(derive(layout, band).values()),
          `seed ${seed} band ${band}`,
        ).toBe(true);
      }
    }
  });

  it('gives every block a cell in every band', () => {
    const layout = densePacked(rng(4), 10);
    for (const band of BANDS) {
      expect(derive(layout, band).size).toBe(layout.blocks.length);
    }
  });

  // clipping, not growth: a band renders exactly the span that was authored
  it('renders the authored span, never a larger one', () => {
    const layout = withOverrides(densePacked(rng(7), 12), 'c', 7);
    for (const b of layout.blocks) {
      expect(derive(layout, WIDEST).get(b.id)).toEqual(b.at.a);
      const override = b.at.c;
      if (override) expect(derive(layout, 'c').get(b.id)).toEqual(override);
    }
  });
});

describe('insert from a narrow band', () => {
  const mk = (id: string, col: number, colSpan: number, row: number): Block =>
    emptyBlock(id, {a: {col, colSpan, row, rowSpan: 2}});

  it('inherits the predecessor column and span, directly below it', () => {
    const layout: Layout = {version: 1, blocks: [mk('pred', 5, 3, 4)]};
    const after = insertAfter(
      layout,
      {id: 'new', rowSpan: 2},
      'pred',
    );
    expect(after.blocks.find((b) => b.id === 'new')?.at.a).toEqual({
      col: 5,
      colSpan: 3,
      row: 6,
      rowSpan: 2,
    });
  });

  it('steps past a taken slot instead of displacing it', () => {
    const layout: Layout = {
      version: 1,
      blocks: [
        mk('pred', 1, 4, 1),
        mk('under', 1, 4, 3),
        mk('beside', 6, 4, 3),
      ],
    };
    const after = insertAfter(
      layout,
      {id: 'new', rowSpan: 2},
      'pred',
    );
    // `under` occupies rows 3-4, so the newcomer starts below it and nothing moves
    expect(after.blocks.find((b) => b.id === 'new')?.at.a.row).toBe(5);
    expect(after.blocks.find((b) => b.id === 'under')?.at.a.row).toBe(3);
    expect(after.blocks.find((b) => b.id === 'beside')?.at.a.row).toBe(3);
  });

  it('leaves the layout clean after inserting', () => {
    for (let seed = 0; seed < 200; seed++) {
      const layout = densePacked(rng(seed), 8);
      const pred = layout.blocks[int(rng(seed), 0, layout.blocks.length - 1)];
      if (!pred) continue;
      const after = insertAfter(
        layout,
        {id: 'new', rowSpan: 2},
        pred.id,
      );
      expect(clean(after.blocks.map((b) => b.at.a)), `seed ${seed}`).toBe(true);
    }
  });
});
