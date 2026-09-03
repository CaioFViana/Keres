/**
 * Pure geometry for a freeform, virtualized canvas. World values may be large, but values handed
 * to a native SVG/View are always rebased against a nearby local origin.
 */
export interface SpatialPoint {
  x: number;
  y: number;
}

export interface SpatialRect extends SpatialPoint {
  width: number;
  height: number;
}

/** Camera looks at a world point through a scale; it is not persisted with the document. */
export interface SpatialCamera extends SpatialPoint {
  scale: number;
}

/** A deliberately generous data domain; it is not a native surface size. */
export const MAX_SPATIAL_WORLD_COORDINATE = 100_000;
/** No one document may stretch farther than this in either axis. */
export const MAX_SPATIAL_DOCUMENT_SPAN = 200_000;
/**
 * GPU/layout safety for the interactive surface. One dimension at 8192 already matches common
 * texture limits and is enough to OOM a phone when allocated as an ARGB backing store.
 */
export const MAX_SPATIAL_NATIVE_SURFACE = 4096;
/** Prefetch at least one viewport of world in each direction before rebasing the local origin. */
export const SPATIAL_OVERSCAN_SCREENS = 1;

export function spatialRectIntersects(left: SpatialRect, right: SpatialRect): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

export function spatialBounds(rectangles: readonly SpatialRect[]): SpatialRect | null {
  if (rectangles.length === 0) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const rectangle of rectangles) {
    minX = Math.min(minX, rectangle.x);
    minY = Math.min(minY, rectangle.y);
    maxX = Math.max(maxX, rectangle.x + rectangle.width);
    maxY = Math.max(maxY, rectangle.y + rectangle.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** True when all geometry remains representable and the complete document remains practical. */
export function isSpatialEnvelopeSafe(rectangles: readonly SpatialRect[]): boolean {
  const bounds = spatialBounds(rectangles);
  if (!bounds) return true;
  return (
    Number.isFinite(bounds.x) &&
    Number.isFinite(bounds.y) &&
    Number.isFinite(bounds.width) &&
    Number.isFinite(bounds.height) &&
    bounds.x >= -MAX_SPATIAL_WORLD_COORDINATE &&
    bounds.y >= -MAX_SPATIAL_WORLD_COORDINATE &&
    bounds.x + bounds.width <= MAX_SPATIAL_WORLD_COORDINATE &&
    bounds.y + bounds.height <= MAX_SPATIAL_WORLD_COORDINATE &&
    bounds.width <= MAX_SPATIAL_DOCUMENT_SPAN &&
    bounds.height <= MAX_SPATIAL_DOCUMENT_SPAN
  );
}

/**
 * Clips a segment to a rectangle. `null` means it cannot contribute any visible pixels. This is
 * used for connections whose endpoints are virtualized out of the current render window.
 */
export function clipSpatialSegment(
  from: SpatialPoint,
  to: SpatialPoint,
  rect: SpatialRect,
): { from: SpatialPoint; to: SpatialPoint } | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  let start = 0;
  let end = 1;
  const tests: readonly [number, number][] = [
    [-dx, from.x - rect.x],
    [dx, rect.x + rect.width - from.x],
    [-dy, from.y - rect.y],
    [dy, rect.y + rect.height - from.y],
  ];
  for (const [p, q] of tests) {
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }
    const ratio = q / p;
    if (p < 0) {
      if (ratio > end) return null;
      start = Math.max(start, ratio);
    } else {
      if (ratio < start) return null;
      end = Math.min(end, ratio);
    }
  }
  if (start > end) return null;
  return {
    from: { x: from.x + dx * start, y: from.y + dy * start },
    to: { x: from.x + dx * end, y: from.y + dy * end },
  };
}

export function spatialWorldToScreen(
  point: SpatialPoint,
  origin: SpatialPoint,
  scale: number,
  pan: SpatialPoint = { x: 0, y: 0 },
): SpatialPoint {
  return {
    x: (point.x - origin.x) * scale + pan.x,
    y: (point.y - origin.y) * scale + pan.y,
  };
}

export function spatialScreenToWorld(
  point: SpatialPoint,
  origin: SpatialPoint,
  scale: number,
  pan: SpatialPoint = { x: 0, y: 0 },
): SpatialPoint {
  const safe = scale === 0 ? 1 : scale;
  return {
    x: (point.x - pan.x) / safe + origin.x,
    y: (point.y - pan.y) / safe + origin.y,
  };
}

export function spatialRenderWindow(
  origin: SpatialPoint,
  surfaceWidth: number,
  surfaceHeight: number,
  scale: number,
): SpatialRect {
  const safe = scale === 0 ? 1 : scale;
  return {
    x: origin.x,
    y: origin.y,
    width: surfaceWidth / safe,
    height: surfaceHeight / safe,
  };
}

/**
 * Pixel size of the local plane: the device viewport plus overscan, never the document bounds
 * and never a GPU-sized square.
 */
export function spatialNativeSurface(
  viewportWidth: number,
  viewportHeight: number,
  overscanScreens = SPATIAL_OVERSCAN_SCREENS,
): { width: number; height: number; overscanX: number; overscanY: number } {
  if (viewportWidth <= 0 || viewportHeight <= 0) {
    return { width: 0, height: 0, overscanX: 0, overscanY: 0 };
  }
  const width = Math.min(MAX_SPATIAL_NATIVE_SURFACE, viewportWidth * (1 + 2 * overscanScreens));
  const height = Math.min(MAX_SPATIAL_NATIVE_SURFACE, viewportHeight * (1 + 2 * overscanScreens));
  return {
    width,
    height,
    overscanX: Math.max(0, (width - viewportWidth) / 2),
    overscanY: Math.max(0, (height - viewportHeight) / 2),
  };
}
