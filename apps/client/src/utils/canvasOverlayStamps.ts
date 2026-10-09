import {
  canvasOverlayBounds,
  spatialRectIntersects,
  type CanvasOverlayType,
  type SpatialRect,
} from '@keres/shared';

/** The stamps that touch the render window, in z-order; equal z-indexes keep their list order. */
export function visibleCanvasStamps(
  overlays: readonly CanvasOverlayType[] | undefined,
  renderWindow: SpatialRect,
): Extract<CanvasOverlayType, { kind: 'stamp' }>[] {
  return (overlays ?? [])
    .filter(
      (overlay): overlay is Extract<CanvasOverlayType, { kind: 'stamp' }> =>
        overlay.kind === 'stamp',
    )
    .filter((stamp) => spatialRectIntersects(canvasOverlayBounds(stamp), renderWindow))
    .map((stamp, order) => ({ stamp, order }))
    .sort(
      (left, right) =>
        (left.stamp.zIndex ?? 0) - (right.stamp.zIndex ?? 0) || left.order - right.order,
    )
    .map(({ stamp }) => stamp);
}
