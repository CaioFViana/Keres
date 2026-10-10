import type { SpatialPoint, SpatialRect } from '@keres/shared';
import { type MutableRefObject, useCallback } from 'react';
import { transformCenteredOn, transformFittingRect } from './canvasCameraMath';
import type { Transform } from './canvasViewportTypes';

interface CameraMovesInput {
  transformRef: MutableRefObject<Transform>;
  viewportRef: MutableRefObject<{ width: number; height: number }>;
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
  transformRef,
  viewportRef,
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
      transformRef.current = next;
      clamp();
      publish();
      setScaleState(transformRef.current.scale);
      syncOverlays(true);
    },
    [clamp, publish, setScaleState, syncOverlays, transformRef],
  );

  const centerOn = useCallback(
    (point: SpatialPoint, scale?: number) => {
      if (!viewportRef.current.width || !viewportRef.current.height) return;
      const target = Math.max(minScale, Math.min(maxScale, scale ?? transformRef.current.scale));
      apply(transformCenteredOn(point, target, viewportRef.current));
    },
    [apply, maxScale, minScale, transformRef, viewportRef],
  );

  const fitToRect = useCallback(
    (rect: SpatialRect) => {
      if (!viewportRef.current.width || !viewportRef.current.height) return;
      apply(transformFittingRect(rect, viewportRef.current, { minScale, maxScale }));
    },
    [apply, maxScale, minScale, viewportRef],
  );

  const zoomAt = useCallback(
    (factor: number, focus: { x: number; y: number }) => {
      zoomAround(transformRef.current.scale * factor, focus);
      setScaleState(transformRef.current.scale);
      syncOverlays();
    },
    [setScaleState, syncOverlays, transformRef, zoomAround],
  );

  const panBy = useCallback(
    (dx: number, dy: number) => {
      transformRef.current.x += dx;
      transformRef.current.y += dy;
      clamp();
      publish();
      syncOverlays();
    },
    [clamp, publish, syncOverlays, transformRef],
  );

  return { centerOn, fitToRect, zoomAt, panBy };
}
