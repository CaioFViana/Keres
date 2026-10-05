import {
  canvasOverlayTextFontSize,
  wrapCanvasOverlayText,
  CANVAS_OVERLAY_TEXT_LINE_HEIGHT,
} from '../schemas/CanvasOverlaySchemas';
import type { SpatialPoint, SpatialRect } from './spatialCanvas';

/**
 * Speech balloon geometry, shared by the Skia renderer, the SVG export and the editing chrome. A
 * balloon is an ellipse plus one tail point: the user edits the four corners of the ellipse and
 * drags the tail tip, and the tail's base picks itself among eight axes around the ellipse.
 */

/** Axes the tail may leave from: E, SE, S, SW, W, NW, N, NE (45 degrees apart, clockwise on screen). */
export const CANVAS_BALLOON_AXES = 8;
export const CANVAS_BALLOON_DEFAULT_FONT_SIZE = 16;
/** Share of the ellipse's width the text may use (the inscribed rectangle is about 0.71). */
export const CANVAS_BALLOON_TEXT_WIDTH_RATIO = 0.74;
/** The tail tip never sits closer than this to the ellipse (in ellipse radii). */
const MIN_TIP_RADII = 1.25;
/** How far past the ellipse a fresh balloon's tail reaches, relative to its smaller side. */
const DEFAULT_TAIL_REACH = 0.4;

const TAU = Math.PI * 2;

export type BalloonRect = Pick<SpatialRect, 'x' | 'y' | 'width' | 'height'>;

/** Point on the ellipse at parametric angle `angle` (0 = east, growing clockwise on screen). */
export function balloonEllipsePoint(rect: BalloonRect, angle: number): SpatialPoint {
  return {
    x: rect.x + rect.width / 2 + (rect.width / 2) * Math.cos(angle),
    y: rect.y + rect.height / 2 + (rect.height / 2) * Math.sin(angle),
  };
}

/** The axis, 0 to 7, whose direction the tip lies closest to as seen from the ellipse center. */
export function balloonTailAxis(rect: BalloonRect, tip: SpatialPoint): number {
  const nx = (tip.x - (rect.x + rect.width / 2)) / (rect.width / 2);
  const ny = (tip.y - (rect.y + rect.height / 2)) / (rect.height / 2);
  const angle = Math.atan2(ny, nx);
  const axis = Math.round(angle / (TAU / CANVAS_BALLOON_AXES));
  return ((axis % CANVAS_BALLOON_AXES) + CANVAS_BALLOON_AXES) % CANVAS_BALLOON_AXES;
}

/** Half the angular width of the tail's base: wide enough to read, narrow on a big balloon. */
function tailHalfAngle(rect: BalloonRect): number {
  return Math.min(0.34, Math.max(0.12, 22 / Math.max(rect.width / 2, rect.height / 2)));
}

/** The two points where the tail leaves the ellipse for an axis: `[before, after]` along the outline. */
export function balloonTailBase(rect: BalloonRect, axis: number): [SpatialPoint, SpatialPoint] {
  const center = (axis * TAU) / CANVAS_BALLOON_AXES;
  const half = tailHalfAngle(rect);
  return [balloonEllipsePoint(rect, center - half), balloonEllipsePoint(rect, center + half)];
}

/** Keeps the tip clear of the ellipse (a tail that points inward would vanish). */
export function clampBalloonTip(rect: BalloonRect, tip: SpatialPoint): SpatialPoint {
  const rx = rect.width / 2;
  const ry = rect.height / 2;
  const cx = rect.x + rx;
  const cy = rect.y + ry;
  let nx = (tip.x - cx) / rx;
  let ny = (tip.y - cy) / ry;
  let radius = Math.hypot(nx, ny);
  if (radius < 1e-6) {
    // Dead center: south-east, the axis a fresh balloon uses.
    nx = Math.SQRT1_2;
    ny = Math.SQRT1_2;
    radius = 1;
  }
  if (radius >= MIN_TIP_RADII) return tip;
  const scale = MIN_TIP_RADII / radius;
  return { x: cx + nx * scale * rx, y: cy + ny * scale * ry };
}

/** Where a new balloon's tail points: out of the south-east axis, by a fraction of its size. */
export function defaultBalloonTail(rect: BalloonRect): SpatialPoint {
  const origin = balloonEllipsePoint(rect, Math.PI / 4);
  const reach = Math.min(rect.width, rect.height) * DEFAULT_TAIL_REACH;
  return { x: origin.x + reach * Math.SQRT1_2, y: origin.y + reach * Math.SQRT1_2 };
}

function fmt(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/**
 * The balloon as one closed outline: the ellipse arc from one side of the tail's base around to the
 * other, then out to the tip and back. One path means one fill and one stroke, with no line across
 * the base where the tail meets the body.
 */
export function balloonPath(rect: BalloonRect, tip: SpatialPoint): string {
  const axis = balloonTailAxis(rect, tip);
  const [before, after] = balloonTailBase(rect, axis);
  const rx = rect.width / 2;
  const ry = rect.height / 2;
  return (
    `M${fmt(after.x)} ${fmt(after.y)}` +
    `A${fmt(rx)} ${fmt(ry)} 0 1 1 ${fmt(before.x)} ${fmt(before.y)}` +
    `L${fmt(tip.x)} ${fmt(tip.y)}Z`
  );
}

/** The tail alone, for hit testing: base corner, tip, base corner. */
export function balloonTailPolygon(rect: BalloonRect, tip: SpatialPoint): SpatialPoint[] {
  const [before, after] = balloonTailBase(rect, balloonTailAxis(rect, tip));
  return [before, tip, after];
}

export interface BalloonText {
  lines: string[];
  fontSize: number;
  lineHeight: number;
  /** Top of the text block, centered vertically on the ellipse. */
  top: number;
}

/** The wrapped, centered text block of a balloon; the same lines on screen and in the export. */
export function balloonText(
  overlay: BalloonRect & { content: string; fontSize?: number },
): BalloonText {
  const fontSize = canvasOverlayTextFontSize({
    fontSize: overlay.fontSize ?? CANVAS_BALLOON_DEFAULT_FONT_SIZE,
  });
  const lines = wrapCanvasOverlayText(
    overlay.content,
    overlay.width * CANVAS_BALLOON_TEXT_WIDTH_RATIO,
    fontSize,
  );
  const lineHeight = fontSize * CANVAS_OVERLAY_TEXT_LINE_HEIGHT;
  const top = overlay.y + overlay.height / 2 - (lines.length * lineHeight) / 2;
  return { lines, fontSize, lineHeight, top };
}

/** True when the point lies on the balloon: inside the ellipse or on the tail, within `tolerance`. */
export function balloonContains(
  rect: BalloonRect,
  tip: SpatialPoint,
  point: SpatialPoint,
  tolerance: number,
): boolean {
  const rx = rect.width / 2 + tolerance;
  const ry = rect.height / 2 + tolerance;
  const dx = (point.x - (rect.x + rect.width / 2)) / rx;
  const dy = (point.y - (rect.y + rect.height / 2)) / ry;
  if (dx * dx + dy * dy <= 1) return true;
  const [before, , after] = balloonTailPolygon(rect, tip);
  // Triangle sign test, padded: a point within `tolerance` of any tail edge counts.
  const near = (a: SpatialPoint, b: SpatialPoint) => {
    const lx = b.x - a.x;
    const ly = b.y - a.y;
    const lengthSquared = lx * lx + ly * ly;
    const along =
      lengthSquared === 0
        ? 0
        : Math.min(1, Math.max(0, ((point.x - a.x) * lx + (point.y - a.y) * ly) / lengthSquared));
    return Math.hypot(point.x - (a.x + along * lx), point.y - (a.y + along * ly)) <= tolerance;
  };
  const sign = (a: SpatialPoint, b: SpatialPoint) =>
    (point.x - b.x) * (a.y - b.y) - (a.x - b.x) * (point.y - b.y);
  const d1 = sign(before, tip);
  const d2 = sign(tip, after);
  const d3 = sign(after, before);
  const hasNegative = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPositive = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNegative && hasPositive) || near(before, tip) || near(tip, after);
}
