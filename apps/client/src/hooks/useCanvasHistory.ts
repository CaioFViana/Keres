import { useCallback, useRef, useState } from 'react';

/** Commits kept per canvas session; a drawing, not a manuscript, stays small. */
const MAX_HISTORY_ENTRIES = 50;

interface HistoryOptions {
  /** Skip pushing when the content serializes identically (e.g. a no-op tap). */
  equals?: (left: unknown, right: unknown) => boolean;
  /** Entries kept; sketches share structure between snapshots, so they keep many more. */
  limit?: number;
}

const defaultEquals = (left: unknown, right: unknown) =>
  JSON.stringify(left) === JSON.stringify(right);

/**
 * Undo/redo around one canvas document. Discrete operations (add, move commit, delete,
 * text edit, layer op, page change) call `commit()` *before* mutating through the wrapped
 * setter... in practice the setter snapshots the pre-mutation value itself: every `set`
 * pushes the previous value onto the past stack and clears the future stack, so screens
 * keep calling one setter and history just works. Continuous drags already commit once on
 * release upstream, so no coalescing is needed here.
 *
 * Lives outside the overlay hook on purpose: boards and location maps can adopt it later
 * by wrapping their own `setContent`, with no change to this hook.
 */
export function useCanvasHistory<T>(initial: T, options?: HistoryOptions) {
  const equals = options?.equals ?? defaultEquals;
  const limit = options?.limit ?? MAX_HISTORY_ENTRIES;
  const [value, setValueState] = useState<T>(initial);
  const currentRef = useRef<T>(initial);
  const pastRef = useRef<T[]>([]);
  const futureRef = useRef<T[]>([]);
  const [depth, setDepth] = useState({ past: 0, future: 0 });
  const syncDepth = useCallback(() => {
    const past = pastRef.current.length;
    const future = futureRef.current.length;
    setDepth((previous) =>
      previous.past === past && previous.future === future ? previous : { past, future },
    );
  }, []);

  const set = useCallback(
    (next: T | ((current: T) => T)) => {
      const current = currentRef.current;
      const resolved = typeof next === 'function' ? (next as (value: T) => T)(current) : next;
      if (equals(current, resolved)) return;
      pastRef.current.push(current);
      if (pastRef.current.length > limit) pastRef.current.shift();
      futureRef.current = [];
      currentRef.current = resolved;
      setValueState(resolved);
      syncDepth();
    },
    [syncDepth, equals, limit],
  );

  const reset = useCallback(
    (next: T) => {
      currentRef.current = next;
      pastRef.current = [];
      futureRef.current = [];
      setValueState(next);
      syncDepth();
    },
    [syncDepth],
  );

  const undo = useCallback(() => {
    const previous = pastRef.current.pop();
    if (previous === undefined) return;
    futureRef.current.push(currentRef.current);
    currentRef.current = previous;
    setValueState(previous);
    syncDepth();
  }, [syncDepth]);

  const redo = useCallback(() => {
    const next = futureRef.current.pop();
    if (next === undefined) return;
    pastRef.current.push(currentRef.current);
    currentRef.current = next;
    setValueState(next);
    syncDepth();
  }, [syncDepth]);

  return {
    value,
    set,
    reset,
    undo,
    redo,
    canUndo: depth.past > 0,
    canRedo: depth.future > 0,
  };
}
