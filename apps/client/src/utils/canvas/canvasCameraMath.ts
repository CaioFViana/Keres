import type { SpatialPoint, SpatialRect } from '@keres/shared';
import { FIT_MARGIN, type Transform } from './canvasViewportTypes';

/** How much the camera moves per arrow key press, in screen pixels. */
export const KEY_PAN_STEP = 64;
/** The zoom of one `+` or `-` key press, the same step as the on-screen buttons. */
export const KEY_ZOOM_STEP = 1.25;
/** A framed node or small group is not blown up past this scale: it should stay readable in its context. */
export const MAX_FOCUS_SCALE = 1.2;

/**
 * The zoom factor of one wheel event. A wheel reports pixels, lines or pages depending on the device;
 * all are brought to pixels and clamped, so a free-spinning wheel does not throw the camera across the map.
 */
export function wheelZoomFactor(deltaY: number, deltaMode: number): number {
  const pixels = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 400 : deltaY;
  return Math.exp(-Math.max(-300, Math.min(300, pixels)) * 0.0016);
}

/** The camera that puts `point` (world coordinates) in the middle of the viewport at `scale`. */
export function transformCenteredOn(
  point: SpatialPoint,
  scale: number,
  viewport: { width: number; height: number },
): Transform {
  return {
    scale,
    x: viewport.width / 2 - point.x * scale,
    y: viewport.height / 2 - point.y * scale,
  };
}

/**
 * The camera that shows `rect` (world coordinates) whole, centred, with the usual margin. The scale
 * stays inside the canvas limits and never goes above `MAX_FOCUS_SCALE`, so a single small node is
 * centred rather than magnified.
 */
export function transformFittingRect(
  rect: SpatialRect,
  viewport: { width: number; height: number },
  limits: { minScale: number; maxScale: number },
): Transform {
  const target =
    rect.width > 0 && rect.height > 0
      ? Math.min(viewport.width / rect.width, viewport.height / rect.height) * FIT_MARGIN
      : MAX_FOCUS_SCALE;
  const scale = Math.max(limits.minScale, Math.min(limits.maxScale, MAX_FOCUS_SCALE, target));
  return transformCenteredOn(
    { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
    scale,
    viewport,
  );
}
