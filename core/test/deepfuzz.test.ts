import {describe, expect, it} from 'vitest';
import {BANDS} from '../src/bands';
import {derive} from '../src/derive';
import {overlaps} from '../src/layout';
import type {Cell} from '../src/types';
import {densePacked, int, rng} from './random';

describe('gate 4 sweep', () => {
  it('no overlap in any band over 25000 dense random layouts', () => {
    let blocks = 0;
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

      for (const band of BANDS) {
        const cells: Cell[] = [...derive(layout, band).values()];
        for (let i = 0; i < cells.length; i++) {
          for (let j = i + 1; j < cells.length; j++) {
            const a = cells[i];
            const b = cells[j];
            if (a && b && overlaps(a, b)) {
              throw new Error(
                `seed ${seed} band ${band}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`,
              );
            }
          }
        }
        blocks += cells.length;
      }
    }
    expect(blocks).toBeGreaterThan(750_000);
  });
});
