import type { BoardContentType, BoardNodeType } from '@keres/shared';

export const BOARD_NODE_WIDTH = 148;
export const BOARD_NODE_HEIGHT = 86;
export const BOARD_CANVAS_PADDING = 240;
export const BOARD_CANVAS_MIN = 720;

export function boardCanvasSize(
  nodes: BoardNodeType[],
  minWidth = BOARD_CANVAS_MIN,
  minHeight = BOARD_CANVAS_MIN,
): { width: number; height: number } {
  if (nodes.length === 0) {
    return { width: minWidth, height: minHeight };
  }
  let maxX = 0;
  let maxY = 0;
  for (const node of nodes) {
    maxX = Math.max(maxX, node.x + BOARD_NODE_WIDTH);
    maxY = Math.max(maxY, node.y + BOARD_NODE_HEIGHT);
  }
  return {
    width: Math.max(minWidth, maxX + BOARD_CANVAS_PADDING),
    height: Math.max(minHeight, maxY + BOARD_CANVAS_PADDING),
  };
}

/**
 * Bounds of the board plus the offset that puts every node inside the drawing.
 *
 * Nodes are free to be dragged anywhere, including outside the area the screen renders, and the
 * export must never cut one: this shifts every node so the top-left corner of the bounding box
 * lands on `BOARD_CANVAS_PADDING`, and sizes the canvas to the box plus that padding on all sides.
 * The screen keeps drawing at raw coordinates (`boardCanvasSize`, overflow visible); only the
 * exported file is normalised, so the saved content is never rewritten.
 */
export function normalizeBoardCanvas(
  nodes: BoardNodeType[],
  minWidth = BOARD_CANVAS_MIN,
  minHeight = BOARD_CANVAS_MIN,
): { offsetX: number; offsetY: number; width: number; height: number } {
  if (nodes.length === 0) {
    return { offsetX: 0, offsetY: 0, width: minWidth, height: minHeight };
  }
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const node of nodes) {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + BOARD_NODE_WIDTH);
    maxY = Math.max(maxY, node.y + BOARD_NODE_HEIGHT);
  }
  return {
    offsetX: BOARD_CANVAS_PADDING - minX,
    offsetY: BOARD_CANVAS_PADDING - minY,
    width: Math.max(minWidth, maxX - minX + BOARD_CANVAS_PADDING * 2),
    height: Math.max(minHeight, maxY - minY + BOARD_CANVAS_PADDING * 2),
  };
}

export function nextStaggeredPosition(
  content: BoardContentType,
  origin: { x: number; y: number },
): { x: number; y: number } {
  const index = content.nodes.length;
  return { x: origin.x + (index % 4) * 24, y: origin.y + (index % 4) * 24 };
}
