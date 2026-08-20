import {useDraggable} from '@dnd-kit/react';
import {Feedback} from '@dnd-kit/dom';
import type {Edge} from './geometry';

// no dnd-kit drag feedback: the ghost shows the module, so nothing is off-grid
const NO_FEEDBACK = [Feedback.configure({feedback: 'none'})];

const EDGES: {edge: Edge; label: string}[] = [
  {edge: 'n', label: 'top edge'},
  {edge: 's', label: 'bottom edge'},
  {edge: 'w', label: 'left edge'},
  {edge: 'e', label: 'right edge'},
  {edge: 'se', label: 'bottom right corner'},
];

function Handle({id, edge, label}: {id: string; edge: Edge; label: string}) {
  const {ref} = useDraggable({
    id: `${id}:${edge}`,
    data: {kind: 'resize', block: id, edge},
    plugins: NO_FEEDBACK,
  });
  return (
    <button
      ref={ref}
      type="button"
      className={`e-handle e-handle-${edge}`}
      data-chrome=""
      aria-label={`Resize ${label} of ${id}`}
    />
  );
}

export function DragHandles({id, selected}: {id: string; selected: boolean}) {
  const {ref} = useDraggable({
    id: `${id}:move`,
    data: {kind: 'move', block: id},
    plugins: NO_FEEDBACK,
  });

  return (
    <>
      <button
        ref={ref}
        type="button"
        className="e-move"
        data-chrome=""
        aria-label={`Move ${id}`}
      />
      {selected
        ? EDGES.map((e) => (
            <Handle key={e.edge} id={id} edge={e.edge} label={e.label} />
          ))
        : null}
    </>
  );
}
