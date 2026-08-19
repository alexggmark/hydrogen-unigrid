import {describe, expect, it} from 'vitest';
import {
  canRedo,
  canUndo,
  commit,
  history,
  LIMIT,
  redo,
  undo,
} from '../src/history';
import {add, remove} from '../src/layout';
import {emptyLayout, type Layout} from '../src/types';
import {block, int, rng} from './random';

describe('undo and redo', () => {
  it('returns an identical state tree, not a reconstruction', () => {
    for (let seed = 0; seed < 200; seed++) {
      const r = rng(seed);
      let layout = emptyLayout();
      let h = history(layout);
      const snapshots: Layout[] = [layout];

      for (let i = 0; i < 12; i++) {
        const result = add(layout, block(r, `b${i}`));
        if (!result.ok) continue;
        layout = result.value;
        h = commit(h, layout);
        snapshots.push(layout);
      }

      // walk all the way back, checking identity at each step
      for (let i = snapshots.length - 1; i > 0; i--) {
        expect(h.present, `seed ${seed} step ${i}`).toBe(snapshots[i]);
        h = undo(h);
      }
      expect(h.present).toBe(snapshots[0]);

      // and all the way forward again
      for (let i = 1; i < snapshots.length; i++) {
        h = redo(h);
        expect(h.present, `seed ${seed} redo ${i}`).toBe(snapshots[i]);
      }
    }
  });

  it('undo at the start and redo at the end are identity', () => {
    const h = history(emptyLayout());
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
    expect(canUndo(h)).toBe(false);
    expect(canRedo(h)).toBe(false);
  });

  it('a commit clears the redo branch', () => {
    const start = emptyLayout();
    const r = rng(11);
    let h = history(start);
    const first = add(start, block(r, 'x'));
    if (!first.ok) return;
    h = commit(h, first.value);
    h = undo(h);
    expect(canRedo(h)).toBe(true);

    const other = add(h.present, block(r, 'y'));
    if (!other.ok) return;
    h = commit(h, other.value);
    expect(canRedo(h)).toBe(false);
    expect(h.future).toHaveLength(0);
  });

  it('never mutates a layout it has already stored', () => {
    const r = rng(12);
    let layout = emptyLayout();
    let h = history(layout);
    for (let i = 0; i < 6; i++) {
      const result = add(layout, block(r, `b${i}`));
      if (!result.ok) continue;
      layout = result.value;
      h = commit(h, layout);
    }
    const frozen = h.past.map((l) => l.blocks.length);
    remove(h.present, h.present.blocks[0]?.id ?? '');
    expect(h.past.map((l) => l.blocks.length)).toEqual(frozen);
  });

  it('bounds the past so history cannot grow without limit', () => {
    const r = rng(13);
    let layout = emptyLayout();
    let h = history(layout);
    for (let i = 0; i < LIMIT + 50; i++) {
      const result = add(layout, block(r, `b${i}`));
      if (!result.ok) continue;
      layout = result.value;
      h = commit(h, layout);
    }
    expect(h.past.length).toBeLessThanOrEqual(LIMIT);
  });

  it('survives an arbitrary undo/redo walk', () => {
    for (let seed = 0; seed < 100; seed++) {
      const r = rng(seed);
      let layout = emptyLayout();
      let h = history(layout);
      for (let i = 0; i < 10; i++) {
        const result = add(layout, block(r, `b${i}`));
        if (!result.ok) continue;
        layout = result.value;
        h = commit(h, layout);
      }
      for (let i = 0; i < 40; i++) {
        h = int(r, 0, 1) === 0 ? undo(h) : redo(h);
        expect(h.present, `seed ${seed}`).toBeDefined();
        expect(Array.isArray(h.present.blocks)).toBe(true);
      }
    }
  });
});
