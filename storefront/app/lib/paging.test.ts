import {describe, expect, it} from 'vitest';
import type {Layout} from '@unigrid/core';
import {collectionPageBy, pageHrefs} from './paging';

const browsing = (count: number): Layout => ({
  version: 1,
  blocks: [
    {
      id: 'b',
      at: {a: {col: 1, colSpan: 12, row: 1, rowSpan: 4}},
      fill: {},
      flex: {direction: 'column', justify: 'start', align: 'start', gap: 1},
      invert: false,
      children: [
        {id: 'c', kind: 'collection', source: 'context', columns: 4, narrow: 2, count},
      ],
    },
  ],
});

describe('collection page size', () => {
  it('takes the largest repeater on the page', () => {
    expect(collectionPageBy([browsing(8), null, browsing(24)])).toBe(24);
  });

  it('falls back when nothing browses this collection', () => {
    expect(collectionPageBy([null, null, null])).toBe(8);
  });
});

describe('page hrefs', () => {
  const both = {
    hasPreviousPage: true,
    hasNextPage: true,
    startCursor: 's',
    endCursor: 'e',
  };

  it('writes the params getPaginationVariables reads back', () => {
    const {prev, next} = pageHrefs(new URL('https://x.test/collections/shirts'), both);
    expect(prev).toBe('/collections/shirts?direction=previous&cursor=s');
    expect(next).toBe('/collections/shirts?direction=next&cursor=e');
  });

  it('keeps every other param, and replaces its own', () => {
    const url = new URL('https://x.test/collections/shirts?sort=price&cursor=old');
    expect(pageHrefs(url, both).next).toBe(
      '/collections/shirts?sort=price&cursor=e&direction=next',
    );
  });

  // an edge with no cursor is not a page: a link to nowhere would render a
  // control that does nothing
  it('offers no control at either end', () => {
    expect(
      pageHrefs(new URL('https://x.test/c'), {
        hasPreviousPage: false,
        hasNextPage: false,
      }),
    ).toEqual({});
    expect(
      pageHrefs(new URL('https://x.test/c'), {
        hasPreviousPage: true,
        hasNextPage: true,
        startCursor: null,
        endCursor: null,
      }),
    ).toEqual({});
  });
});
