import {describe, expect, it} from 'vitest';
import {
  collectionCounts,
  collectionPageSize,
  mediaIds,
  productHandles,
} from '../src/content';
import {decode, encode} from '../src/serialise';
import {
  BUTTON_VARIANTS,
  COLUMN_CHOICES,
  divisorsOf,
  fitCount,
} from '../src/types';
import {
  emptyBlock,
  emptyLayout,
  type Block,
  type Fill,
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
          {id: `${id}-g${i}-b`, kind: 'button', variant: 'outline', label: 'More', href: '/x'},
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
      fill: {color: {slot: 3}, overlay: {color: {hex: '#000000'}, opacity: 0.35}},
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

describe('product binding', () => {
  const withProduct = (source: 'context' | {handle: string}): Layout => ({
    version: 1,
    blocks: [
      {
        ...emptyBlock('x', {a: {col: 1, colSpan: 4, row: 1, rowSpan: 4}}),
        children: [
          {id: 'p1', kind: 'product', view: 'media', source, variant: 'primary'},
        ],
      },
    ],
  });

  it('roundtrips both sources', () => {
    for (const source of ['context', {handle: 'a-shirt'}] as const) {
      expect(decode(encode(withProduct(source)))).toEqual(withProduct(source));
    }
  });

  // the whole point of one template per catalogue: the saved layout is the same
  // whichever product was on screen
  it('writes no handle for the product the route is rendering', () => {
    const wire = JSON.parse(encode(withProduct('context')));
    expect(wire.b[0].k[0]).toEqual({i: 'p1', k: 'p', w: 'm'});
  });

  it('lists pinned handles and ignores contextual ones', () => {
    expect(productHandles(withProduct({handle: 'a-shirt'}))).toEqual(['a-shirt']);
    expect(productHandles(withProduct('context'))).toEqual([]);
  });
});

describe('collection repeater', () => {
  const withCollection = (patch: Partial<Extract<Node, {kind: 'collection'}>>) => ({
    version: 1,
    blocks: [
      {
        ...emptyBlock('x', {a: {col: 1, colSpan: 12, row: 1, rowSpan: 6}}),
        children: [
          {
            id: 'c1',
            kind: 'collection' as const,
            source: 'context' as const,
            columns: 3 as const,
            narrow: 3 as const,
            count: 12,
            variant: 'outline' as const,
            ...patch,
          },
        ],
      },
    ],
  });

  it('roundtrips both sources', () => {
    for (const source of ['context', {handle: 'shirts'}] as const) {
      const before = withCollection({source});
      expect(decode(encode(before))).toEqual(before);
    }
  });

  it('costs nothing on the wire at its defaults', () => {
    const wire = JSON.parse(encode(withCollection({})));
    expect(wire.b[0].k[0]).toEqual({i: 'c1', k: 'c'});
  });

  // a hand-edited count would ragged the last row of every page, not just the
  // final one, so it is repaired rather than trusted
  it('repairs a count that is not a whole number of rows', () => {
    const wire = JSON.parse(encode(withCollection({columns: 4, count: 12})));
    wire.b[0].k[0].q = 13;
    const node = decode(JSON.stringify(wire))?.blocks[0]?.children[0];
    expect(node && node.kind === 'collection' && node.count).toBe(12);
  });

  it('keeps the narrow band off the wire until it differs', () => {
    const same = JSON.parse(encode(withCollection({})));
    expect(same.b[0].k[0]).toEqual({i: 'c1', k: 'c'});
    const differs = JSON.parse(encode(withCollection({narrow: 1})));
    expect(differs.b[0].k[0]).toEqual({i: 'c1', k: 'c', m: 1});
  });

  // a narrow count that does not divide the wide one ragged every page in band
  // c, not just the last, so it is repaired the way the count is
  it('repairs a narrow band that does not divide the wide one', () => {
    const wire = JSON.parse(encode(withCollection({columns: 6, narrow: 3, count: 12})));
    wire.b[0].k[0].m = 4;
    const node = decode(JSON.stringify(wire))?.blocks[0]?.children[0];
    expect(node && node.kind === 'collection' && node.narrow).toBe(3);
  });

  it('renders whole rows in both bands, for every legal pair', () => {
    for (const columns of COLUMN_CHOICES) {
      for (const narrow of divisorsOf(columns)) {
        const count = fitCount(13, columns);
        expect(count % columns).toBe(0);
        expect(count % narrow).toBe(0);
      }
    }
  });

  it('counts pinned collections and sizes the page from contextual ones', () => {
    expect(
      collectionCounts(withCollection({source: {handle: 'shirts'}, count: 24})),
    ).toEqual({shirts: 24});
    expect(collectionCounts(withCollection({}))).toEqual({});
    expect(collectionPageSize(withCollection({count: 24}))).toBe(24);
    expect(collectionPageSize(withCollection({source: {handle: 'shirts'}}))).toBe(0);
  });
});

describe('shopper controls', () => {
  const withNode = (node: Node): Layout => ({
    version: 1,
    blocks: [
      {
        ...emptyBlock('x', {a: {col: 1, colSpan: 2, row: 1, rowSpan: 1}}),
        children: [node],
      },
    ],
  });

  it('roundtrips a cart and an account control', () => {
    for (const node of [
      {id: 'n', kind: 'cart' as const, label: 'Bag'},
      {id: 'n', kind: 'account' as const, label: 'Sign in'},
    ]) {
      expect(decode(encode(withNode(node)))).toEqual(withNode(node));
    }
  });

  // neither holds a reference: the shell knows the count and the session, so a
  // saved layout says nothing about either
  it('writes the label and nothing else', () => {
    const wire = JSON.parse(encode(withNode({id: 'n', kind: 'cart', label: 'Bag'})));
    expect(wire.b[0].k[0]).toEqual({i: 'n', k: 'r', v: 'Bag'});
  });
});

describe('element buttons', () => {
  const wire = (node: Node) =>
    JSON.parse(
      encode({
        version: 1,
        blocks: [
          {
            ...emptyBlock('x', {a: {col: 1, colSpan: 4, row: 1, rowSpan: 4}}),
            children: [node],
          },
        ],
      }),
    ).b[0].k[0];

  // the default is what each already rendered, so a layout saved before the
  // control existed decodes to the same page
  it('costs nothing on the wire at the variant each already had', () => {
    expect(
      wire({id: 'n', kind: 'product', view: 'details', source: 'context', variant: 'primary'}),
    ).toEqual({i: 'n', k: 'p', w: 'd'});
    expect(
      wire({
        id: 'n',
        kind: 'collection',
        source: 'context',
        columns: 3,
        narrow: 3,
        count: 12,
        variant: 'outline',
      }),
    ).toEqual({i: 'n', k: 'c'});
  });

  it('reads a product and a collection saved before the control existed', () => {
    const before = JSON.stringify({
      v: 1,
      b: [{i: 'x', a: [1, 1], k: [{i: 'n', k: 'p', w: 'd'}]}],
    });
    const node = decode(before)?.blocks[0]?.children[0];
    expect(node && node.kind === 'product' && node.variant).toBe('primary');
  });
});

describe('button variants', () => {
  const withButton = (variant: string): string =>
    JSON.stringify({
      v: 1,
      b: [{i: 'x', a: [1, 1], k: [{i: 'n', k: 'b', v: 'Go', p: variant}]}],
    });

  const variantOf = (wire: string) => {
    const node = decode(wire)?.blocks[0]?.children[0];
    return node && node.kind === 'button' ? node.variant : undefined;
  };

  it('roundtrips every variant', () => {
    for (const variant of BUTTON_VARIANTS) {
      expect(variantOf(withButton(variant))).toBe(variant);
    }
  });

  // outline was called secondary until glass arrived, and every layout saved
  // before the rename still says so
  it('reads a layout saved before the rename', () => {
    expect(variantOf(withButton('secondary'))).toBe('outline');
  });

  it('falls back rather than dropping a variant it cannot read', () => {
    expect(variantOf(withButton('sparkly'))).toBe('primary');
  });
});

describe('block media', () => {
  const withMedia = (media: NonNullable<Fill['media']>): Layout => ({
    version: 1,
    blocks: [
      {
        ...emptyBlock('x', {a: {col: 1, colSpan: 2, row: 1, rowSpan: 1}}),
        fill: {media},
      },
    ],
  });

  it('roundtrips a url and a file reference, and keeps them apart', () => {
    for (const media of [
      {kind: 'image' as const, src: 'https://cdn.test/a.jpg'},
      {kind: 'video' as const, src: 'https://cdn.test/a.mp4'},
      {kind: 'image' as const, id: 'gid://shopify/MediaImage/1'},
      {kind: 'video' as const, id: 'gid://shopify/Video/2'},
    ]) {
      expect(decode(encode(withMedia(media)))).toEqual(withMedia(media));
    }
  });

  // the placeholder invited a gid into the url field long before anything could
  // resolve one, so those layouts exist and decode as references now
  it('reads a gid typed into the old url field as a reference', () => {
    const wire = JSON.parse(encode(withMedia({kind: 'image', src: 'x'})));
    wire.b[0].f.m[1] = 'gid://shopify/MediaImage/9';
    const fill = decode(JSON.stringify(wire))?.blocks[0]?.fill;
    expect(fill?.media).toEqual({kind: 'image', id: 'gid://shopify/MediaImage/9'});
  });

  it('lists the gids a layout references and ignores urls', () => {
    expect(mediaIds(withMedia({kind: 'image', id: 'gid://shopify/MediaImage/1'}))).toEqual([
      'gid://shopify/MediaImage/1',
    ]);
    expect(mediaIds(withMedia({kind: 'image', src: 'https://cdn.test/a.jpg'}))).toEqual([]);
  });
});

describe('theme colours', () => {
  const withFill = (fill: Layout['blocks'][number]['fill']): Layout => ({
    version: 1,
    blocks: [
      {
        ...emptyBlock('x', {a: {col: 1, colSpan: 4, row: 1, rowSpan: 2}}),
        fill,
      },
    ],
  });

  it('round-trips a slot and a literal, and keeps them apart', () => {
    for (const fill of [
      {color: {slot: 3 as const}},
      {color: {hex: '#ff0000'}},
      {color: {slot: 1 as const}, overlay: {color: {hex: '#000000'}, opacity: 0.4}},
    ]) {
      expect(decode(encode(withFill(fill)))).toEqual(withFill(fill));
    }
  });

  // a number is a slot, a string is a hex — no tag, and no way to confuse them
  it('writes a slot as a number and a hex as a string', () => {
    expect(encode(withFill({color: {slot: 3}}))).toContain('"c":3');
    expect(encode(withFill({color: {hex: '#ff0000'}}))).toContain('"c":"#ff0000"');
  });

  it('drops a slot outside the palette rather than inventing one', () => {
    const wire = '{"v":1,"b":[{"i":"x","a":[1,1,4,2],"f":{"c":9}}]}';
    expect(decode(wire)?.blocks[0]?.fill.color).toBeUndefined();
  });
});
