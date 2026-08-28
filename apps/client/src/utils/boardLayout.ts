import type { BoardContentType, BoardNodeType } from '@keres/shared';

export const BOARD_NODE_WIDTH = 148;
export const BOARD_NODE_HEIGHT = 76;
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

export function nextStaggeredPosition(
  content: BoardContentType,
  origin: { x: number; y: number },
): { x: number; y: number } {
  const index = content.nodes.length;
  return { x: origin.x + (index % 4) * 24, y: origin.y + (index % 4) * 24 };
}
