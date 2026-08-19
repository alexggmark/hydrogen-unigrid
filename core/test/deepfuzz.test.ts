import {describe, expect, it} from 'vitest';
import {overlaps} from '../src/layout';
import {resolve} from '../src/resolve';
import type {Cell} from '../src/types';
import {densePacked, int, rng} from './random';

describe('gate 4 sweep', () => {
  it('no-overlap and convergence over 25000 dense random layouts', () => {
    let blocks = 0;
    let grown = 0;
    for (let seed = 0; seed < 25_000; seed++) {
      const r = rng(seed);
      const layout = densePacked(r, int(r, 4, 18));

      // authored layouts must themselves be clean, or the sweep proves nothing
      const authored: Cell[] = layout.blocks.map((b) => b.at.a);
      for (let i = 0; i < authored.length; i++) {
        for (let j = i + 1; j < authored.length; j++) {
          const a = authored[i];
          const b = authored[j];
          if (a && b && overlaps(a, b)) {
            throw new Error(
              `seed ${seed}: authored overlap, generator is wrong`,
            );
          }
        }
      }

      const m: Record<string, number> = {};
      for (const b of layout.blocks) if (r() < 0.6) m[b.id] = int(r, 1, 30);

      const resolved = resolve(layout, 'a', m);
      const cells: Cell[] = [...resolved.values()];
      for (let i = 0; i < cells.length; i++) {
        for (let j = i + 1; j < cells.length; j++) {
          const a = cells[i];
          const b = cells[j];
          if (a && b && overlaps(a, b)) {
            throw new Error(
              `seed ${seed}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`,
            );
          }
        }
      }
      blocks += cells.length;
      for (const b of layout.blocks) {
        const rc = resolved.get(b.id);
        if (rc && rc.rowSpan > b.at.a.rowSpan) grown++;
      }
    }
    expect(blocks).toBeGreaterThan(250_000);
    expect(grown).toBeGreaterThan(100_000);
  });
});
