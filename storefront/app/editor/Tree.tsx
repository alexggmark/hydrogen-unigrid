import {isSortable, useSortable} from '@dnd-kit/react/sortable';
import type {DragDropManager} from '@dnd-kit/dom';
import {isGroup, type Block, type Node} from '@unigrid/core';

// the rail's content tree. two containers: the block root, which takes anything,
// and each group, which takes elements only. a group aimed at a group is shown
// as invalid rather than silently ignored, so the rule is visible at the gesture.

export type NodeDrag = {kind: 'node'; node: string; group: boolean};

// the container naming lives here, so reading a drop back out does too
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
  group: 'Group',
};

const preview = (node: Node): string => {
  if (isGroup(node)) return `${node.children.length} inside`;
  return node.kind === 'button' ? node.label : node.value;
};

type RowProps = {
  node: Node;
  index: number;
  container: string;
  depth: number;
  active: boolean;
  dragging: NodeDrag | null;
  onPick: (id: string | null) => void;
  onMove: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
};

function Row({
  node,
  index,
  container,
  depth,
  active,
  dragging,
  onPick,
  onMove,
  onRemove,
}: RowProps) {
  const group = isGroup(node);
  const {ref, handleRef, isDragging, isDropTarget} = useSortable({
    id: node.id,
    index,
    group: container,
    type: group ? 'group' : 'element',
    accept: ['element', 'group'],
    data: {kind: 'node', node: node.id, group} satisfies NodeDrag,
  });

  // a group can only live at the root, so anything landing inside one is refused
  const rejects =
    isDropTarget && dragging?.group === true && container !== ROOT;

  return (
    <li
      ref={ref}
      data-depth={depth}
      data-dragging={isDragging ? '' : undefined}
      data-invalid={rejects ? '' : undefined}
    >
      <button
        ref={handleRef}
        type="button"
        className="e-grip"
        aria-label={`Reorder ${LABEL[node.kind] ?? node.kind}`}
      >
        ⠿
      </button>
      <button
        type="button"
        className="e-node"
        aria-pressed={active}
        onClick={() => onPick(active ? null : node.id)}
      >
        <span>{LABEL[node.kind] ?? node.kind}</span>
        <span className="e-dim">{preview(node)}</span>
      </button>
      <span className="e-nudge">
        <button type="button" onClick={() => onMove(node.id, -1)} aria-label="Move up">
          ↑
        </button>
        <button type="button" onClick={() => onMove(node.id, 1)} aria-label="Move down">
          ↓
        </button>
        <button
          type="button"
          className="e-danger"
          onClick={() => onRemove(node.id)}
          aria-label="Remove"
        >
          ×
        </button>
      </span>
    </li>
  );
}

// an empty group has no row to drop next to, so it gets a target of its own
function EmptySlot({group, dragging}: {group: string; dragging: NodeDrag | null}) {
  const {ref, isDropTarget} = useSortable({
    id: `${group}:empty`,
    index: 0,
    group,
    type: 'slot',
    accept: ['element', 'group'],
    disabled: {draggable: true},
  });
  return (
    <li
      ref={ref}
      data-depth={1}
      data-slot=""
      data-invalid={isDropTarget && dragging?.group ? '' : undefined}
    >
      <span className="e-dim">{isDropTarget ? 'drop here' : 'empty group'}</span>
    </li>
  );
}

export type TreeProps = {
  block: Block;
  activeNode: string | null;
  dragging: NodeDrag | null;
  onPick: (id: string | null) => void;
  onMove: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
};

export function Tree(props: TreeProps) {
  const {block, activeNode, dragging} = props;
  const row = (node: Node, index: number, container: string, depth: number) => (
    <Row
      key={node.id}
      node={node}
      index={index}
      container={container}
      depth={depth}
      active={node.id === activeNode}
      dragging={dragging}
      onPick={props.onPick}
      onMove={props.onMove}
      onRemove={props.onRemove}
    />
  );

  return (
    <ul className="e-tree">
      {block.children.map((child, i) => (
        <li key={child.id} className="e-branch">
          <ul className="e-tree">
            {row(child, i, ROOT, 0)}
            {isGroup(child)
              ? child.children.length
                ? child.children.map((leaf, j) => row(leaf, j, child.id, 1))
                : [<EmptySlot key="empty" group={child.id} dragging={dragging} />]
              : null}
          </ul>
        </li>
      ))}
    </ul>
  );
}
