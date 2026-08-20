import type {Block, Element, Flex, Group, Layout, Node} from './types';
import {isGroup} from './types';

export type Found = {block: Block; group?: Group; node: Node; index: number};

export function findNode(layout: Layout, nodeId: string): Found | undefined {
  for (const block of layout.blocks) {
    const i = block.children.findIndex((n) => n.id === nodeId);
    if (i >= 0) {
      const node = block.children[i];
      if (node) return {block, node, index: i};
    }
    for (const child of block.children) {
      if (!isGroup(child)) continue;
      const j = child.children.findIndex((n) => n.id === nodeId);
      const node = child.children[j];
      if (node) return {block, group: child, node, index: j};
    }
  }
  return undefined;
}

const mapBlock = (layout: Layout, id: string, fn: (b: Block) => Block): Layout => ({
  ...layout,
  blocks: layout.blocks.map((b) => (b.id === id ? fn(b) : b)),
});

// a group only accepts elements, so a group landing in a group is refused here
// rather than represented and rendered as something the model cannot hold
export function addNode(
  layout: Layout,
  blockId: string,
  parentId: string | null,
  node: Node,
): Layout {
  return mapBlock(layout, blockId, (b) => {
    if (!parentId) return {...b, children: [...b.children, node]};
    if (isGroup(node)) return b;
    return {
      ...b,
      children: b.children.map((child) =>
        child.id === parentId && isGroup(child)
          ? {...child, children: [...child.children, node]}
          : child,
      ),
    };
  });
}

export function removeNode(layout: Layout, nodeId: string): Layout {
  return {
    ...layout,
    blocks: layout.blocks.map((b) => ({
      ...b,
      children: b.children
        .filter((n) => n.id !== nodeId)
        .map((n) =>
          isGroup(n)
            ? {...n, children: n.children.filter((e) => e.id !== nodeId)}
            : n,
        ),
    })),
  };
}

const shift = <T>(list: T[], from: number, delta: number): T[] => {
  const to = from + delta;
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  if (item === undefined) return list;
  next.splice(to, 0, item);
  return next;
};

// reorder within the current parent only. moving between parents is a drag
// gesture the rail does not have, and a silent reparent would be worse.
export function moveNode(layout: Layout, nodeId: string, delta: number): Layout {
  const found = findNode(layout, nodeId);
  if (!found) return layout;
  const {block, group, index} = found;
  return mapBlock(layout, block.id, (b) =>
    group
      ? {
          ...b,
          children: b.children.map((child) =>
            child.id === group.id && isGroup(child)
              ? {...child, children: shift(child.children, index, delta)}
              : child,
          ),
        }
      : {...b, children: shift(b.children, index, delta)},
  );
}

// move a node to a parent at an index, reparenting if needed. parentId null is
// the block itself. a group can only ever sit at the root, so a group aimed at
// a group is refused here rather than represented.
export function placeNode(
  layout: Layout,
  nodeId: string,
  parentId: string | null,
  index: number,
): Layout {
  const found = findNode(layout, nodeId);
  if (!found) return layout;
  const {block, node} = found;
  if (parentId && isGroup(node)) return layout;
  if (parentId === nodeId) return layout;

  const stripped = removeNode(layout, nodeId).blocks.find((b) => b.id === block.id);
  if (!stripped) return layout;

  const at = (list: readonly unknown[]) =>
    Math.max(0, Math.min(index, list.length));

  const next: Block = parentId
    ? {
        ...stripped,
        children: stripped.children.map((child) =>
          child.id === parentId && isGroup(child)
            ? {
                ...child,
                children: [
                  ...child.children.slice(0, at(child.children)),
                  node as Element,
                  ...child.children.slice(at(child.children)),
                ],
              }
            : child,
        ),
      }
    : {
        ...stripped,
        children: [
          ...stripped.children.slice(0, at(stripped.children)),
          node,
          ...stripped.children.slice(at(stripped.children)),
        ],
      };

  return {...layout, blocks: layout.blocks.map((b) => (b.id === block.id ? next : b))};
}

export function patchNode(
  layout: Layout,
  nodeId: string,
  patch: Partial<Element> | Partial<Group>,
): Layout {
  const apply = (n: Node): Node => (n.id === nodeId ? ({...n, ...patch} as Node) : n);
  return {
    ...layout,
    blocks: layout.blocks.map((b) => ({
      ...b,
      children: b.children.map((n) =>
        isGroup(n) ? {...apply(n), children: n.children.map(apply) as Element[]} : apply(n),
      ),
    })),
  };
}

export function patchBlock(
  layout: Layout,
  blockId: string,
  patch: Partial<Pick<Block, 'fill' | 'flex' | 'invert'>>,
): Layout {
  return mapBlock(layout, blockId, (b) => ({...b, ...patch}));
}

export const setFlex = (
  layout: Layout,
  id: string,
  patch: Partial<Flex>,
): Layout => {
  const block = layout.blocks.find((b) => b.id === id);
  if (block) return patchBlock(layout, id, {flex: {...block.flex, ...patch}});
  const found = findNode(layout, id);
  if (!found || !isGroup(found.node)) return layout;
  return patchNode(layout, id, {flex: {...found.node.flex, ...patch}});
};
