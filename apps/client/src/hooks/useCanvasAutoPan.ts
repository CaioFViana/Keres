import type { SpatialPoint } from '@keres/shared';
import { type MutableRefObject, useCallback, useEffect, useRef } from 'react';
import { AUTO_PAN_EDGE, AUTO_PAN_MAX_SCREEN_SPEED, type Transform } from './canvasViewportTypes';

interface AutoPanInput {
  transform: MutableRefObject<Transform>;
  viewport: MutableRefObject<{ width: number; height: number }>;
  /** Told how far the camera moved in world units on every frame, so a dragged pin can follow it. */
  onAutoPan: MutableRefObject<((delta: SpatialPoint) => void) | undefined>;
  cameraTopLeft(): SpatialPoint;
  clamp(): void;
  publish(): void;
  syncOverlays(force?: boolean): void;
}

/**
 * The camera drifts while a dragged item is held near an edge of the canvas, so it can be carried
 * past what is on screen. `updateAutoPan` is fed the pointer's position on every move of the drag
 * and `stopAutoPan` ends the drift when the drag does.
 */
export function useCanvasAutoPan({
  transform,
  viewport,
  onAutoPan,
  cameraTopLeft,
  clamp,
  publish,
  syncOverlays,
}: AutoPanInput) {
  const autoPan = useRef({ x: 0, y: 0, frame: null as number | null, timestamp: 0 });
  const autoPanFrameRef = useRef<((timestamp: number) => void) | null>(null);

  const stopAutoPan = useCallback(() => {
    if (autoPan.current.frame !== null) cancelAnimationFrame(autoPan.current.frame);
    autoPan.current = { x: 0, y: 0, frame: null, timestamp: 0 };
  }, []);

  const autoPanFrame = useCallback(
    (timestamp: number) => {
      const state = autoPan.current;
      state.frame = null;
      if (!state.x && !state.y) return;
      const elapsed = Math.min(48, Math.max(1, timestamp - state.timestamp || 16));
      state.timestamp = timestamp;
      const before = cameraTopLeft();
      transform.current.x -= (state.x * (AUTO_PAN_MAX_SCREEN_SPEED * elapsed)) / 1000;
      transform.current.y -= (state.y * (AUTO_PAN_MAX_SCREEN_SPEED * elapsed)) / 1000;
      clamp();
      const after = cameraTopLeft();
      onAutoPan.current?.({ x: after.x - before.x, y: after.y - before.y });
      publish();
      syncOverlays();
      state.frame = requestAnimationFrame((nextTimestamp) =>
        autoPanFrameRef.current?.(nextTimestamp),
      );
    },
    [cameraTopLeft, clamp, onAutoPan, publish, syncOverlays, transform],
  );
  useEffect(() => {
    autoPanFrameRef.current = autoPanFrame;
  }, [autoPanFrame]);

  const updateAutoPan = useCallback(
    (screenPoint: SpatialPoint) => {
      const { width, height } = viewport.current;
      const edgeFactor = (value: number, size: number) => {
        if (value < AUTO_PAN_EDGE) return -(1 - value / AUTO_PAN_EDGE);
        if (value > size - AUTO_PAN_EDGE) return (value - (size - AUTO_PAN_EDGE)) / AUTO_PAN_EDGE;
        return 0;
      };
      const x = width ? edgeFactor(screenPoint.x, width) : 0;
      const y = height ? edgeFactor(screenPoint.y, height) : 0;
      autoPan.current.x = x;
      autoPan.current.y = y;
      if ((x || y) && autoPan.current.frame === null) {
        autoPan.current.timestamp = 0;
        autoPan.current.frame = requestAnimationFrame((timestamp) =>
          autoPanFrameRef.current?.(timestamp),
        );
      }
      if (!x && !y) stopAutoPan();
    },
    [stopAutoPan, viewport],
  );

  useEffect(() => stopAutoPan, [stopAutoPan]);

  return { stopAutoPan, updateAutoPan };
}
