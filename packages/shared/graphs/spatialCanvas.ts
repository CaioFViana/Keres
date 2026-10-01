/**
 * Pure geometry for a freeform, virtualized canvas. Children are world-addressed (their layout
 * position never changes under a gesture) while the camera lives only in the container transform;
 * the only viewport-sized surface is the edges overlay, which re-covers the camera with
 * hysteresis and never moves anything on screen when it does.
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
 * Bounds the overlay surface (viewport plus overscan) that the cull window is derived from.
 * Historically this also sized the edges `<Svg>`, which is why it reads like a bitmap budget:
 * Android's `SvgView` renders into an ARGB_8888 bitmap of the whole view, so one 4096-pixel
 * side alone is 67MB in a single allocation - enough to OOM a phone. The edges now draw in a
 * viewport-sized Skia overlay instead (see `SkiaEdgeCanvas`), but the cap stays: it keeps the
 * cull window - and any drawing still sized by it - near the viewport on every GPU.
 */
export const MAX_SPATIAL_NATIVE_SURFACE = 2048;
/** Prefetch at least one viewport of world in each direction around the visible rect. */
export const SPATIAL_OVERSCAN_SCREENS = 1;
/**
 * Fraction of the overlay that must remain between the visible rect and the overlay edge before
 * the overlay re-syncs. The re-sync itself moves nothing on screen (it only re-covers the same
 * camera with a viewport-sized surface), but hysteresis keeps it from firing on every gesture
 * event and re-rendering the edge layer mid-pan.
 */
export const SPATIAL_OVERLAY_SYNC_MARGIN = 0.25;
/**
 * How far the live camera scale may drift from the scale the overlay was synced at before the
 * overlay re-covers the camera. The edges SVG is sized in world units (the render window), so its
 * native bitmap grows with the live scale; without this bound a deep pinch-zoom would inflate the
 * bitmap past the GPU texture limit the 2048 cap exists to respect.
 */
export const SPATIAL_OVERLAY_SYNC_MAX_SCALE_DRIFT = 1.25;

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
 * True when the visible world rect has drifted too close to the edge of the viewport-sized
 * overlay window, so the overlay (edges surface, culling window) must re-cover the camera. The
 * overlay re-sync moves nothing on screen: nodes are world-addressed and the camera lives only in
 * the container transform, so this only decides how often the edge layer re-renders mid-gesture.
 */
export function spatialOverlayNeedsSync(
  visible: SpatialRect,
  overlay: SpatialRect,
  marginFraction = SPATIAL_OVERLAY_SYNC_MARGIN,
): boolean {
  if (overlay.width <= 0 || overlay.height <= 0) return true;
  const marginX = overlay.width * marginFraction;
  const marginY = overlay.height * marginFraction;
  return (
    visible.x < overlay.x + marginX ||
    visible.y < overlay.y + marginY ||
    visible.x + visible.width > overlay.x + overlay.width - marginX ||
    visible.y + visible.height > overlay.y + overlay.height - marginY
  );
}

/**
 * True when the live camera scale has drifted too far from the scale the overlay was synced at,
 * so the overlay must re-cover the camera to keep its native bitmap near the viewport-sized
 * surface. Panning alone never trips this: only zoom does.
 */
export function spatialOverlayScaleDrifted(
  liveScale: number,
  syncedScale: number,
  maxDrift = SPATIAL_OVERLAY_SYNC_MAX_SCALE_DRIFT,
): boolean {
  if (!(syncedScale > 0) || !(liveScale > 0)) return true;
  return liveScale > syncedScale * maxDrift || liveScale < syncedScale / maxDrift;
}

/**
 * Pixel size of the viewport-sized overlay plane: the device viewport plus overscan, never the
 * document bounds and never a GPU-sized square.
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
