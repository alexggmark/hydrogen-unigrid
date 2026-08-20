import {describe, expect, it} from 'vitest';
import {encode, emptyBlock, type Layout} from '@unigrid/core';
import {fromFields} from './layout';

const layout: Layout = {
  version: 3,
  blocks: [emptyBlock('x', {a: {col: 1, colSpan: 4, row: 1, rowSpan: 2}})],
};

const fields = (over: Record<string, string | null> = {}) => {
  const base: Record<string, string | null> = {
    target: 'home',
    version: '3',
    draft: encode(layout),
    published: encode(layout),
    ...over,
  };
  return Object.entries(base).map(([key, value]) => ({key, value}));
};

describe('metaobject adapter', () => {
  it('reads the field asked for, not the other one', () => {
    const other: Layout = {...layout, blocks: []};
    const f = fields({draft: encode(other)});
    expect(fromFields(f, 'published')?.layout.blocks).toHaveLength(1);
    expect(fromFields(f, 'draft')?.layout.blocks).toHaveLength(0);
  });

  it('returns a Layout, never the field shape', () => {
    const got = fromFields(fields(), 'published');
    expect(got?.layout).toEqual(layout);
    expect(got).not.toHaveProperty('fields');
  });

  // absent and unreadable both mean nothing to render, and neither may throw
  it('gives null for a missing or unparseable field', () => {
    expect(fromFields(fields({published: null}), 'published')).toBeNull();
    expect(fromFields(fields({published: 'not json'}), 'published')).toBeNull();
    expect(fromFields([], 'published')).toBeNull();
  });

  it('falls back to the layout version when the field is unusable', () => {
    expect(fromFields(fields({version: 'seven'}), 'published')?.version).toBe(3);
    expect(fromFields(fields({version: '9'}), 'published')?.version).toBe(9);
  });
});
