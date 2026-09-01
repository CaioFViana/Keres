import type { LocationMapContentType } from '../schemas/LocationMapSchemas';
export const LOCATION_MAP_CANVAS_PADDING = 240,
  LOCATION_MAP_CANVAS_MIN = 720,
  LOCATION_MAP_IMAGE_DEFAULT_WIDTH = 320,
  LOCATION_MAP_IMAGE_DEFAULT_HEIGHT = 240,
  LOCATION_MAP_IMAGE_MIN = 80,
  LOCATION_MAP_IMAGE_MAX = 4000,
  LOCATION_MAP_IMAGE_STEP = 1.1,
  LOCATION_MAP_NODE_SIZE = 44;
export function locationMapCanvasBounds(
  content: LocationMapContentType,
  minWidth = LOCATION_MAP_CANVAS_MIN,
  minHeight = LOCATION_MAP_CANVAS_MIN,
) {
  if (!content.images.length && !content.nodes.length && !(content.markers?.length ?? 0))
    return { width: minWidth, height: minHeight, originX: 0, originY: 0 };
  let minX = Infinity,
    minY = Infinity,
    maxX = 0,
    maxY = 0;
  for (const image of content.images) {
    minX = Math.min(minX, image.x);
    minY = Math.min(minY, image.y);
    maxX = Math.max(maxX, image.x + image.width);
    maxY = Math.max(maxY, image.y + image.height);
  }
  for (const point of [...content.nodes, ...(content.markers ?? [])]) {
    minX = Math.min(minX, point.x - LOCATION_MAP_NODE_SIZE / 2);
    minY = Math.min(minY, point.y - LOCATION_MAP_NODE_SIZE / 2);
    maxX = Math.max(maxX, point.x + LOCATION_MAP_NODE_SIZE);
    maxY = Math.max(maxY, point.y + LOCATION_MAP_NODE_SIZE);
  }
  const originX = minX < 0 ? minX - LOCATION_MAP_CANVAS_PADDING : 0,
    originY = minY < 0 ? minY - LOCATION_MAP_CANVAS_PADDING : 0;
  return {
    width: Math.max(minWidth, maxX - originX + LOCATION_MAP_CANVAS_PADDING),
    height: Math.max(minHeight, maxY - originY + LOCATION_MAP_CANVAS_PADDING),
    originX,
    originY,
  };
}
export function locationMapCanvasSize(
  content: LocationMapContentType,
  minWidth = LOCATION_MAP_CANVAS_MIN,
  minHeight = LOCATION_MAP_CANVAS_MIN,
) {
  const { width, height } = locationMapCanvasBounds(content, minWidth, minHeight);
  return { width, height };
}
