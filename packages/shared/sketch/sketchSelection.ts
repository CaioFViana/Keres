import type { SpatialRect } from '../graphs/spatialCanvas';
import { rotateAboutMatrix, scaleAboutMatrix, translateMatrix } from './sketchGeometry';
import type { SketchMatrix, SketchPoint } from './sketchTypes';

/** Drag handles of a selection box: four scale corners, a rotate knob above, the body to move. */
export type SelectionHandle = 'move' | 'rotate' | 'nw' | 'ne' | 'se' | 'sw';

export interface SelectionHandlePoints {
  nw: SketchPoint;
  ne: SketchPoint;
  se: SketchPoint;
  sw: SketchPoint;
  rotate: SketchPoint;
}

/**
 * Handle positions for a box. `knobDistance` is how far above the top edge the rotate knob floats;
 * callers pass it in world units (a fixed pixel distance divided by the zoom) so it stays reachable.
 */
export function selectionHandlePoints(
  bounds: SpatialRect,
  knobDistance: number,
): SelectionHandlePoints {
  const { x, y, width, height } = bounds;
  return {
    nw: { x, y },
    ne: { x: x + width, y },
    se: { x: x + width, y: y + height },
    sw: { x, y: y + height },
    rotate: { x: x + width / 2, y: y - knobDistance },
  };
}

/** Which handle a point grabs, in a world-space `radius`; the body counts as `move`. */
export function hitSelectionHandle(
  bounds: SpatialRect,
  point: SketchPoint,
  radius: number,
  knobDistance: number,
): SelectionHandle | null {
  const handles = selectionHandlePoints(bounds, knobDistance);
  for (const name of ['rotate', 'nw', 'ne', 'se', 'sw'] as const) {
    if (Math.hypot(point.x - handles[name].x, point.y - handles[name].y) <= radius) return name;
  }
  if (
    point.x >= bounds.x - radius / 2 &&
    point.x <= bounds.x + bounds.width + radius / 2 &&
    point.y >= bounds.y - radius / 2 &&
    point.y <= bounds.y + bounds.height + radius / 2
  ) {
    return 'move';
  }
  return null;
}

const MIN_SCALE_FACTOR = 0.02;
const MAX_SCALE_FACTOR = 50;
/** Snap the rotation to 15 degree steps within this many radians of a step. */
const ROTATE_SNAP = (3 * Math.PI) / 180;
const ROTATE_STEP = Math.PI / 12;

/**
 * The transform a handle drag from `start` to `current` applies to the selection: translation for
 * the body, uniform scale about the opposite corner, rotation about the box center (with a soft
 * snap to 15 degree steps, so a straight turn is easy to land).
 */
export function selectionDragMatrix(
  handle: SelectionHandle,
  bounds: SpatialRect,
  start: SketchPoint,
  current: SketchPoint,
): SketchMatrix {
  if (handle === 'move') return translateMatrix(current.x - start.x, current.y - start.y);
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  if (handle === 'rotate') {
    let angle =
      Math.atan2(current.y - center.y, current.x - center.x) -
      Math.atan2(start.y - center.y, start.x - center.x);
    const snapped = Math.round(angle / ROTATE_STEP) * ROTATE_STEP;
    if (Math.abs(angle - snapped) <= ROTATE_SNAP) angle = snapped;
    return rotateAboutMatrix(angle, center.x, center.y);
  }
  const points = selectionHandlePoints(bounds, 0);
  const anchor =
    handle === 'nw'
      ? points.se
      : handle === 'ne'
        ? points.sw
        : handle === 'se'
          ? points.nw
          : points.ne;
  const before = Math.hypot(start.x - anchor.x, start.y - anchor.y);
  if (before < 1e-6) return translateMatrix(0, 0);
  const after = Math.hypot(current.x - anchor.x, current.y - anchor.y);
  const factor = Math.min(MAX_SCALE_FACTOR, Math.max(MIN_SCALE_FACTOR, after / before));
  return scaleAboutMatrix(factor, factor, anchor.x, anchor.y);
}

/** The four corners of a box after a transform, flat `[x, y, ...]` and in clockwise order. */
export function transformedBoundsCorners(bounds: SpatialRect, matrix: SketchMatrix): number[] {
  const corners = [
    [bounds.x, bounds.y],
    [bounds.x + bounds.width, bounds.y],
    [bounds.x + bounds.width, bounds.y + bounds.height],
    [bounds.x, bounds.y + bounds.height],
  ];
  return corners.flatMap(([x, y]) => [
    matrix.a * x + matrix.c * y + matrix.e,
    matrix.b * x + matrix.d * y + matrix.f,
  ]);
}

/** Mirrors the selection across its own vertical or horizontal center line. */
export function flipSelectionMatrix(
  axis: 'horizontal' | 'vertical',
  bounds: SpatialRect,
): SketchMatrix {
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  return axis === 'horizontal' ? scaleAboutMatrix(-1, 1, cx, cy) : scaleAboutMatrix(1, -1, cx, cy);
}

// ---------------------------------------------------------------- shapes

export type SketchShapeKind = 'line' | 'rect' | 'ellipse';

const ELLIPSE_SEGMENTS = 48;

/**
 * Flat polyline of a shape dragged from `from` to `to`, stroked with the current brush: a line is
 * two points, a rectangle a closed loop, an ellipse a 48-gon the smoothing turns round.
 */
export function sketchShapePoints(
  kind: SketchShapeKind,
  from: SketchPoint,
  to: SketchPoint,
): number[] {
  if (kind === 'line') return [from.x, from.y, to.x, to.y];
  const left = Math.min(from.x, to.x);
  const right = Math.max(from.x, to.x);
  const top = Math.min(from.y, to.y);
  const bottom = Math.max(from.y, to.y);
  if (kind === 'rect') {
    return [left, top, right, top, right, bottom, left, bottom, left, top];
  }
  const cx = (left + right) / 2;
  const cy = (top + bottom) / 2;
  const rx = (right - left) / 2;
  const ry = (bottom - top) / 2;
  const points: number[] = [];
  for (let index = 0; index <= ELLIPSE_SEGMENTS; index += 1) {
    const angle = (index / ELLIPSE_SEGMENTS) * Math.PI * 2;
    points.push(cx + rx * Math.cos(angle), cy + ry * Math.sin(angle));
  }
  return points;
}
