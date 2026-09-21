import {describe, expect, it} from 'vitest';
import {BANDS, type Band} from '../src/bands';
import {derive} from '../src/derive';
import {duplicate, insertRow} from '../src/insert';
import {add, cellIn, overlaps, readingOrder} from '../src/layout';
import {emptyLayout, isGroup, type Block, type Layout, type Node} from '../src/types';
import {block, densePacked, int, rng} from './random';

const clean = (layout: Layout, band: Band): boolean => {
  const cells = layout.blocks
    .map((b) => cellIn(b, band))
    .filter((c): c is NonNullable<typeof c> => c !== undefined);
  return cells.every((a, i) => cells.slice(i + 1).every((b) => !overlaps(a, b)));
};

const ids = (layout: Layout): string[] =>
  layout.blocks.flatMap((b) => [
    b.id,
    ...b.children.flatMap((n) => (isGroup(n) ? [n.id, ...n.children.map((c) => c.id)] : [n.id])),
  ]);

// content with every id blanked, so a copy can be compared with its original
const shape = (nodes: Node[]): unknown =>
  nodes.map((n) =>
    isGroup(n)
      ? {...n, id: '', children: n.children.map((c) => ({...c, id: ''}))}
      : {...n, id: ''},
  );

// random blocks with content and narrow overrides, kept only where legal
const populated = (seed: number): Layout => {
  const r = rng(seed);
  let layout = emptyLayout();
  for (let i = 0; i < 12; i++) {
    const result = add(layout, block(r, `b${i}`));
    if (result.ok) layout = result.value;
  }
  return layout;
};

describe('duplicate', () => {
  it('adds one legal block, and moves only what starts below the original', () => {
    for (let seed = 0; seed < 400; seed++) {
      const before = populated(seed);
      if (!before.blocks.length) continue;
      const r = rng(seed + 1);
      const target = before.blocks[int(r, 0, before.blocks.length - 1)]!;
      const out = duplicate(before, target.id);
      expect(out, `seed ${seed}`).toBeDefined();
      const after = out!.layout;

      expect(after.blocks.length).toBe(before.blocks.length + 1);
      for (const band of BANDS) expect(clean(after, band), `seed ${seed} ${band}`).toBe(true);
      const line = target.at.a.row + target.at.a.rowSpan;
      for (const b of before.blocks) {
        const moved = b.at.a.row >= line ? target.at.a.rowSpan : 0;
        expect(after.blocks.find((x) => x.id === b.id), `seed ${seed} ${b.id}`).toEqual({
          ...b,
          at: {...b.at, a: {...b.at.a, row: b.at.a.row + moved}},
        });
      }
      const all = ids(after);
      expect(new Set(all).size, `seed ${seed}`).toBe(all.length);
    }
  });

  it('copies content and wide-band size, directly below the original', () => {
    for (let seed = 0; seed < 400; seed++) {
      const before = populated(seed);
      if (!before.blocks.length) continue;
      const target = before.blocks[0]!;
      const out = duplicate(before, target.id)!;
      const copy = out.layout.blocks.find((b) => b.id === out.id) as Block;

      expect(shape(copy.children)).toEqual(shape(target.children));
      expect({...copy.fill, ...copy.flex, invert: copy.invert}).toEqual({
        ...target.fill,
        ...target.flex,
        invert: target.invert,
      });
      expect(Object.keys(copy.at)).toEqual(['a']);
      expect(copy.at.a.col).toBe(target.at.a.col);
      expect(copy.at.a.colSpan).toBe(target.at.a.colSpan);
      expect(copy.at.a.rowSpan).toBe(target.at.a.rowSpan);
      expect(copy.at.a.row).toBe(target.at.a.row + target.at.a.rowSpan);
    }
  });

  it('refuses a block that does not exist', () => {
    expect(duplicate(emptyLayout(), 'nope')).toBeUndefined();
  });
});

describe('insertRow', () => {
  it('moves everything at or below the line down one, and nothing else', () => {
    for (let seed = 0; seed < 500; seed++) {
      const r = rng(seed);
      const before = densePacked(r, int(r, 1, 14));
      const bottom = Math.max(...before.blocks.map((b) => b.at.a.row + b.at.a.rowSpan));
      const row = int(r, 1, bottom + 1);
      const after = insertRow(before, row);

      expect(clean(after, 'a'), `seed ${seed}`).toBe(true);
      before.blocks.forEach((b, i) => {
        const a = after.blocks[i]!.at.a;
        expect(a.row, `seed ${seed} ${b.id}`).toBe(b.at.a.row + (b.at.a.row >= row ? 1 : 0));
        expect([a.col, a.colSpan, a.rowSpan]).toEqual([b.at.a.col, b.at.a.colSpan, b.at.a.rowSpan]);
      });
      // the new row is empty: whatever started there has moved off it
      expect(after.blocks.some((b) => b.at.a.row === row)).toBe(false);
    }
  });

  it('leaves reading order, and so every derived band, as it was', () => {
    for (let seed = 0; seed < 300; seed++) {
      const r = rng(seed);
      const before = densePacked(r, int(r, 1, 14));
      const after = insertRow(before, int(r, 1, 30));
      expect(readingOrder(after).map((b) => b.id)).toEqual(readingOrder(before).map((b) => b.id));
      for (const band of ['b', 'c'] as const) {
        expect([...derive(after, band)]).toEqual([...derive(before, band)]);
      }
    }
  });
});
