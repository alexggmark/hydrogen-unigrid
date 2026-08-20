import {useDraggable} from '@dnd-kit/react';
import {Feedback} from '@dnd-kit/dom';
import type {BlockType} from '@unigrid/core';

const NO_FEEDBACK = [Feedback.configure({feedback: 'none'})];

export const NEW_SPAN: Record<BlockType, {colSpan: number; rowSpan: number}> = {
  text: {colSpan: 3, rowSpan: 2},
  richText: {colSpan: 4, rowSpan: 4},
  image: {colSpan: 4, rowSpan: 3},
  product: {colSpan: 3, rowSpan: 3},
  rule: {colSpan: 3, rowSpan: 1},
};

const OFFER: BlockType[] = ['text', 'image', 'product', 'rule'];

function Chip({type}: {type: BlockType}) {
  const {ref, isDragging} = useDraggable({
    id: `new:${type}`,
    data: {kind: 'new', type},
    plugins: NO_FEEDBACK,
  });
  return (
    <button
      ref={ref}
      type="button"
      className="e-chip"
      data-dragging={isDragging ? '' : undefined}
      aria-label={`Drag a new ${type} block onto the grid`}
    >
      {type}
    </button>
  );
}

export function Palette() {
  return (
    <div className="e-chips">
      {OFFER.map((type) => (
        <Chip key={type} type={type} />
      ))}
    </div>
  );
}
