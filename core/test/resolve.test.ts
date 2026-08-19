import {describe, expect, it} from 'vitest';
import {BANDS, type Band} from '../src/bands';
import {add, overlaps} from '../src/layout';
import {pushes, resolve, resolveCells, type Measurements} from '../src/resolve';
import {emptyLayout, type Cell, type Layout} from '../src/types';
import {block, int, rng} from './random';

const cell = (
  col: number,
  colSpan: number,
  row: number,
  rowSpan: number,
): Cell => ({
  col,
  colSpan,
  row,
  rowSpan,
});

function noOverlaps(cells: Iterable<Cell>): {ok: boolean; a?: Cell; b?: Cell} {
  const all = [...cells];
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i];
      const b = all[j];
      if (a && b && overlaps(a, b)) return {ok: false, a, b};
    }
  }
  return {ok: true};
}

// a layout built only from accepted adds, so authored positions never overlap
function randomLayout(seed: number, count: number): Layout {
  const r = rng(seed);
  let layout = emptyLayout();
  for (let i = 0; i < count; i++) {
    const result = add(layout, block(r, `b${i}`));
    if (result.ok) layout = result.value;
  }
  return layout;
}

function randomMeasurements(seed: number, layout: Layout): Measurements {
  const r = rng(seed * 7919 + 1);
  const m: Record<string, number> = {};
  for (const b of layout.blocks) {
    if (r() < 0.5) m[b.id] = int(r, 1, 14);
  }
  return m;
}

describe('the resolver', () => {
  it('never leaves two blocks overlapping', () => {
    for (let seed = 0; seed < 500; seed++) {
      const layout = randomLayout(seed, 10);
      const measurements = randomMeasurements(seed, layout);
      for (const band of BANDS) {
        const resolved = resolveCells(
          new Map(
            layout.blocks
              .map((b) => [b.id, b.at[band === 'a' ? 'a' : band]] as const)
              .filter((e): e is readonly [string, Cell] => e[1] !== undefined),
          ),
          measurements,
        );
        const check = noOverlaps(resolved.values());
        expect(
          check.ok,
          `seed ${seed} band ${band} ${JSON.stringify(check)}`,
        ).toBe(true);
      }
    }
  });

  it('always converges', () => {
    for (let seed = 0; seed < 500; seed++) {
      const layout = randomLayout(seed, 12);
      expect(() =>
        resolve(layout, 'a', randomMeasurements(seed, layout)),
      ).not.toThrow();
    }
  });

  it('lands every block on whole row units', () => {
    for (let seed = 0; seed < 200; seed++) {
      const layout = randomLayout(seed, 8);
      const resolved = resolve(layout, 'a', randomMeasurements(seed, layout));
      for (const c of resolved.values()) {
        expect(Number.isInteger(c.row)).toBe(true);
        expect(Number.isInteger(c.rowSpan)).toBe(true);
        expect(c.row).toBeGreaterThanOrEqual(1);
        expect(c.rowSpan).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('is a no-op when nothing needs more rows than it has', () => {
    for (let seed = 0; seed < 200; seed++) {
      const layout = randomLayout(seed, 10);
      const resolved = resolve(layout, 'a', {});
      for (const b of layout.blocks) {
        expect(resolved.get(b.id), `seed ${seed}`).toEqual(b.at.a);
      }
    }
  });

  it('returns blocks to their authored positions exactly when text shrinks', () => {
    for (let seed = 0; seed < 200; seed++) {
      const layout = randomLayout(seed, 10);
      // grow, then shrink back to nothing
      resolve(layout, 'a', randomMeasurements(seed, layout));
      const back = resolve(layout, 'a', {});
      for (const b of layout.blocks) {
        expect(back.get(b.id), `seed ${seed}`).toEqual(b.at.a);
      }
    }
  });
});

describe('push rules', () => {
  it('moves only column-overlapping blocks below the growth point', () => {
    const cells = new Map<string, Cell>([
      ['grower', cell(1, 4, 1, 2)],
      ['below', cell(1, 4, 5, 2)],
      ['beside', cell(6, 4, 5, 2)],
    ]);
    const resolved = resolveCells(cells, {grower: 5});

    expect(resolved.get('grower')).toEqual(cell(1, 4, 1, 5));
    // pushed by exactly the delta of 3, gap of 2 rows preserved
    expect(resolved.get('below')).toEqual(cell(1, 4, 8, 2));
    // untouched: columns never meet
    expect(resolved.get('beside')).toEqual(cell(6, 4, 5, 2));
  });

  it('preserves deliberate air rather than repacking', () => {
    const cells = new Map<string, Cell>([
      ['top', cell(1, 4, 1, 2)],
      ['far', cell(1, 4, 20, 2)],
    ]);
    const resolved = resolveCells(cells, {});
    expect(resolved.get('far')).toEqual(cell(1, 4, 20, 2));

    const grown = resolveCells(cells, {top: 4});
    // gap of 17 rows is kept, not closed
    expect(grown.get('far')).toEqual(cell(1, 4, 22, 2));
  });

  it('cascades through a chain of pushes', () => {
    const cells = new Map<string, Cell>([
      ['a', cell(1, 4, 1, 1)],
      ['b', cell(1, 4, 2, 1)],
      ['c', cell(1, 4, 3, 1)],
    ]);
    // a grows by 2, b grows by 1 -> c moves by 3
    const resolved = resolveCells(cells, {a: 3, b: 2});
    expect(resolved.get('a')).toEqual(cell(1, 4, 1, 3));
    expect(resolved.get('b')).toEqual(cell(1, 4, 4, 2));
    expect(resolved.get('c')).toEqual(cell(1, 4, 6, 1));
  });

  it('drags every column stack a multi-column block touches', () => {
    const cells = new Map<string, Cell>([
      ['wide', cell(1, 8, 1, 1)],
      ['leftStack', cell(1, 2, 2, 1)],
      ['rightStack', cell(7, 2, 2, 1)],
      ['outside', cell(10, 2, 2, 1)],
    ]);
    const resolved = resolveCells(cells, {wide: 4});
    expect(resolved.get('leftStack')).toEqual(cell(1, 2, 5, 1));
    expect(resolved.get('rightStack')).toEqual(cell(7, 2, 5, 1));
    expect(resolved.get('outside')).toEqual(cell(10, 2, 2, 1));
  });

  it('does not push a block that starts before the growth point', () => {
    const cells = new Map<string, Cell>([
      ['grower', cell(1, 4, 5, 2)],
      ['aboveIt', cell(1, 4, 1, 2)],
    ]);
    const resolved = resolveCells(cells, {grower: 6});
    expect(resolved.get('aboveIt')).toEqual(cell(1, 4, 1, 2));
  });

  it('takes the largest push when several apply, not their sum', () => {
    const cells = new Map<string, Cell>([
      ['one', cell(1, 4, 1, 1)],
      ['two', cell(3, 4, 1, 1)],
      ['under', cell(3, 2, 4, 1)],
    ]);
    // both grow by 2 and both push `under`; it moves by 2, not 4
    const resolved = resolveCells(cells, {one: 3, two: 3});
    expect(resolved.get('under')).toEqual(cell(3, 2, 6, 1));
  });

  it('ignores a measurement smaller than the authored span', () => {
    const cells = new Map<string, Cell>([['x', cell(1, 4, 1, 6)]]);
    expect(resolveCells(cells, {x: 2})).toEqual(
      new Map([['x', cell(1, 4, 1, 6)]]),
    );
  });

  it('has no cap on growth', () => {
    const cells = new Map<string, Cell>([
      ['essay', cell(1, 4, 1, 2)],
      ['after', cell(1, 4, 4, 1)],
    ]);
    const resolved = resolveCells(cells, {essay: 900});
    expect(resolved.get('essay')?.rowSpan).toBe(900);
    expect(resolved.get('after')?.row).toBe(902);
  });

  it('pushes() is the authored relation, unaffected by growth', () => {
    expect(pushes(cell(1, 4, 1, 2), cell(1, 4, 3, 1))).toBe(true);
    expect(pushes(cell(1, 4, 1, 2), cell(1, 4, 2, 1))).toBe(false);
    expect(pushes(cell(1, 4, 1, 2), cell(5, 4, 3, 1))).toBe(false);
  });
});

describe('resolver fuzz', () => {
  it('holds no-overlap over a hard random sweep', () => {
    let checked = 0;
    for (let seed = 0; seed < 2000; seed++) {
      const layout = randomLayout(seed, int(rng(seed), 2, 14));
      const measurements = randomMeasurements(seed, layout);
      const resolved = resolve(layout, 'a', measurements);
      const check = noOverlaps(resolved.values());
      expect(
        check.ok,
        `seed ${seed}: ${JSON.stringify(check.a)} vs ${JSON.stringify(check.b)}`,
      ).toBe(true);
      checked += resolved.size;
    }
    expect(checked).toBeGreaterThan(5_000);
  });

  it('holds across every band', () => {
    for (let seed = 0; seed < 300; seed++) {
      const layout = randomLayout(seed, 10);
      const measurements = randomMeasurements(seed, layout);
      for (const band of BANDS) {
        const resolved = resolve(layout, band as Band, measurements);
        expect(noOverlaps(resolved.values()).ok, `seed ${seed} ${band}`).toBe(
          true,
        );
      }
    }
  });
});
