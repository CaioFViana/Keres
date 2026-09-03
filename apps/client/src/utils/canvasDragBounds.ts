import type { CanvasWorldBounds } from './growingCanvasBounds';

/**
 * A generous guard against a malformed gesture creating an impractically large native surface.
 * Ordinary editing remains effectively unlimited, while one bad pointer value cannot allocate
 * millions of pixels of SVG and React Native layout at once.
 */
export const MAX_CANVAS_WORLD_COORDINATE = 16_384;

export interface CanvasDragFootprint {
  /** Distance from the item's position to its left edge. */
  left: number;
  /** Distance from the item's position to its top edge. */
  top: number;
  /** Distance from the item's position to its right edge. */
  right: number;
  /** Distance from the item's position to its bottom edge. */
  bottom: number;
}

interface CanvasPoint {
  x: number;
  y: number;
}

const EDGE_CROSSING_DISTANCE = 1;

/** Keeps persisted world positions finite and within the canvas safety envelope. */
export function clampCanvasWorldCoordinate(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return clamp(value, -MAX_CANVAS_WORLD_COORDINATE, MAX_CANVAS_WORLD_COORDINATE);
}

/**
 * Stages a dragged item at the next canvas page instead of allowing one raw pointer event to
 * request every missing page. The following move can continue naturally once that page exists.
 */
export function limitCanvasDragPosition(
  position: CanvasPoint,
  bounds: CanvasWorldBounds,
  footprint: CanvasDragFootprint,
  padding: number,
): CanvasPoint {
  return {
    x: limitAxis(
      position.x,
      bounds.originX,
      bounds.width,
      footprint.left,
      footprint.right,
      padding,
    ),
    y: limitAxis(
      position.y,
      bounds.originY,
      bounds.height,
      footprint.top,
      footprint.bottom,
      padding,
    ),
  };
}

function limitAxis(
  value: number,
  origin: number,
  length: number,
  leadingExtent: number,
  trailingExtent: number,
  padding: number,
): number {
  const safeValue = clampCanvasWorldCoordinate(value);
  const leadingLimit =
    origin === 0
      ? leadingExtent - EDGE_CROSSING_DISTANCE
      : origin + padding + leadingExtent - EDGE_CROSSING_DISTANCE;
  const trailingLimit = origin + length - trailingExtent - padding + EDGE_CROSSING_DISTANCE;
  return clamp(
    safeValue,
    Math.min(leadingLimit, trailingLimit),
    Math.max(leadingLimit, trailingLimit),
  );
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
