import { maskToFillRings } from './sketchFill';
import { sketchItemBounds } from './sketchGeometry';
import type { SketchFill, SketchItem } from './sketchTypes';

/**
 * Erasing part of a fill. A fill is a set of even-odd rings, and cutting a hole in rings is polygon
 * clipping; instead the fill is painted into a small mask, the eraser's path is cleared out of it,
 * and the remaining region is traced back into rings (the same trace the bucket uses). It runs once
 * per fill when the gesture ends, never per pointer move, and only for fills the path touched.
 */

/** Longest side of the scratch mask, in pixels; bigger fills are erased at a lower resolution. */
const MASK_MAX_SIDE = 1400;
const MASK_MAX_SCALE = 2;
const MASK_MIN_SCALE = 0.25;
/** Tolerance (mask pixels) when simplifying the traced outline. */
const TRACE_EPSILON = 0.7;

interface Mask {
  data: Uint8Array;
  width: number;
  height: number;
  originX: number;
  originY: number;
  scale: number;
}

function paintRings(rings: readonly (readonly number[])[], mask: Mask): void {
  const { width, height, originX, originY, scale } = mask;
  const crossings: number[][] = Array.from({ length: height }, () => []);
  for (const ring of rings) {
    const count = Math.floor(ring.length / 2);
    for (let index = 0; index < count; index += 1) {
      const next = (index + 1) % count;
      const x1 = ring[index * 2];
      const y1 = ring[index * 2 + 1];
      const x2 = ring[next * 2];
      const y2 = ring[next * 2 + 1];
      if (y1 === y2) continue;
      const top = Math.min(y1, y2);
      const bottom = Math.max(y1, y2);
      // Rows whose center (row + 0.5) falls in [top, bottom): the usual half-open scanline rule.
      const first = Math.max(0, Math.ceil((top - originY) * scale - 0.5));
      const last = Math.min(height - 1, Math.ceil((bottom - originY) * scale - 0.5) - 1);
      for (let row = first; row <= last; row += 1) {
        const y = originY + (row + 0.5) / scale;
        crossings[row].push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
      }
    }
  }
  for (let row = 0; row < height; row += 1) {
    const xs = crossings[row].sort((left, right) => left - right);
    for (let pair = 0; pair + 1 < xs.length; pair += 2) {
      const from = Math.max(0, Math.ceil((xs[pair] - originX) * scale - 0.5));
      const to = Math.min(width - 1, Math.ceil((xs[pair + 1] - originX) * scale - 0.5) - 1);
      for (let column = from; column <= to; column += 1) mask.data[row * width + column] = 1;
    }
  }
}

function clearCapsule(
  mask: Mask,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  radius: number,
): number {
  const { width, height, originX, originY, scale } = mask;
  const left = Math.max(0, Math.floor((Math.min(ax, bx) - radius - originX) * scale));
  const right = Math.min(width - 1, Math.ceil((Math.max(ax, bx) + radius - originX) * scale));
  const top = Math.max(0, Math.floor((Math.min(ay, by) - radius - originY) * scale));
  const bottom = Math.min(height - 1, Math.ceil((Math.max(ay, by) + radius - originY) * scale));
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const limit = radius * radius;
  let cleared = 0;
  for (let row = top; row <= bottom; row += 1) {
    const y = originY + (row + 0.5) / scale;
    for (let column = left; column <= right; column += 1) {
      const index = row * width + column;
      if (!mask.data[index]) continue;
      const x = originX + (column + 0.5) / scale;
      const along =
        lengthSquared === 0
          ? 0
          : Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy) / lengthSquared));
      const px = ax + along * dx - x;
      const py = ay + along * dy - y;
      if (px * px + py * py <= limit) {
        mask.data[index] = 0;
        cleared += 1;
      }
    }
  }
  return cleared;
}

/**
 * The fill with the eraser's path cleared out of it: `undefined` when the path never touched it
 * (callers keep the same item), `null` when nothing is left, otherwise a new fill. `path` is the
 * eraser's centerline, flat; `radius` is half the eraser's size.
 */
export function eraseFillWithPath(
  fill: SketchFill,
  path: readonly number[],
  radius: number,
): SketchFill | null | undefined {
  if (path.length < 2) return undefined;
  const bounds = sketchItemBounds(fill);
  if (bounds.width <= 0 || bounds.height <= 0) return undefined;
  const scale = Math.min(
    MASK_MAX_SCALE,
    Math.max(MASK_MIN_SCALE, MASK_MAX_SIDE / Math.max(bounds.width, bounds.height)),
  );
  const mask: Mask = {
    width: Math.ceil(bounds.width * scale) + 1,
    height: Math.ceil(bounds.height * scale) + 1,
    originX: bounds.x,
    originY: bounds.y,
    scale,
    data: new Uint8Array(0),
  };
  mask.data = new Uint8Array(mask.width * mask.height);
  paintRings(fill.rings, mask);
  let cleared = 0;
  const count = Math.floor(path.length / 2);
  if (count === 1) {
    cleared += clearCapsule(mask, path[0], path[1], path[0], path[1], radius);
  } else {
    for (let index = 1; index < count; index += 1) {
      cleared += clearCapsule(
        mask,
        path[(index - 1) * 2],
        path[(index - 1) * 2 + 1],
        path[index * 2],
        path[index * 2 + 1],
        radius,
      );
    }
  }
  if (cleared === 0) return undefined;
  let remaining = 0;
  for (let index = 0; index < mask.data.length; index += 1) remaining += mask.data[index];
  if (remaining === 0) return null;
  const rings = maskToFillRings(
    {
      mask: mask.data,
      width: mask.width,
      height: mask.height,
      count: remaining,
      touchesEdge: false,
    },
    { scale, originX: bounds.x, originY: bounds.y, dilate: 0, epsilon: TRACE_EPSILON },
  );
  return rings.length === 0 ? null : { ...fill, rings };
}

export interface FillEraseResult {
  items: SketchItem[];
  changed: boolean;
}

/** Applies the eraser path to every fill in the list; strokes and untouched fills keep identity. */
export function eraseFillsAlongPath(
  items: readonly SketchItem[],
  path: readonly number[],
  radius: number,
): FillEraseResult {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let index = 0; index + 1 < path.length; index += 2) {
    minX = Math.min(minX, path[index]);
    maxX = Math.max(maxX, path[index]);
    minY = Math.min(minY, path[index + 1]);
    maxY = Math.max(maxY, path[index + 1]);
  }
  if (minX === Infinity) return { items: items as SketchItem[], changed: false };
  const out: SketchItem[] = [];
  let changed = false;
  for (const item of items) {
    if (item.kind !== 'fill') {
      out.push(item);
      continue;
    }
    const bounds = sketchItemBounds(item);
    const overlaps =
      bounds.x <= maxX + radius &&
      bounds.x + bounds.width >= minX - radius &&
      bounds.y <= maxY + radius &&
      bounds.y + bounds.height >= minY - radius;
    const erased = overlaps ? eraseFillWithPath(item, path, radius) : undefined;
    if (erased === undefined) {
      out.push(item);
      continue;
    }
    changed = true;
    if (erased !== null) out.push(erased);
  }
  return { items: changed ? out : (items as SketchItem[]), changed };
}
