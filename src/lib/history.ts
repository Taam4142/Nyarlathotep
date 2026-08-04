// Undo/redo core (F5): two stacks of past/future snapshots. Pure + testable —
// the "present" is the app's live state; these helpers only move snapshots
// between the undo and redo stacks.

export interface UndoState<T> {
  undo: T[];
  redo: T[];
}

export const emptyUndo = <T>(): UndoState<T> => ({ undo: [], redo: [] });

export const canUndo = (s: UndoState<unknown>): boolean => s.undo.length > 0;
export const canRedo = (s: UndoState<unknown>): boolean => s.redo.length > 0;

/** Record `current` (a pre-mutation snapshot) onto the undo stack; clears redo. */
export function record<T>(s: UndoState<T>, current: T, limit = 60): UndoState<T> {
  const undo = [...s.undo, current];
  return {
    undo: undo.length > limit ? undo.slice(undo.length - limit) : undo,
    redo: [],
  };
}

/**
 * Undo: given the live `current` state, return the snapshot to restore plus the
 * new stacks (current is pushed onto redo). null if there's nothing to undo.
 */
export function undo<T>(
  s: UndoState<T>,
  current: T,
): { restore: T; next: UndoState<T> } | null {
  if (!s.undo.length) return null;
  const restore = s.undo[s.undo.length - 1];
  return {
    restore,
    next: { undo: s.undo.slice(0, -1), redo: [current, ...s.redo] },
  };
}

/** Redo: inverse of undo. null if there's nothing to redo. */
export function redo<T>(
  s: UndoState<T>,
  current: T,
): { restore: T; next: UndoState<T> } | null {
  if (!s.redo.length) return null;
  const restore = s.redo[0];
  return {
    restore,
    next: { undo: [...s.undo, current], redo: s.redo.slice(1) },
  };
}
