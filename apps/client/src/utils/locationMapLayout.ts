import type { LocationMapContentType } from '@keres/shared';

export const LOCATION_MAP_CANVAS_PADDING = 240;
export const LOCATION_MAP_CANVAS_MIN = 720;
/** Default size of an image base when added to the map. */
export const LOCATION_MAP_IMAGE_DEFAULT_WIDTH = 320;
export const LOCATION_MAP_IMAGE_DEFAULT_HEIGHT = 240;
/** Minimum/maximum size of an image base, and the step of the +/− buttons. */
export const LOCATION_MAP_IMAGE_MIN = 80;
export const LOCATION_MAP_IMAGE_MAX = 4000;
export const LOCATION_MAP_IMAGE_STEP = 1.1;
/** Size of a location point (the tappable circle). */
export const LOCATION_MAP_NODE_SIZE = 44;

/**
 * Size of the map's drawing surface: the bounding box of every image base and location point,
 * plus padding on all sides. Images are free to be dragged anywhere, so the surface grows with
 * them the same way a board's does.
 */
export function locationMapCanvasSize(
  content: LocationMapContentType,
  minWidth = LOCATION_MAP_CANVAS_MIN,
  minHeight = LOCATION_MAP_CANVAS_MIN,
): { width: number; height: number } {
  const { width, height } = locationMapCanvasBounds(content, minWidth, minHeight);
  return { width, height };
}

/**
 * Drawable world bounds for the editor. The persisted map keeps raw coordinates, while the
 * origin translates any negative area onto the visible surface.
 */
export function locationMapCanvasBounds(
  content: LocationMapContentType,
  minWidth = LOCATION_MAP_CANVAS_MIN,
  minHeight = LOCATION_MAP_CANVAS_MIN,
): { width: number; height: number; originX: number; originY: number } {
  if (content.images.length === 0 && content.nodes.length === 0) {
    return { width: minWidth, height: minHeight, originX: 0, originY: 0 };
  }
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = 0;
  let maxY = 0;
  for (const image of content.images) {
    minX = Math.min(minX, image.x);
    minY = Math.min(minY, image.y);
    maxX = Math.max(maxX, image.x + image.width);
    maxY = Math.max(maxY, image.y + image.height);
  }
  for (const node of content.nodes) {
    minX = Math.min(minX, node.x - LOCATION_MAP_NODE_SIZE / 2);
    minY = Math.min(minY, node.y - LOCATION_MAP_NODE_SIZE / 2);
    maxX = Math.max(maxX, node.x + LOCATION_MAP_NODE_SIZE);
    maxY = Math.max(maxY, node.y + LOCATION_MAP_NODE_SIZE);
  }
  const originX = minX < 0 ? minX - LOCATION_MAP_CANVAS_PADDING : 0;
  const originY = minY < 0 ? minY - LOCATION_MAP_CANVAS_PADDING : 0;
  return {
    width: Math.max(minWidth, maxX - originX + LOCATION_MAP_CANVAS_PADDING),
    height: Math.max(minHeight, maxY - originY + LOCATION_MAP_CANVAS_PADDING),
    originX,
    originY,
  };
}
