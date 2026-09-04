import {isSortable, useSortable} from '@dnd-kit/react/sortable';
import type {DragDropManager} from '@dnd-kit/dom';
import {Badge, Button, Flex, IconButton, Text} from '@radix-ui/themes';
import {isGroup, type Block, type Node} from '@unigrid/core';

// two drop containers: the block root takes anything, a group takes elements only

export type NodeDrag = {kind: 'node'; node: string; group: boolean};

export const ROOT = 'root';

export function dropTarget(
  manager: DragDropManager,
): {parent: string | null; index: number} | null {
  const to = manager.dragOperation.target;
  if (!to || !isSortable(to)) return null;
  const container = String(to.group ?? ROOT);
  return {parent: container === ROOT ? null : container, index: to.index};
}

const LABEL: Record<string, string> = {
  headline: 'Headline',
  text: 'Text',
  richText: 'Rich text',
  button: 'Button',
  menu: 'Menu',
  product: 'Product',
  collection: 'Collection',
  cart: 'Cart',
  account: 'Account',
  group: 'Group',
};

const preview = (node: Node): string => {
  if (isGroup(node)) return `${node.children.length} inside`;
  if (node.kind === 'button') return node.label;
  if (node.kind === 'cart' || node.kind === 'account') return node.label;
  if (node.kind === 'menu') return node.handle || 'no menu chosen';
  if (node.kind === 'product') {
    const which = node.source === 'context' ? 'on this page' : node.source.handle;
    return `${node.view} — ${which}`;
  }
  if (node.kind === 'collection') {
    const which = node.source === 'context' ? 'on this page' : node.source.handle;
    const grid =
      node.narrow === node.columns
        ? `${node.columns}`
        : `${node.columns}/${node.narrow}`;
    return `${node.count} in ${grid} — ${which}`;
  }
  return node.value;
};

type RowProps = {
  node: Node;
  index: number;
  container: string;
  depth: number;
  active: boolean;
  onPick: (id: string | null) => void;
  onMove: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
  children?: React.ReactNode;
};

function Row({
  node,
  index,
  container,
  depth,
  active,
  onPick,
  onMove,
  onRemove,
  children,
}: RowProps) {
  const group = isGroup(node);
  const {ref, handleRef, targetRef, isDragging} = useSortable({
    id: node.id,
    index,
    group: container,
    type: group ? 'group' : 'element',
    // a group only sits at the root. refusing it as a target here is what stops
    // dnd-kit reordering the dom into a position the model will not accept.
    accept: container === ROOT ? ['element', 'group'] : ['element'],
    data: {kind: 'node', node: node.id, group} satisfies NodeDrag,
  });

  return (
    <li
      ref={ref}
      data-depth={depth}
      data-dragging={isDragging ? '' : undefined}
    >
      <div className="e-rowline" ref={targetRef}>
        <IconButton asChild size="1" variant="ghost" color="gray">
          <button
            ref={handleRef}
            type="button"
            className="e-grip"
            aria-label={`Reorder ${LABEL[node.kind] ?? node.kind}`}
          >
            ⠿
          </button>
        </IconButton>
        <Button
          size="1"
          variant={active ? 'solid' : 'soft'}
          onClick={() => onPick(active ? null : node.id)}
          style={{
            flex: '1 1 auto',
            minInlineSize: 0,
            justifyContent: 'flex-start',
          }}
        >
          <Text truncate>{LABEL[node.kind] ?? node.kind}</Text>
          <Text truncate size="1" color={active ? undefined : 'gray'}>
            {preview(node)}
          </Text>
        </Button>
        <Flex gap="1" flexShrink="0">
          <IconButton
            size="1"
            variant="ghost"
            color="gray"
            onClick={() => onMove(node.id, -1)}
            aria-label="Move up"
          >
            ↑
          </IconButton>
          <IconButton
            size="1"
            variant="ghost"
            color="gray"
            onClick={() => onMove(node.id, 1)}
            aria-label="Move down"
          >
            ↓
          </IconButton>
          <IconButton
            size="1"
            variant="ghost"
            color="red"
            onClick={() => onRemove(node.id)}
            aria-label="Remove"
          >
            ×
          </IconButton>
        </Flex>
      </div>
      {children}
    </li>
  );
}

// an empty group has no row to drop next to, so it gets a target of its own
function EmptySlot({group}: {group: string}) {
  const {ref, isDropTarget} = useSortable({
    id: `${group}:empty`,
    index: 0,
    group,
    type: 'slot',
    accept: ['element'],
    disabled: {draggable: true},
  });
  return (
    <li ref={ref} data-depth={1} data-slot="">
      <Badge size="1" variant="surface" color="gray">
        {isDropTarget ? 'drop here' : 'empty group'}
      </Badge>
    </li>
  );
}

export type TreeProps = {
  block: Block;
  activeNode: string | null;
  dragging: NodeDrag | null;
  resync: number;
  onPick: (id: string | null) => void;
  onMove: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
};

export function Tree(props: TreeProps) {
  const {block, activeNode, dragging} = props;

  // dnd-kit reorders the real dom and only restores it within one group, so
  // keying on the shape rebuilds the list rather than patching a moved row
  const shape = block.children
    .map((c) =>
      isGroup(c) ? `${c.id}[${c.children.map((x) => x.id).join()}]` : c.id,
    )
    .join('|');

  const row = (node: Node, index: number, container: string, depth: number) => (
    <Row
      key={node.id}
      node={node}
      index={index}
      container={container}
      depth={depth}
      active={node.id === activeNode}
      onPick={props.onPick}
      onMove={props.onMove}
      onRemove={props.onRemove}
    />
  );

  // a group is a single node in the root list with its own list inside it, so an
  // element arriving from above does not have to cross the group's own row first
  return (
    <ul className="e-tree" key={`${shape}#${props.resync}`}>
      {block.children.map((child, i) => (
        <Row
          key={child.id}
          node={child}
          index={i}
          container={ROOT}
          depth={0}
          active={child.id === activeNode}
          onPick={props.onPick}
          onMove={props.onMove}
          onRemove={props.onRemove}
        >
          {isGroup(child) ? (
            <ul
              className="e-tree e-sub"
              data-blocked={dragging?.group ? '' : undefined}
            >
              {child.children.length ? (
                child.children.map((leaf, j) => row(leaf, j, child.id, 1))
              ) : (
                <EmptySlot group={child.id} />
              )}
            </ul>
          ) : null}
        </Row>
      ))}
    </ul>
  );
}
