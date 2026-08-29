/** A finite surface representing an extensible world-coordinate plane. */
export interface CanvasWorldBounds {
  width: number;
  height: number;
  originX: number;
  originY: number;
}

/**
 * New space is allocated in pages instead of individual pixels. This keeps a live drag from
 * changing the native layout and SVG viewport on every pointer event near an edge.
 */
export const CANVAS_BOUNDS_GROWTH_STEP = 256;

/**
 * Returns a surface that contains both bounds, only ever growing. The old surface stays stable
 * while an item is dragged back and forth near an edge; that stability is what makes an infinite
 * canvas feel anchored under the pointer.
 */
export function growCanvasBounds(
  current: CanvasWorldBounds,
  required: CanvasWorldBounds,
  step = CANVAS_BOUNDS_GROWTH_STEP,
): CanvasWorldBounds {
  const originX = growStart(current.originX, required.originX, step);
  const originY = growStart(current.originY, required.originY, step);
  const right = growEnd(
    current.originX + current.width,
    required.originX + required.width,
    step,
  );
  const bottom = growEnd(
    current.originY + current.height,
    required.originY + required.height,
    step,
  );
  if (
    originX === current.originX &&
    originY === current.originY &&
    right === current.originX + current.width &&
    bottom === current.originY + current.height
  ) {
    return current;
  }
  return { width: right - originX, height: bottom - originY, originX, originY };
}

function growStart(current: number, required: number, step: number): number {
  if (required >= current) return current;
  return current - Math.ceil((current - required) / step) * step;
}

function growEnd(current: number, required: number, step: number): number {
  if (required <= current) return current;
  return current + Math.ceil((required - current) / step) * step;
}
