import { CANVAS_OVERLAY_STAMP_DEFAULT_SIZE } from '../schemas/CanvasOverlaySchemas';
import type { CanvasOverlayType } from '../schemas/CanvasOverlaySchemas';
import type { SpatialPoint, SpatialRect } from './spatialCanvas';

/**
 * Pure path math for canvas overlays, shared by the Skia renderer and the SVG exporters so
 * the screen and the exported file can never disagree. Every helper emits an SVG path `d`
 * (or polygon points the renderers close with Z) - never a platform drawing call.
 */

/**
 * Paint both renderers share: the Skia layer and the SVG export read these, so a stroke
 * or fill tuned on screen carries into the exported file with no second edit.
 */
export const CANVAS_OVERLAY_DEFAULT_STROKE_WIDTH = 2;
export const CANVAS_OVERLAY_DASH_INTERVALS = [6, 4] as const;
export const CANVAS_OVERLAY_POLYGON_FILL_OPACITY = 0.18;
export const CANVAS_OVERLAY_SHAPE_FILL_OPACITY = 0.25;
export const CANVAS_OVERLAY_ARROWHEAD_SIZE = 10;
export const CANVAS_OVERLAY_LABEL_FONT_SIZE = 11;
export const CANVAS_OVERLAY_LABEL_HALO_WIDTH = 4;

/** Polyline through `points`; `closed` appends the trailing Z (polygons). */
export function canvasOverlayPolylinePath(
  points: readonly SpatialPoint[],
  closed = false,
): string {
  const line = points.map((point) => `${point.x} ${point.y}`).join(' L ');
  return closed ? `M ${line} Z` : `M ${line}`;
}

/** Rect outline starting at the top-left corner, closed. */
export function canvasOverlayRectPath(x: number, y: number, width: number, height: number): string {
  return `M ${x} ${y} L ${x + width} ${y} L ${x + width} ${y + height} L ${x} ${y + height} Z`;
}

/** Ellipse inscribed in the rect, drawn as two arcs (Skia paths carry no oval primitive). */
export function canvasOverlayEllipsePath(
  x: number,
  y: number,
  width: number,
  height: number,
): string {
  const rx = width / 2;
  const ry = height / 2;
  const left = x;
  const right = x + width;
  const middle = y + ry;
  return (
    `M ${left} ${middle} ` +
    `A ${rx} ${ry} 0 1 0 ${right} ${middle} ` +
    `A ${rx} ${ry} 0 1 0 ${left} ${middle} Z`
  );
}

/**
 * Polygon-points string (`"x,y x,y x,y"`) for an arrowhead at `tip` pointing along `angle`
 * (radians, x-axis zero). Same triangle the edge layers draw; the size is in world units.
 */
export function canvasOverlayArrowhead(tip: SpatialPoint, angle: number, size = 10): string {
  return [
    [tip.x, tip.y],
    [tip.x - size * Math.cos(angle - 0.4), tip.y - size * Math.sin(angle - 0.4)],
    [tip.x - size * Math.cos(angle + 0.4), tip.y - size * Math.sin(angle + 0.4)],
  ]
    .map((pair) => pair.join(','))
    .join(' ');
}

/** Direction of the final segment, for a `directed` line's arrowhead. */
export function canvasOverlayFinalAngle(points: readonly SpatialPoint[]): number {
  const before = points[points.length - 2];
  const tip = points[points.length - 1];
  return Math.atan2(tip.y - before.y, tip.x - before.x);
}

export const CANVAS_OVERLAY_PRESETS = [
  'triangle',
  'square',
  'diamond',
  'pentagon',
  'hexagon',
  'star',
] as const;
export type CanvasOverlayPreset = (typeof CANVAS_OVERLAY_PRESETS)[number];

/** Inner radius of the star preset, relative to the outer one. */
const STAR_INNER_RATIO = 0.42;

/**
 * Pre-made polygon vertices inscribed in the dragged `rect`, ellipse-style: the horizontal
 * and vertical radii follow the region, so the shape fills what the user drew. Presets are
 * plain polygons once created - same infrastructure, no special kind - so the select tool
 * and vertex editing treat them like any drawn region.
 */
export function canvasOverlayPresetPoints(
  preset: CanvasOverlayPreset,
  rect: SpatialRect,
): SpatialPoint[] {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const rx = rect.width / 2;
  const ry = rect.height / 2;
  const regular = (sides: number, rotation: number): SpatialPoint[] =>
    Array.from({ length: sides }, (_, index) => {
      const angle = rotation + (index * 2 * Math.PI) / sides;
      return {
        x: cx + rx * Math.cos(angle),
        y: cy + ry * Math.sin(angle),
      };
    });
  switch (preset) {
    case 'triangle':
    case 'pentagon':
    case 'hexagon': {
      const sides = preset === 'triangle' ? 3 : preset === 'pentagon' ? 5 : 6;
      return regular(sides, -Math.PI / 2);
    }
    case 'square':
      // Corners on the diagonals: an axis-aligned square, not a diamond.
      return regular(4, -Math.PI / 4);
    case 'diamond':
      return regular(4, -Math.PI / 2);
    case 'star':
      return Array.from({ length: 10 }, (_, index) => {
        const angle = -Math.PI / 2 + (index * Math.PI) / 5;
        const ratio = index % 2 === 0 ? 1 : STAR_INNER_RATIO;
        return { x: cx + rx * ratio * Math.cos(angle), y: cy + ry * ratio * Math.sin(angle) };
      });
  }
}

/** Shortest distance from `point` to the segment `from`-`to`. */
export function distPointToSegment(
  point: SpatialPoint,
  from: SpatialPoint,
  to: SpatialPoint,
): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - from.x, point.y - from.y);
  const along = Math.min(
    1,
    Math.max(0, ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared),
  );
  return Math.hypot(point.x - (from.x + along * dx), point.y - (from.y + along * dy));
}

/** Ray-cast containment; points on the border count as inside. */
export function pointInPolygon(point: SpatialPoint, polygon: readonly SpatialPoint[]): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const from = polygon[previous];
    const to = polygon[index];
    if (
      from.y > point.y !== to.y > point.y &&
      point.x < ((to.x - from.x) * (point.y - from.y)) / (to.y - from.y) + from.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function overlayHit(overlay: CanvasOverlayType, point: SpatialPoint, tolerance: number): boolean {
  switch (overlay.kind) {
    case 'line':
      return overlay.points.some(
        (to, index) => index > 0 && distPointToSegment(point, overlay.points[index - 1], to) <= tolerance,
      );
    case 'polygon':
      return (
        pointInPolygon(point, overlay.points) ||
        overlay.points.some(
          (to, index) =>
            distPointToSegment(
              point,
              to,
              overlay.points[(index + 1) % overlay.points.length],
            ) <= tolerance,
        )
      );
    case 'frame':
      return (
        point.x >= overlay.x - tolerance &&
        point.x <= overlay.x + overlay.width + tolerance &&
        point.y >= overlay.y - tolerance &&
        point.y <= overlay.y + overlay.height + tolerance
      );
    case 'shape': {
      if (overlay.shapeType === 'rect') {
        return (
          point.x >= overlay.x - tolerance &&
          point.x <= overlay.x + overlay.width + tolerance &&
          point.y >= overlay.y - tolerance &&
          point.y <= overlay.y + overlay.height + tolerance
        );
      }
      const rx = overlay.width / 2 + tolerance;
      const ry = overlay.height / 2 + tolerance;
      const dx = (point.x - (overlay.x + overlay.width / 2)) / rx;
      const dy = (point.y - (overlay.y + overlay.height / 2)) / ry;
      return dx * dx + dy * dy <= 1;
    }
    case 'stamp': {
      const size = overlay.size ?? CANVAS_OVERLAY_STAMP_DEFAULT_SIZE;
      return Math.hypot(point.x - overlay.x, point.y - overlay.y) <= size / 2 + tolerance;
    }
  }
}

/**
 * Topmost overlay under `point` (highest `zIndex`, document order breaking ties), or null.
 * The select tool hit-tests taps through this; `tolerance` is in world units.
 */
export function hitTestCanvasOverlay(
  point: SpatialPoint,
  overlays: readonly CanvasOverlayType[],
  tolerance = 8,
): CanvasOverlayType | null {
  const ordered = overlays
    .map((overlay, order) => ({ overlay, order }))
    .sort(
      (left, right) =>
        (right.overlay.zIndex ?? 0) - (left.overlay.zIndex ?? 0) || right.order - left.order,
    );
  return ordered.find(({ overlay }) => overlayHit(overlay, point, tolerance))?.overlay ?? null;
}

/**
 * Snaps a drawn vertex to the nearest candidate (node centers, map points) inside `radius`,
 * so regions and lines can anchor on placed things. Returns the original point past the
 * radius - snapping assists, never hijacks.
 */
export function snapPointToTargets(
  point: SpatialPoint,
  targets: readonly SpatialPoint[],
  radius: number,
): SpatialPoint {
  let best: SpatialPoint | null = null;
  let bestDistance = radius;
  for (const target of targets) {
    const distance = Math.hypot(point.x - target.x, point.y - target.y);
    if (distance <= bestDistance) {
      bestDistance = distance;
      best = target;
    }
  }
  return best ?? point;
}
