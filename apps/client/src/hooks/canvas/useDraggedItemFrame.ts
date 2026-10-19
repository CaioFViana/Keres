import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The drag state of a canvas: the dragged item is published at most once per animation frame, and
 * the auto-pan offset accumulates while the viewport scrolls under a pointer that is dragging.
 */
export function useDraggedItemFrame<TDrag extends { x: number; y: number }>() {
  const [activeDrag, setActiveDrag] = useState<TDrag | null>(null);
  const activeDragRef = useRef<TDrag | null>(null);
  const pendingDragRef = useRef<TDrag | null>(null);
  const dragFrameRef = useRef<number | null>(null);
  /** How far the viewport has auto-panned during the current drag; added to the pointer position. */
  const autoPanOffsetRef = useRef({ x: 0, y: 0 });

  const publishPendingDrag = useCallback(() => {
    dragFrameRef.current = null;
    const next = pendingDragRef.current;
    pendingDragRef.current = null;
    if (!next) return;
    activeDragRef.current = next;
    setActiveDrag(next);
  }, []);

  const scheduleDrag = useCallback(() => {
    if (dragFrameRef.current === null)
      dragFrameRef.current = requestAnimationFrame(publishPendingDrag);
  }, [publishPendingDrag]);

  /** Queues the dragged item's next position; it is published on the next frame. */
  const queueDrag = useCallback(
    (next: TDrag) => {
      pendingDragRef.current = next;
      scheduleDrag();
    },
    [scheduleDrag],
  );

  /** The viewport's auto-pan handler: moves the dragged item by the pan it just applied. */
  const adjustForAutoPan = useCallback(
    (delta: { x: number; y: number }) => {
      const current = pendingDragRef.current ?? activeDragRef.current;
      if (!current) return;
      autoPanOffsetRef.current = {
        x: autoPanOffsetRef.current.x + delta.x,
        y: autoPanOffsetRef.current.y + delta.y,
      };
      pendingDragRef.current = { ...current, x: current.x + delta.x, y: current.y + delta.y };
      scheduleDrag();
    },
    [scheduleDrag],
  );

  /** Ends the drag: cancels the frame still waiting and returns the latest position, if any. */
  const endDrag = useCallback((): TDrag | null => {
    if (dragFrameRef.current !== null) cancelAnimationFrame(dragFrameRef.current);
    dragFrameRef.current = null;
    const next = pendingDragRef.current ?? activeDragRef.current;
    pendingDragRef.current = null;
    activeDragRef.current = null;
    setActiveDrag(null);
    return next;
  }, []);

  useEffect(
    () => () => {
      if (dragFrameRef.current !== null) cancelAnimationFrame(dragFrameRef.current);
    },
    [],
  );

  return { activeDrag, queueDrag, adjustForAutoPan, endDrag, autoPanOffsetRef };
}
