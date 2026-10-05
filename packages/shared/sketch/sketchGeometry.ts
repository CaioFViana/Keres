import type { SpatialRect } from '../graphs/spatialCanvas';
import {
  SKETCH_BRUSHES,
  type SketchFill,
  type SketchItem,
  type SketchMatrix,
  type SketchStroke,
} from './sketchTypes';

/** Rounds for path data: two decimals keeps SVG small and Skia identical. */
function fmt(value: number): string {
  return String(Math.round(value * 100) / 100);
}

// ---------------------------------------------------------------- bounds

const boundsCache = new WeakMap<SketchItem, SpatialRect>();

function flatBounds(
  lists: readonly (readonly number[])[],
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const points of lists) {
    for (let index = 0; index + 1 < points.length; index += 2) {
      const x = points[index];
      const y = points[index + 1];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return minX === Infinity ? null : { minX, minY, maxX, maxY };
}

/** World-space box of the painted area (strokes include half their width). Cached per item. */
export function sketchItemBounds(item: SketchItem): SpatialRect {
  const cached = boundsCache.get(item);
  if (cached) return cached;
  const raw = flatBounds(item.kind === 'stroke' ? [item.points] : item.rings);
  const pad = item.kind === 'stroke' ? item.size / 2 : 0;
  const rect: SpatialRect = raw
    ? {
        x: raw.minX - pad,
        y: raw.minY - pad,
        width: raw.maxX - raw.minX + pad * 2,
        height: raw.maxY - raw.minY + pad * 2,
      }
    : { x: 0, y: 0, width: 0, height: 0 };
  boundsCache.set(item, rect);
  return rect;
}

export function sketchItemsBounds(items: readonly SketchItem[]): SpatialRect | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const item of items) {
    const rect = sketchItemBounds(item);
    if (rect.x < minX) minX = rect.x;
    if (rect.y < minY) minY = rect.y;
    if (rect.x + rect.width > maxX) maxX = rect.x + rect.width;
    if (rect.y + rect.height > maxY) maxY = rect.y + rect.height;
  }
  return minX === Infinity ? null : { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function rectsOverlap(a: SpatialRect, b: SpatialRect): boolean {
  return (
    a.x <= b.x + b.width && b.x <= a.x + a.width && a.y <= b.y + b.height && b.y <= a.y + a.height
  );
}

export function sketchItemIntersectsRect(item: SketchItem, rect: SpatialRect): boolean {
  return rectsOverlap(sketchItemBounds(item), rect);
}

// ---------------------------------------------------------------- path data

/** A turn sharper than this (radians, about 55 degrees) is a corner the pen meant, not a curve. */
const CORNER_ANGLE = 0.96;

function isCornerAt(points: readonly number[], index: number): boolean {
  const ax = points[index * 2] - points[(index - 1) * 2];
  const ay = points[index * 2 + 1] - points[(index - 1) * 2 + 1];
  const bx = points[(index + 1) * 2] - points[index * 2];
  const by = points[(index + 1) * 2 + 1] - points[index * 2 + 1];
  const lengths = Math.hypot(ax, ay) * Math.hypot(bx, by);
  if (lengths === 0) return false;
  const cosine = (ax * bx + ay * by) / lengths;
  return Math.acos(Math.min(1, Math.max(-1, cosine))) > CORNER_ANGLE;
}

/**
 * A stroke as SVG path data. Gentle bends are smoothed through segment midpoints (quadratic
 * curves with the recorded points as control points), which turns the simplified polyline of a
 * hand drawn curve back into a smooth one. Sharp turns stay sharp, so boxes, roofs and arrowheads
 * keep their corners. Both the Skia renderer and the SVG export read this, so the canvas and
 * the export draw the same curve. A single point becomes a hairline segment so round caps still
 * paint a dot.
 */
export function sketchStrokePathData(points: readonly number[]): string {
  const count = Math.floor(points.length / 2);
  if (count === 0) return '';
  const x = (index: number) => points[index * 2];
  const y = (index: number) => points[index * 2 + 1];
  if (count === 1) return `M${fmt(x(0))} ${fmt(y(0))}L${fmt(x(0) + 0.01)} ${fmt(y(0))}`;
  if (count === 2) {
    return `M${fmt(x(0))} ${fmt(y(0))}L${fmt(x(1))} ${fmt(y(1))}`;
  }
  let d = `M${fmt(x(0))} ${fmt(y(0))}`;
  let atMidpoint = false;
  for (let index = 1; index < count - 1; index += 1) {
    if (isCornerAt(points, index)) {
      d += `L${fmt(x(index))} ${fmt(y(index))}`;
      atMidpoint = false;
      continue;
    }
    // Enter the bend at the midpoint of the incoming segment (the previous bend already ended
    // there, so only the first bend or one after a corner needs the move).
    if (!atMidpoint) {
      d += `L${fmt((x(index - 1) + x(index)) / 2)} ${fmt((y(index - 1) + y(index)) / 2)}`;
    }
    d += `Q${fmt(x(index))} ${fmt(y(index))} ${fmt((x(index) + x(index + 1)) / 2)} ${fmt((y(index) + y(index + 1)) / 2)}`;
    atMidpoint = true;
  }
  d += `L${fmt(x(count - 1))} ${fmt(y(count - 1))}`;
  return d;
}

/** A fill as SVG path data; paint it with the even-odd rule so inner rings are holes. */
export function sketchFillPathData(rings: readonly (readonly number[])[]): string {
  let d = '';
  for (const ring of rings) {
    const count = Math.floor(ring.length / 2);
    if (count < 3) continue;
    d += `M${fmt(ring[0])} ${fmt(ring[1])}`;
    for (let index = 1; index < count; index += 1) {
      d += `L${fmt(ring[index * 2])} ${fmt(ring[index * 2 + 1])}`;
    }
    d += 'Z';
  }
  return d;
}

export function sketchStrokeLineCap(stroke: SketchStroke): 'round' | 'butt' {
  return SKETCH_BRUSHES[stroke.brush].cap;
}

// ---------------------------------------------------------------- polylines

function distanceToSegmentSquared(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  let t = 0;
  if (lengthSquared > 0) {
    t = Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  }
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return (px - cx) * (px - cx) + (py - cy) * (py - cy);
}

/** Ramer-Douglas-Peucker over a flat polyline; endpoints always survive. */
export function simplifyFlatPoints(points: readonly number[], epsilon: number): number[] {
  const count = Math.floor(points.length / 2);
  if (count <= 2) return [...points];
  const keep = new Uint8Array(count);
  keep[0] = 1;
  keep[count - 1] = 1;
  const limit = epsilon * epsilon;
  const stack: number[] = [0, count - 1];
  while (stack.length > 0) {
    const to = stack.pop() as number;
    const from = stack.pop() as number;
    let bestIndex = -1;
    let bestDistance = limit;
    for (let index = from + 1; index < to; index += 1) {
      const distance = distanceToSegmentSquared(
        points[index * 2],
        points[index * 2 + 1],
        points[from * 2],
        points[from * 2 + 1],
        points[to * 2],
        points[to * 2 + 1],
      );
      if (distance > bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }
    if (bestIndex > 0) {
      keep[bestIndex] = 1;
      stack.push(from, bestIndex, bestIndex, to);
    }
  }
  const out: number[] = [];
  for (let index = 0; index < count; index += 1) {
    if (keep[index]) out.push(points[index * 2], points[index * 2 + 1]);
  }
  return out;
}

/** Drops consecutive duplicate points. */
function dedupePoints(points: readonly number[]): number[] {
  const out: number[] = [];
  for (let index = 0; index + 1 < points.length; index += 2) {
    const length = out.length;
    if (length >= 2 && out[length - 2] === points[index] && out[length - 1] === points[index + 1]) {
      continue;
    }
    out.push(points[index], points[index + 1]);
  }
  return out;
}

/** Subdivides segments so no gap exceeds `step`; original vertices are all kept. */
export function densifyFlatPoints(points: readonly number[], step: number): number[] {
  const count = Math.floor(points.length / 2);
  if (count === 0) return [];
  const out: number[] = [points[0], points[1]];
  for (let index = 1; index < count; index += 1) {
    const ax = points[(index - 1) * 2];
    const ay = points[(index - 1) * 2 + 1];
    const bx = points[index * 2];
    const by = points[index * 2 + 1];
    const parts = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
    for (let part = 1; part <= parts; part += 1) {
      const t = part / parts;
      out.push(ax + (bx - ax) * t, ay + (by - ay) * t);
    }
  }
  return out;
}

export function flatPolylineLength(points: readonly number[]): number {
  let length = 0;
  for (let index = 2; index + 1 < points.length; index += 2) {
    length += Math.hypot(points[index] - points[index - 2], points[index + 1] - points[index - 1]);
  }
  return length;
}

/** Ray-cast containment against one flat ring. */
export function pointInFlatRing(x: number, y: number, ring: readonly number[]): boolean {
  const count = Math.floor(ring.length / 2);
  let inside = false;
  for (let index = 0, previous = count - 1; index < count; previous = index++) {
    const ix = ring[index * 2];
    const iy = ring[index * 2 + 1];
    const px = ring[previous * 2];
    const py = ring[previous * 2 + 1];
    if (iy > y !== py > y && x < ((px - ix) * (y - iy)) / (py - iy) + ix) inside = !inside;
  }
  return inside;
}

/** Even-odd containment across rings (inner rings are holes). */
export function pointInFlatRings(
  x: number,
  y: number,
  rings: readonly (readonly number[])[],
): boolean {
  let inside = false;
  for (const ring of rings) {
    if (pointInFlatRing(x, y, ring)) inside = !inside;
  }
  return inside;
}

// ---------------------------------------------------------------- splitting

/** Pieces shorter than this (in samples) never survive a split unless the stroke was a dot. */
const MIN_PIECE_SAMPLES = 2;

export interface StrokeSplit {
  inside: SketchStroke[];
  outside: SketchStroke[];
}

/**
 * Cuts a stroke wherever `isInside` flips, sampling the polyline at `step` world units. Returns
 * null when no sample is inside (the stroke is untouched), so callers keep the same reference.
 */
export function splitStroke(
  stroke: SketchStroke,
  isInside: (x: number, y: number) => boolean,
  step: number,
): StrokeSplit | null {
  const samples = densifyFlatPoints(stroke.points, step);
  const count = samples.length / 2;
  const flags = new Uint8Array(count);
  let anyInside = false;
  for (let index = 0; index < count; index += 1) {
    if (isInside(samples[index * 2], samples[index * 2 + 1])) {
      flags[index] = 1;
      anyInside = true;
    }
  }
  if (!anyInside) return null;
  const isDot = stroke.points.length <= 2;
  const split: StrokeSplit = { inside: [], outside: [] };
  let runStart = 0;
  for (let index = 1; index <= count; index += 1) {
    if (index < count && flags[index] === flags[runStart]) continue;
    const length = index - runStart;
    if (length >= MIN_PIECE_SAMPLES || isDot) {
      // A run is flanked by one sample of the opposite side on each end: extend it by one so the
      // piece touches its neighbour and the cut leaves no visible gap between inside/outside.
      const from = flags[runStart] === 1 && runStart > 0 ? runStart - 1 : runStart;
      const to = flags[runStart] === 1 && index < count ? index : index - 1;
      const piece = samples.slice(from * 2, to * 2 + 2);
      const simplified = simplifyFlatPoints(piece, 0.3);
      const target = flags[runStart] === 1 ? split.inside : split.outside;
      target.push({ ...stroke, points: simplified });
    }
    runStart = index;
  }
  return split;
}

// ---------------------------------------------------------------- eraser

/** Distance from a point to the eraser's flat polyline, squared. */
function distanceToPolylineSquared(x: number, y: number, path: readonly number[]): number {
  if (path.length === 2) {
    return (x - path[0]) * (x - path[0]) + (y - path[1]) * (y - path[1]);
  }
  let best = Infinity;
  for (let index = 2; index + 1 < path.length; index += 2) {
    const distance = distanceToSegmentSquared(
      x,
      y,
      path[index - 2],
      path[index - 1],
      path[index],
      path[index + 1],
    );
    if (distance < best) best = distance;
  }
  return best;
}

function pathBounds(path: readonly number[], pad: number): SpatialRect {
  const raw = flatBounds([path]) ?? { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return {
    x: raw.minX - pad,
    y: raw.minY - pad,
    width: raw.maxX - raw.minX + pad * 2,
    height: raw.maxY - raw.minY + pad * 2,
  };
}

export interface EraseResult {
  items: SketchItem[];
  /** False when nothing was touched; `items` is then the input array itself. */
  changed: boolean;
}

/**
 * Cuts every stroke the eraser path passes over: samples within `radius` of the path are
 * removed and the stroke splits around the gap. Fills are not touched here (see
 * `eraseFillsAlongPath`). Untouched items keep their identity.
 */
export function eraseStrokesAlongPath(
  items: readonly SketchItem[],
  path: readonly number[],
  radius: number,
): EraseResult {
  if (path.length < 2) return { items: items as SketchItem[], changed: false };
  const reach = pathBounds(path, radius);
  const step = Math.max(0.5, Math.min(2, radius / 3));
  const out: SketchItem[] = [];
  let changed = false;
  for (const item of items) {
    if (item.kind !== 'stroke' || !rectsOverlap(sketchItemBounds(item), reach)) {
      out.push(item);
      continue;
    }
    // The centerline is what is cut, so a wide stroke gets a little extra reach: the eraser should
    // clear the part of the body it visibly overlaps, not leave a sliver at the stroke's edge.
    const cutRadius = radius + item.size * 0.25;
    const cutSquared = cutRadius * cutRadius;
    const split = splitStroke(
      item,
      (x, y) => distanceToPolylineSquared(x, y, path) <= cutSquared,
      step,
    );
    if (!split) {
      out.push(item);
      continue;
    }
    changed = true;
    out.push(...split.outside);
  }
  return { items: changed ? out : (items as SketchItem[]), changed };
}

// ---------------------------------------------------------------- hit test

function strokeHit(stroke: SketchStroke, x: number, y: number, tolerance: number): boolean {
  const reach = stroke.size / 2 + tolerance;
  const bounds = sketchItemBounds(stroke);
  if (
    x < bounds.x - tolerance ||
    x > bounds.x + bounds.width + tolerance ||
    y < bounds.y - tolerance ||
    y > bounds.y + bounds.height + tolerance
  ) {
    return false;
  }
  const points = stroke.points;
  if (points.length <= 2) {
    return (x - points[0]) * (x - points[0]) + (y - points[1]) * (y - points[1]) <= reach * reach;
  }
  const reachSquared = reach * reach;
  for (let index = 2; index + 1 < points.length; index += 2) {
    if (
      distanceToSegmentSquared(
        x,
        y,
        points[index - 2],
        points[index - 1],
        points[index],
        points[index + 1],
      ) <= reachSquared
    ) {
      return true;
    }
  }
  return false;
}

/** Index of the topmost item under the point, or -1. Strokes hit by width, fills by area. */
export function hitTestSketchItems(
  items: readonly SketchItem[],
  x: number,
  y: number,
  tolerance: number,
): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (
      item.kind === 'stroke' ? strokeHit(item, x, y, tolerance) : pointInFlatRings(x, y, item.rings)
    ) {
      return index;
    }
  }
  return -1;
}

// ---------------------------------------------------------------- lasso

export type LassoMode = 'whole' | 'cut';

export interface LassoResult {
  /** The layer's items after the selection (a cut replaces a stroke by its pieces, in place). */
  items: SketchItem[];
  /** Members of `items` the lasso picked; compare by reference. */
  selected: SketchItem[];
}

function fractionInside(points: readonly number[], polygon: readonly number[]): number {
  const sampled = densifyFlatPoints(points, 4);
  const count = sampled.length / 2;
  if (count === 0) return 0;
  let inside = 0;
  for (let index = 0; index < count; index += 1) {
    if (pointInFlatRing(sampled[index * 2], sampled[index * 2 + 1], polygon)) inside += 1;
  }
  return inside / count;
}

/**
 * Picks the items a lasso (a flat closed polygon) encloses. `whole` takes every item that is
 * at least half inside, intact; `cut` slices strokes along the lasso border and picks the inner
 * pieces. Fills are always taken whole (their majority vertex rule), never cut.
 */
export function selectItemsByLasso(
  items: readonly SketchItem[],
  polygon: readonly number[],
  mode: LassoMode,
): LassoResult {
  if (polygon.length < 6) return { items: items as SketchItem[], selected: [] };
  const area = pathBounds(polygon, 0);
  const out: SketchItem[] = [];
  const selected: SketchItem[] = [];
  for (const item of items) {
    if (!rectsOverlap(sketchItemBounds(item), area)) {
      out.push(item);
      continue;
    }
    if (item.kind === 'fill') {
      const vertices = item.rings.flat();
      if (fractionInside(vertices, polygon) >= 0.5) {
        out.push(item);
        selected.push(item);
      } else {
        out.push(item);
      }
      continue;
    }
    if (mode === 'whole') {
      out.push(item);
      if (fractionInside(item.points, polygon) >= 0.5) selected.push(item);
      continue;
    }
    const split = splitStroke(item, (x, y) => pointInFlatRing(x, y, polygon), 1.5);
    if (!split) {
      out.push(item);
      continue;
    }
    // Pieces keep their original order along the stroke only approximately; for a cut the
    // z-position is what matters, and all pieces share the original's slot.
    out.push(...split.outside, ...split.inside);
    selected.push(...split.inside);
  }
  return { items: out, selected };
}

// ---------------------------------------------------------------- transforms

export function multiplyMatrix(outer: SketchMatrix, inner: SketchMatrix): SketchMatrix {
  return {
    a: outer.a * inner.a + outer.c * inner.b,
    b: outer.b * inner.a + outer.d * inner.b,
    c: outer.a * inner.c + outer.c * inner.d,
    d: outer.b * inner.c + outer.d * inner.d,
    e: outer.a * inner.e + outer.c * inner.f + outer.e,
    f: outer.b * inner.e + outer.d * inner.f + outer.f,
  };
}

export function translateMatrix(dx: number, dy: number): SketchMatrix {
  return { a: 1, b: 0, c: 0, d: 1, e: dx, f: dy };
}

export function scaleAboutMatrix(sx: number, sy: number, cx: number, cy: number): SketchMatrix {
  return { a: sx, b: 0, c: 0, d: sy, e: cx - sx * cx, f: cy - sy * cy };
}

export function rotateAboutMatrix(angle: number, cx: number, cy: number): SketchMatrix {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    a: cos,
    b: sin,
    c: -sin,
    d: cos,
    e: cx - cos * cx + sin * cy,
    f: cy - sin * cx - cos * cy,
  };
}

export function isIdentityMatrix(matrix: SketchMatrix): boolean {
  return (
    matrix.a === 1 &&
    matrix.b === 0 &&
    matrix.c === 0 &&
    matrix.d === 1 &&
    matrix.e === 0 &&
    matrix.f === 0
  );
}

function transformFlat(points: readonly number[], matrix: SketchMatrix): number[] {
  const out = new Array<number>(points.length);
  for (let index = 0; index + 1 < points.length; index += 2) {
    const x = points[index];
    const y = points[index + 1];
    out[index] = matrix.a * x + matrix.c * y + matrix.e;
    out[index + 1] = matrix.b * x + matrix.d * y + matrix.f;
  }
  return out;
}

const MIN_STROKE_SIZE = 0.25;
const MAX_STROKE_SIZE = 600;

export function transformSketchItem(item: SketchItem, matrix: SketchMatrix): SketchItem {
  if (item.kind === 'stroke') {
    const scale = Math.sqrt(Math.abs(matrix.a * matrix.d - matrix.b * matrix.c));
    return {
      ...item,
      size: Math.min(MAX_STROKE_SIZE, Math.max(MIN_STROKE_SIZE, item.size * scale)),
      points: transformFlat(item.points, matrix),
    };
  }
  return { ...item, rings: item.rings.map((ring) => transformFlat(ring, matrix)) };
}

/**
 * Applies the matrix to the picked items, in place in the list (z-order intact). Returns the new
 * list and the new selection (the transformed copies), so a drag can keep adjusting it.
 */
export function transformSelectedItems(
  items: readonly SketchItem[],
  selected: ReadonlySet<SketchItem>,
  matrix: SketchMatrix,
): LassoResult {
  const nextSelected: SketchItem[] = [];
  const out = items.map((item) => {
    if (!selected.has(item)) return item;
    const moved = transformSketchItem(item, matrix);
    nextSelected.push(moved);
    return moved;
  });
  return { items: out, selected: nextSelected };
}

// ---------------------------------------------------------------- compaction

const COMPACT_EPSILON = 0.25;

/**
 * What the save persists: empty or degenerate items dropped, strokes re-simplified. The editor
 * keeps its full items (undo stays exact); only the stored copy is compacted. Idempotent.
 */
export function compactSketchItems(items: readonly SketchItem[]): SketchItem[] {
  const out: SketchItem[] = [];
  for (const item of items) {
    if (item.kind === 'stroke') {
      const deduped = dedupePoints(item.points);
      if (deduped.length < 2) continue;
      const points = deduped.length > 2 ? simplifyFlatPoints(deduped, COMPACT_EPSILON) : deduped;
      out.push(points === item.points ? item : { ...item, points });
    } else {
      const rings = item.rings.map((ring) => dedupePoints(ring)).filter((ring) => ring.length >= 6);
      if (rings.length === 0) continue;
      out.push({ ...item, rings } satisfies SketchFill);
    }
  }
  return out;
}
