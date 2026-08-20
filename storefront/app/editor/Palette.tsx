import {useDraggable} from '@dnd-kit/react';
import {Feedback} from '@dnd-kit/dom';
import {Button} from '@radix-ui/themes';

const NO_FEEDBACK = [Feedback.configure({feedback: 'none'})];

// one chip: what goes inside a block is added from the rail once it is placed
export const NEW_SPAN = {colSpan: 4, rowSpan: 3};

export function Palette() {
  const {ref, isDragging} = useDraggable({
    id: 'new:block',
    data: {kind: 'new'},
    plugins: NO_FEEDBACK,
  });
  return (
    <Button asChild size="1" variant="surface">
      <button
        ref={ref}
        type="button"
        className="e-chip"
        data-dragging={isDragging ? '' : undefined}
        aria-label="Drag a new block onto the grid"
      >
        block
      </button>
    </Button>
  );
}
