import {describe, expect, it} from 'vitest';
import {
  addNode,
  findNode,
  flexIn,
  menuHandles,
  moveNode,
  patchBlock,
  patchNode,
  placeNode,
  removeNode,
  resetFlex,
  setFlex,
} from '../src/content';
import {decode, encode} from '../src/serialise';
import {emptyBlock, isGroup, type Element, type Group, type Layout} from '../src/types';
import {children, rng} from './random';

const el = (id: string): Element => ({id, kind: 'text', size: 'sm', value: id});
const group = (id: string): Group => ({
  id,
  kind: 'group',
  flex: {direction: 'row', justify: 'start', align: 'stretch', gap: 1},
  children: [],
});

const base = (): Layout => ({
  version: 1,
  blocks: [emptyBlock('b', {a: {col: 1, colSpan: 4, row: 1, rowSpan: 2}})],
});

describe('content tree', () => {
  it('adds to the block, and into a group by id', () => {
    let l = addNode(base(), 'b', null, group('g'));
    l = addNode(l, 'b', null, el('one'));
    l = addNode(l, 'b', 'g', el('two'));
    expect(l.blocks[0]?.children.map((n) => n.id)).toEqual(['g', 'one']);
    const g = l.blocks[0]?.children[0];
    expect(g && isGroup(g) ? g.children.map((n) => n.id) : []).toEqual(['two']);
  });

  it('refuses a group inside a group rather than representing one', () => {
    let l = addNode(base(), 'b', null, group('g'));
    l = addNode(l, 'b', 'g', group('inner'));
    expect(findNode(l, 'inner')).toBeUndefined();
  });

  it('finds a node at either depth and reports its parent group', () => {
    let l = addNode(base(), 'b', null, group('g'));
    l = addNode(l, 'b', 'g', el('deep'));
    l = addNode(l, 'b', null, el('shallow'));
    expect(findNode(l, 'deep')?.group?.id).toBe('g');
    expect(findNode(l, 'shallow')?.group).toBeUndefined();
  });

  it('reorders within the parent and never past its ends', () => {
    let l = base();
    for (const id of ['a', 'b2', 'c']) l = addNode(l, 'b', null, el(id));
    const ids = (x: Layout) => x.blocks[0]?.children.map((n) => n.id);
    expect(ids(moveNode(l, 'a', 1))).toEqual(['b2', 'a', 'c']);
    expect(ids(moveNode(l, 'a', -1))).toEqual(['a', 'b2', 'c']);
    expect(ids(moveNode(l, 'c', 1))).toEqual(['a', 'b2', 'c']);
  });

  it('removes at either depth', () => {
    let l = addNode(base(), 'b', null, group('g'));
    l = addNode(l, 'b', 'g', el('deep'));
    l = addNode(l, 'b', null, el('shallow'));
    expect(findNode(removeNode(l, 'deep'), 'deep')).toBeUndefined();
    expect(findNode(removeNode(l, 'shallow'), 'shallow')).toBeUndefined();
  });

  it('patches a node without touching its siblings', () => {
    let l = base();
    for (const id of ['a', 'b2']) l = addNode(l, 'b', null, el(id));
    const after = patchNode(l, 'a', {value: 'changed'});
    expect(after.blocks[0]?.children[0]).toMatchObject({value: 'changed'});
    expect(after.blocks[0]?.children[1]).toEqual(el('b2'));
  });

  it('setFlex resolves a block id or a group id', () => {
    let l = addNode(base(), 'b', null, group('g'));
    l = setFlex(l, 'b', {direction: 'row'});
    l = setFlex(l, 'g', {gap: 4});
    expect(l.blocks[0]?.flex.direction).toBe('row');
    const g = l.blocks[0]?.children[0];
    expect(g && isGroup(g) ? g.flex.gap : null).toBe(4);
  });

  it('a phone edit overrides the phone only, starting from the desktop', () => {
    let l = addNode(base(), 'b', null, group('g'));
    l = setFlex(l, 'g', {direction: 'column'}, 'c');
    const g = l.blocks[0]?.children[0];
    if (!g || !isGroup(g)) throw new Error('no group');
    expect(g.flex.direction).toBe('row');
    expect(g.narrowFlex).toEqual({...g.flex, direction: 'column'});
    expect(flexIn(g, 'b')).toBe(g.flex);
    expect(flexIn(g, 'c')).toBe(g.narrowFlex);
  });

  it('desktop edits leave a phone override alone, and reset removes it', () => {
    let l = setFlex(base(), 'b', {gap: 3}, 'c');
    l = setFlex(l, 'b', {gap: 6}, 'b');
    expect(l.blocks[0]?.flex.gap).toBe(6);
    expect(l.blocks[0]?.narrowFlex?.gap).toBe(3);
    l = resetFlex(l, 'b');
    expect(l.blocks[0] && 'narrowFlex' in l.blocks[0]).toBe(false);
  });

  it('an override at defaults survives the wire', () => {
    const l = setFlex(base(), 'b', {}, 'c');
    expect(decode(encode(l))).toEqual(l);
  });

  it('patchBlock leaves the placement alone', () => {
    const l = patchBlock(base(), 'b', {invert: true, fill: {color: {hex: '#ff0000'}}});
    expect(l.blocks[0]?.at.a).toEqual(base().blocks[0]?.at.a);
    expect(l.blocks[0]?.invert).toBe(true);
  });

  it('placeNode moves an element into a group at an index', () => {
    let l = addNode(base(), 'b', null, group('g'));
    l = addNode(l, 'b', 'g', el('inside'));
    l = addNode(l, 'b', null, el('outside'));
    const after = placeNode(l, 'outside', 'g', 0);
    const g = after.blocks[0]?.children[0];
    expect(g && isGroup(g) ? g.children.map((n) => n.id) : []).toEqual([
      'outside',
      'inside',
    ]);
    expect(after.blocks[0]?.children.map((n) => n.id)).toEqual(['g']);
  });

  it('placeNode lifts an element back out to the block root', () => {
    let l = addNode(base(), 'b', null, group('g'));
    l = addNode(l, 'b', 'g', el('inside'));
    const after = placeNode(l, 'inside', null, 0);
    expect(after.blocks[0]?.children.map((n) => n.id)).toEqual(['inside', 'g']);
    const g = after.blocks[0]?.children[1];
    expect(g && isGroup(g) ? g.children.length : -1).toBe(0);
  });

  it('placeNode refuses a group into a group and leaves the tree alone', () => {
    let l = addNode(base(), 'b', null, group('g'));
    l = addNode(l, 'b', null, group('g2'));
    expect(placeNode(l, 'g2', 'g', 0)).toEqual(l);
    expect(placeNode(l, 'g', 'g', 0)).toEqual(l);
  });

  it('placeNode clamps an index past the end rather than dropping the node', () => {
    let l = base();
    for (const id of ['a', 'b2']) l = addNode(l, 'b', null, el(id));
    const after = placeNode(l, 'a', null, 99);
    expect(after.blocks[0]?.children.map((n) => n.id)).toEqual(['b2', 'a']);
  });

  it('round-trips a populated tree through the wire format', () => {
    for (let seed = 0; seed < 300; seed++) {
      const r = rng(seed);
      const l: Layout = {
        version: 1,
        blocks: [
          {
            ...emptyBlock('b', {a: {col: 1, colSpan: 4, row: 1, rowSpan: 2}}),
            children: children(r, 'b'),
          },
        ],
      };
      expect(decode(encode(l)), `seed ${seed}`).toEqual(l);
    }
  });
});

describe('menuHandles', () => {
  const menu = (id: string, handle: string): Element => ({
    id,
    kind: 'menu',
    handle,
    direction: 'row',
    collapse: false,
  });

  const withChildren = (children: Layout['blocks'][number]['children']): Layout => ({
    version: 1,
    blocks: [{...emptyBlock('b1', {a: {col: 1, colSpan: 2, row: 1, rowSpan: 1}}), children}],
  });

  it('finds handles at both depths and reports each once', () => {
    const layout = withChildren([
      menu('m1', 'main-menu'),
      {
        id: 'g1',
        kind: 'group',
        flex: {direction: 'row', justify: 'start', align: 'center', gap: 1},
        children: [menu('m2', 'footer'), menu('m3', 'main-menu')],
      },
    ]);
    expect(menuHandles(layout).sort()).toEqual(['footer', 'main-menu']);
  });

  // an unpicked menu would otherwise send the route off to query ""
  it('skips a menu with no handle chosen', () => {
    expect(menuHandles(withChildren([menu('m1', '')]))).toEqual([]);
  });

  it('is empty for a layout with no menus', () => {
    expect(menuHandles(withChildren([{id: 't', kind: 'text', size: 'sm', value: 'x'}]))).toEqual([]);
  });
});
