import type {Layout} from './types';

// immutable stack. nothing is mutated, so undo restores the exact prior tree
// rather than a reconstruction of it.
export type History = {
  past: readonly Layout[];
  present: Layout;
  future: readonly Layout[];
};

export const LIMIT = 100;

export const history = (present: Layout): History => ({
  past: [],
  present,
  future: [],
});

export const canUndo = (h: History): boolean => h.past.length > 0;
export const canRedo = (h: History): boolean => h.future.length > 0;

// a commit clears the redo branch: you cannot redo into a future you left
export const commit = (h: History, next: Layout): History => ({
  past: [...h.past, h.present].slice(-LIMIT),
  present: next,
  future: [],
});

export function undo(h: History): History {
  const previous = h.past[h.past.length - 1];
  if (previous === undefined) return h;
  return {
    past: h.past.slice(0, -1),
    present: previous,
    future: [h.present, ...h.future],
  };
}

export function redo(h: History): History {
  const [next, ...rest] = h.future;
  if (next === undefined) return h;
  return {past: [...h.past, h.present], present: next, future: rest};
}
