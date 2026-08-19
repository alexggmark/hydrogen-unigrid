import {describe, expect, it} from 'vitest';
import {BANDS, COLUMNS, WIDEST, type Band} from '../src/bands';
import {derive} from '../src/derive';
import {insertAfter} from '../src/insert';
import {overlaps, readingOrder, resetToDerived} from '../src/layout';
import {resolve} from '../src/resolve';
import type {Block, Cell, Layout} from '../src/types';
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

  it('stacks every derived block full width, in reading order', () => {
    const layout = densePacked(rng(5), 12);
    for (const band of ['b', 'c'] as Band[]) {
      const cells = derive(layout, band);
      const order = readingOrder(layout);
      let previousEnd = 0;
      for (const b of order) {
        const c = cells.get(b.id);
        expect(c).toBeDefined();
        if (!c) continue;
        expect(c.col).toBe(1);
        expect(c.colSpan).toBe(COLUMNS[band]);
        expect(c.row).toBeGreaterThanOrEqual(previousEnd);
        previousEnd = c.row + c.rowSpan;
      }
    }
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
    const mk = (id: string, row: number, rowSpan: number): Block => ({
      id,
      type: 'text',
      content: {kind: 'none'},
      at: {a: {col: 1, colSpan: 4, row, rowSpan}},
    });
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

describe('resolution over derived bands', () => {
  it('resolves every band without overlap', () => {
    for (let seed = 0; seed < 500; seed++) {
      const r = rng(seed);
      const layout = withOverrides(densePacked(r, int(r, 3, 14)), 'c', seed);
      const m: Record<string, number> = {};
      for (const b of layout.blocks) if (r() < 0.6) m[b.id] = int(r, 1, 20);
      for (const band of BANDS) {
        expect(
          clean(resolve(layout, band, m).values()),
          `seed ${seed} band ${band}`,
        ).toBe(true);
      }
    }
  });

  it('gives every block a cell in every band', () => {
    const layout = densePacked(rng(4), 10);
    for (const band of BANDS) {
      const resolved = resolve(layout, band, {});
      expect(resolved.size).toBe(layout.blocks.length);
    }
  });
});

describe('insert from a narrow band', () => {
  const mk = (
    id: string,
    col: number,
    colSpan: number,
    row: number,
  ): Block => ({
    id,
    type: 'text',
    content: {kind: 'none'},
    at: {a: {col, colSpan, row, rowSpan: 2}},
  });

  it('inherits the predecessor column and span, directly below it', () => {
    const layout: Layout = {version: 1, blocks: [mk('pred', 5, 3, 4)]};
    const after = insertAfter(
      layout,
      {id: 'new', type: 'text', content: {kind: 'none'}, rowSpan: 2},
      'pred',
    );
    expect(after.blocks.find((b) => b.id === 'new')?.at.a).toEqual({
      col: 5,
      colSpan: 3,
      row: 6,
      rowSpan: 2,
    });
  });

  it('pushes the column stack down when the slot is taken', () => {
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
      {id: 'new', type: 'text', content: {kind: 'none'}, rowSpan: 2},
      'pred',
    );
    expect(after.blocks.find((b) => b.id === 'new')?.at.a.row).toBe(3);
    expect(after.blocks.find((b) => b.id === 'under')?.at.a.row).toBe(5);
    expect(after.blocks.find((b) => b.id === 'beside')?.at.a.row).toBe(3);
  });

  it('leaves the layout clean after inserting', () => {
    for (let seed = 0; seed < 200; seed++) {
      const layout = densePacked(rng(seed), 8);
      const pred = layout.blocks[int(rng(seed), 0, layout.blocks.length - 1)];
      if (!pred) continue;
      const after = insertAfter(
        layout,
        {id: 'new', type: 'text', content: {kind: 'none'}, rowSpan: 2},
        pred.id,
      );
      expect(clean(after.blocks.map((b) => b.at.a)), `seed ${seed}`).toBe(true);
    }
  });
});
