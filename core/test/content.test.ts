import {describe, expect, it} from 'vitest';
import {
  addNode,
  findNode,
  moveNode,
  patchBlock,
  patchNode,
  removeNode,
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

  it('patchBlock leaves the placement alone', () => {
    const l = patchBlock(base(), 'b', {invert: true, fill: {color: '#ff0000'}});
    expect(l.blocks[0]?.at.a).toEqual(base().blocks[0]?.at.a);
    expect(l.blocks[0]?.invert).toBe(true);
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
