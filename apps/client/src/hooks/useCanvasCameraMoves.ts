import type { SpatialPoint, SpatialRect } from '@keres/shared';
import { type MutableRefObject, useCallback } from 'react';
import { transformCenteredOn, transformFittingRect } from './canvasCameraMath';
import type { Transform } from './canvasViewportTypes';

interface CameraMovesInput {
  transform: MutableRefObject<Transform>;
  viewport: MutableRefObject<{ width: number; height: number }>;
  minScale: number;
  maxScale: number;
  clamp(): void;
  publish(): void;
  syncOverlays(force?: boolean): void;
  zoomAround(scale: number, focus: { x: number; y: number }): void;
  setScaleState(scale: number): void;
}

/**
 * The camera moves a screen asks for by name, apart from fitting the whole drawing: look at a point
 * or at a part of the drawing (a searched node, the selection), zoom under the cursor, and pan by a
 * step. They write the same camera `fitToScreen` writes, then publish it the same way.
 */
export function useCanvasCameraMoves({
  transform,
  viewport,
  minScale,
  maxScale,
  clamp,
  publish,
  syncOverlays,
  zoomAround,
  setScaleState,
}: CameraMovesInput) {
  const apply = useCallback(
    (next: Transform) => {
      transform.current = next;
      clamp();
      publish();
      setScaleState(transform.current.scale);
      syncOverlays(true);
    },
    [clamp, publish, setScaleState, syncOverlays, transform],
  );

  const centerOn = useCallback(
    (point: SpatialPoint, scale?: number) => {
      if (!viewport.current.width || !viewport.current.height) return;
      const target = Math.max(minScale, Math.min(maxScale, scale ?? transform.current.scale));
      apply(transformCenteredOn(point, target, viewport.current));
    },
    [apply, maxScale, minScale, transform, viewport],
  );

  const fitToRect = useCallback(
    (rect: SpatialRect) => {
      if (!viewport.current.width || !viewport.current.height) return;
      apply(transformFittingRect(rect, viewport.current, { minScale, maxScale }));
    },
    [apply, maxScale, minScale, viewport],
  );

  const zoomAt = useCallback(
    (factor: number, focus: { x: number; y: number }) => {
      zoomAround(transform.current.scale * factor, focus);
      setScaleState(transform.current.scale);
      syncOverlays();
    },
    [setScaleState, syncOverlays, transform, zoomAround],
  );

  const panBy = useCallback(
    (dx: number, dy: number) => {
      transform.current.x += dx;
      transform.current.y += dy;
      clamp();
      publish();
      syncOverlays();
    },
    [clamp, publish, syncOverlays, transform],
  );

  return { centerOn, fitToRect, zoomAt, panBy };
}
