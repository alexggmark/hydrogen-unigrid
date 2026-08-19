import {describe, expect, it} from 'vitest';
import {decode, encode} from '../src/serialise';
import {emptyLayout} from '../src/types';
import {layout, rng} from './random';

describe('serialisation', () => {
  it('roundtrips losslessly', () => {
    for (let seed = 0; seed < 300; seed++) {
      const before = layout(rng(seed), 12);
      const after = decode(encode(before));
      expect(after, `seed ${seed}`).toEqual(before);
    }
  });

  it('roundtrips an empty layout', () => {
    expect(decode(encode(emptyLayout()))).toEqual(emptyLayout());
  });

  it('keeps a hole when only the narrowest band is overridden', () => {
    const before = {
      version: 1,
      blocks: [
        {
          id: 'x',
          type: 'text' as const,
          content: {kind: 'none' as const},
          at: {
            a: {col: 1, colSpan: 2, row: 1, rowSpan: 1},
            c: {col: 1, colSpan: 4, row: 9, rowSpan: 2},
          },
        },
      ],
    };
    const after = decode(encode(before));
    expect(after).toEqual(before);
    expect(after?.blocks[0]?.at.b).toBeUndefined();
  });

  it('drops spans of 1 from the wire', () => {
    const one = {
      version: 1,
      blocks: [
        {
          id: 'x',
          type: 'rule' as const,
          content: {kind: 'none' as const},
          at: {a: {col: 3, colSpan: 1, row: 7, rowSpan: 1}},
        },
      ],
    };
    expect(encode(one)).toContain('[3,7]');
  });

  it('rejects malformed input rather than throwing', () => {
    const junk = [
      '',
      'null',
      '{}',
      '[]',
      '[1]',
      '[1,2]',
      '[1,[["a"]]]',
      '[1,[["a","?",0,[1,1]]]]',
      '[1,[["a","t",["z","v"],[1,1]]]]',
      '[1,[["a","t",0,[1]]]]',
      '[1,[["a","t",0,[1.5,2]]]]',
      '{"version":1}',
      'not json at all',
    ];
    for (const j of junk) expect(decode(j), j).toBeUndefined();
  });

  it('survives a fuzz of truncated valid output', () => {
    const json = encode(layout(rng(7), 8));
    for (let cut = 0; cut < json.length; cut += 3) {
      expect(() => decode(json.slice(0, cut))).not.toThrow();
    }
  });

  it('stays compact enough for the metafield cap', () => {
    const big = layout(rng(99), 300);
    const bytes = encode(big).length;
    expect(bytes).toBeLessThan(100_000);
  });
});
