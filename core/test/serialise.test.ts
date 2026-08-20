import {describe, expect, it} from 'vitest';
import {decode, encode} from '../src/serialise';
import {
  emptyBlock,
  emptyLayout,
  type Block,
  type Layout,
  type Node,
} from '../src/types';
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
          ...emptyBlock('x', {a: {col: 1, colSpan: 2, row: 1, rowSpan: 1}}),
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
        emptyBlock('x', {a: {col: 3, colSpan: 1, row: 7, rowSpan: 1}}),
      ],
    };
    expect(encode(one)).toContain('[3,7]');
  });

  // every element added after this ships is a kind older readers do not know
  it('drops a node it cannot read and keeps the rest of the page', () => {
    const wire = JSON.stringify({
      v: 1,
      b: [
        {
          i: 'x',
          a: [1, 1, 4, 2],
          k: [
            {i: 'keep', k: 't', v: 'still here'},
            {i: 'future', k: 'productPrice', v: 'from a later version'},
            {i: 'also', k: 'h', l: 3, v: 'and this'},
          ],
        },
      ],
    });
    const after = decode(wire);
    expect(after?.blocks[0]?.children.map((n) => n.id)).toEqual(['keep', 'also']);
  });

  // structure is different from content: a bad cell makes the layout unusable
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

});

describe('wire size', () => {
  const LOREM =
    'Within a band the composition is fixed. Column count, positions and spans do not change — only size. A screenshot at 1600px and one at 1400px are the same image at two magnifications.';

  const elements = (id: string, n: number): Node[] =>
    Array.from({length: n}, (_, i): Node => {
      const k = i % 4;
      if (k === 0) {
        return {id: `${id}-h${i}`, kind: 'headline', level: 2, value: 'A headline of ordinary length'};
      }
      if (k === 1) return {id: `${id}-t${i}`, kind: 'text', size: 'sm', value: LOREM};
      if (k === 2) {
        return {id: `${id}-b${i}`, kind: 'button', variant: 'primary', label: 'Shop the collection', href: '/collections/all'};
      }
      return {
        id: `${id}-g${i}`,
        kind: 'group',
        flex: {direction: 'row', justify: 'between', align: 'center', gap: 2},
        children: [
          {id: `${id}-g${i}-a`, kind: 'text', size: 'sm', value: LOREM},
          {id: `${id}-g${i}-b`, kind: 'button', variant: 'secondary', label: 'More', href: '/x'},
        ],
      };
    });

  // every band overridden, every block filled and tinted — nothing derivable is
  // left out, so this is the expensive end of a real page rather than a fair one
  const page = (blocks: number, per: number): Layout => ({
    version: 1,
    blocks: Array.from({length: blocks}, (_, i): Block => ({
      ...emptyBlock(`block-${i}`, {
        a: {col: (i % 3) * 4 + 1, colSpan: 4, row: i * 3 + 1, rowSpan: 3},
        b: {col: (i % 2) * 4 + 1, colSpan: 4, row: i * 4 + 1, rowSpan: 4},
        c: {col: 1, colSpan: 4, row: i * 5 + 1, rowSpan: 5},
      }),
      fill: {color: '#112233', overlay: {color: '#000000', opacity: 0.35}},
      invert: i % 2 === 0,
      flex: {direction: 'column', justify: 'between', align: 'stretch', gap: 2},
      children: elements(`block-${i}`, per),
    })),
  });

  // json escapes non-ascii, so byte length and string length agree here
  const kb = (l: Layout) => encode(l).length / 1024;

  // the storefront json metafield caps at 128kb. fail well under it, so the
  // ceiling is a known number rather than something found in production.
  it('keeps a generous full page under 100kb', () => {
    expect(kb(page(40, 6))).toBeLessThan(100);
  });

  // the margin above is only there because defaults are dropped; without this
  // the test above would pass for a long time and then suddenly not
  it('omits everything derivable', () => {
    const bare: Layout = {
      version: 1,
      blocks: [emptyBlock('x', {a: {col: 1, colSpan: 1, row: 1, rowSpan: 1}})],
    };
    expect(encode(bare)).toBe('{"v":1,"b":[{"i":"x","a":[1,1]}]}');
  });
});
