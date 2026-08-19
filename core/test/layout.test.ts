import {describe, expect, it} from 'vitest';
import {BANDS, COLUMNS, WIDEST, type Band} from '../src/bands';
import {
  add,
  cellIn,
  inBounds,
  isOverridden,
  overlaps,
  place,
  readingOrder,
  remove,
  resetToDerived,
} from '../src/layout';
import {emptyLayout, type Layout} from '../src/types';
import {block, cell, int, rng} from './random';

// only authored cells can collide; derived ones do not exist yet
const noPairOverlaps = (layout: Layout, band: Band): boolean => {
  const cells = layout.blocks
    .map((b) => cellIn(b, band))
    .filter((c): c is NonNullable<typeof c> => c !== undefined);
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      const a = cells[i];
      const b = cells[j];
      if (a && b && overlaps(a, b)) return false;
    }
  }
  return true;
};

describe('placement', () => {
  it('accepted placements always land inside the band', () => {
    for (let seed = 0; seed < 400; seed++) {
      const r = rng(seed);
      let layout = emptyLayout();
      for (let i = 0; i < 8; i++) {
        const result = add(layout, block(r, `b${i}`));
        if (result.ok) layout = result.value;
      }
      for (const band of BANDS) {
        for (const b of layout.blocks) {
          const c = cellIn(b, band);
          if (!c) continue;
          expect(inBounds(c, band), `seed ${seed} band ${band}`).toBe(true);
          expect(c.colSpan).toBeGreaterThanOrEqual(1);
          expect(c.rowSpan).toBeGreaterThanOrEqual(1);
          expect(c.col).toBeGreaterThanOrEqual(1);
          expect(c.col + c.colSpan - 1).toBeLessThanOrEqual(COLUMNS[band]);
        }
      }
    }
  });

  it('never leaves two blocks overlapping after accepted operations', () => {
    for (let seed = 0; seed < 300; seed++) {
      const r = rng(seed);
      let layout = emptyLayout();
      for (let i = 0; i < 10; i++) {
        const result = add(layout, block(r, `b${i}`));
        if (result.ok) layout = result.value;
      }
      for (let i = 0; i < 20; i++) {
        const band = BANDS[int(r, 0, BANDS.length - 1)] as Band;
        const target = layout.blocks[int(r, 0, layout.blocks.length - 1)];
        if (!target) continue;
        const result = place(layout, target.id, band, cell(r, band));
        if (result.ok) layout = result.value;
      }
      for (const band of BANDS) {
        expect(noPairOverlaps(layout, band), `seed ${seed} band ${band}`).toBe(
          true,
        );
      }
    }
  });

  it('rejects a cell that runs past the last column', () => {
    const r = rng(1);
    const seeded = add(emptyLayout(), block(r, 'x'));
    expect(seeded.ok).toBe(true);
    if (!seeded.ok) return;
    const past = {col: COLUMNS.c, colSpan: 2, row: 1, rowSpan: 1};
    const result = place(seeded.value, 'x', 'c', past);
    expect(result).toEqual({ok: false, reason: 'out-of-bounds'});
  });

  it('rejects zero and fractional spans', () => {
    const r = rng(2);
    const seeded = add(emptyLayout(), block(r, 'x'));
    if (!seeded.ok) return;
    for (const bad of [
      {col: 1, colSpan: 0, row: 1, rowSpan: 1},
      {col: 1, colSpan: 1, row: 0, rowSpan: 1},
      {col: 1, colSpan: 1, row: 1, rowSpan: 0},
      {col: 1.5, colSpan: 1, row: 1, rowSpan: 1},
    ]) {
      expect(place(seeded.value, 'x', 'a', bad)).toEqual({
        ok: false,
        reason: 'bad-span',
      });
    }
  });

  it('reports which block a rejected drop hit', () => {
    const one = {
      id: 'one',
      type: 'rule' as const,
      content: {kind: 'none' as const},
      at: {a: {col: 1, colSpan: 4, row: 1, rowSpan: 2}},
    };
    const two = {
      ...one,
      id: 'two',
      at: {a: {col: 6, colSpan: 2, row: 1, rowSpan: 1}},
    };
    let layout = emptyLayout();
    for (const b of [one, two]) {
      const r = add(layout, b);
      if (r.ok) layout = r.value;
    }
    const result = place(layout, 'two', 'a', {
      col: 2,
      colSpan: 2,
      row: 1,
      rowSpan: 1,
    });
    expect(result).toEqual({ok: false, reason: 'overlap', with: 'one'});
  });

  it('rejects placing a block that does not exist', () => {
    expect(
      place(emptyLayout(), 'ghost', 'a', {
        col: 1,
        colSpan: 1,
        row: 1,
        rowSpan: 1,
      }),
    ).toEqual({ok: false, reason: 'no-such-block'});
  });
});

describe('bands', () => {
  it('falls back to the widest band until overridden', () => {
    const r = rng(3);
    const b = block(r, 'x');
    const bare = {...b, at: {a: b.at.a}};
    expect(cellIn(bare, 'a')).toEqual(bare.at.a);
    for (const band of BANDS.slice(1)) {
      expect(cellIn(bare, band as Band)).toBeUndefined();
      expect(isOverridden(bare, band as Band)).toBe(false);
    }
  });

  it('reset drops the override and restores the derived cell', () => {
    const start: Layout = {
      version: 1,
      blocks: [
        {
          id: 'x',
          type: 'text',
          content: {kind: 'none'},
          at: {
            a: {col: 1, colSpan: 2, row: 1, rowSpan: 1},
            c: {col: 1, colSpan: 4, row: 9, rowSpan: 3},
          },
        },
      ],
    };
    const after = resetToDerived(start, 'x', 'c');
    expect(isOverridden(after.blocks[0]!, 'c')).toBe(false);
    expect(cellIn(after.blocks[0]!, 'c')).toBeUndefined();
    expect(start.blocks[0]!.at.c).toBeDefined();
  });

  it('reset on the widest band is a no-op', () => {
    const start: Layout = {
      version: 1,
      blocks: [
        {
          id: 'x',
          type: 'text',
          content: {kind: 'none'},
          at: {a: {col: 1, colSpan: 2, row: 1, rowSpan: 1}},
        },
      ],
    };
    expect(resetToDerived(start, 'x', WIDEST)).toBe(start);
  });

  it('delete is global', () => {
    const r = rng(4);
    let layout = emptyLayout();
    for (let i = 0; i < 5; i++) {
      const result = add(layout, block(r, `b${i}`));
      if (result.ok) layout = result.value;
    }
    const victim = layout.blocks[2]!.id;
    const after = remove(layout, victim);
    expect(after.blocks.some((b) => b.id === victim)).toBe(false);
    expect(readingOrder(after).some((b) => b.id === victim)).toBe(false);
  });
});

describe('reading order', () => {
  it('sorts by row, then column, then id', () => {
    const mk = (id: string, col: number, row: number) => ({
      id,
      type: 'rule' as const,
      content: {kind: 'none' as const},
      at: {a: {col, colSpan: 1, row, rowSpan: 1}},
    });
    const layout: Layout = {
      version: 1,
      blocks: [mk('z', 5, 2), mk('a', 1, 2), mk('m', 3, 1), mk('b', 1, 2)],
    };
    expect(readingOrder(layout).map((b) => b.id)).toEqual(['m', 'a', 'b', 'z']);
  });
});
