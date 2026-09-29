import {describe, expect, it} from 'vitest';
import {DEFAULT_PALETTE, emptyBlock, type Layout} from '@unigrid/core';
import {readSnapshot, regionFor} from './snapshot';

const layout = (id: string): Layout => ({
  version: 1,
  blocks: [emptyBlock(id, {a: {col: 1, row: 1, colSpan: 4, rowSpan: 2}})],
});

const file = (body: unknown) => JSON.stringify(body);

describe('readSnapshot', () => {
  it('round-trips an export', () => {
    const s = readSnapshot(
      file({
        regions: {header: layout('h'), page: layout('p')},
        palette: {...DEFAULT_PALETTE, 1: '#0a3d2e'},
        metrics: {},
        settings: {headingFont: 'serif'},
      }),
    );
    expect(s?.regions.page).toEqual(layout('p'));
    expect(s?.palette[1]).toBe('#0a3d2e');
    expect(s?.settings).toEqual({headingFont: 'serif'});
  });

  it('refuses a file with no readable region', () => {
    expect(readSnapshot('not json')).toBeNull();
    expect(readSnapshot(file({regions: {page: {nope: 1}}}))).toBeNull();
  });

  it('falls back to the default for a bad palette slot', () => {
    const s = readSnapshot(
      file({regions: {page: layout('p')}, palette: {1: 'red'}}),
    );
    expect(s?.palette).toEqual(DEFAULT_PALETTE);
  });
});

describe('regionFor', () => {
  const s = readSnapshot(
    file({regions: {header: layout('h'), page: layout('p')}}),
  )!;

  it('matches shared regions by name', () => {
    expect(regionFor(s, 'header')).toEqual(layout('h'));
    expect(regionFor(s, 'footer')).toBeUndefined();
  });

  it('puts the body on whichever template is open', () => {
    expect(regionFor(s, 'product')).toEqual(layout('p'));
  });
});
