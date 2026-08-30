import { useLayoutEffect, useMemo, useState } from 'react';
import { growCanvasBounds, type CanvasWorldBounds } from '../utils/growingCanvasBounds';

/**
 * Keeps an interactive canvas surface stable through a gesture. Required bounds can move on every
 * frame, but the rendered surface advances only when the existing page is actually exhausted.
 */
export function useGrowingCanvasBounds(required: CanvasWorldBounds): CanvasWorldBounds {
  const [allocated, setAllocated] = useState(required);
  const { width, height, originX, originY } = required;
  const next = useMemo(
    () => growCanvasBounds(allocated, { width, height, originX, originY }),
    [allocated, height, originX, originY, width],
  );

  useLayoutEffect(() => {
    if (next === allocated) return;
    setAllocated(next);
  }, [allocated, next]);

  return next;
}
