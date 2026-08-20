import {useDraggable} from '@dnd-kit/react';
import {Feedback} from '@dnd-kit/dom';

const NO_FEEDBACK = [Feedback.configure({feedback: 'none'})];

// a block is a container now, so there is one kind of thing to drag on.
// what goes inside is added from the rail once it is placed.
export const NEW_SPAN = {colSpan: 4, rowSpan: 3};

export function Palette() {
  const {ref, isDragging} = useDraggable({
    id: 'new:block',
    data: {kind: 'new'},
    plugins: NO_FEEDBACK,
  });
  return (
    <div className="e-chips">
      <button
        ref={ref}
        type="button"
        className="e-chip"
        data-dragging={isDragging ? '' : undefined}
        aria-label="Drag a new block onto the grid"
      >
        block
      </button>
    </div>
  );
}
