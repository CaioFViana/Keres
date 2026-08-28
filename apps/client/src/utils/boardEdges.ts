import type { BoardEdgeType, BoardNodeType } from '@keres/shared';
import { BOARD_NODE_HEIGHT, BOARD_NODE_WIDTH } from './boardLayout';

const ARROW_SIZE = 12;

/** Where the line meets the node's rectangle, so the arrow is not buried under the card. */
export function nodeBorderPoint(
  node: BoardNodeType,
  towardX: number,
  towardY: number,
): { x: number; y: number } {
  const cx = node.x + BOARD_NODE_WIDTH / 2;
  const cy = node.y + BOARD_NODE_HEIGHT / 2;
  const vx = towardX - cx;
  const vy = towardY - cy;
  if (vx === 0 && vy === 0) return { x: cx, y: cy };
  const scale = Math.min(
    vx === 0 ? Number.POSITIVE_INFINITY : BOARD_NODE_WIDTH / 2 / Math.abs(vx),
    vy === 0 ? Number.POSITIVE_INFINITY : BOARD_NODE_HEIGHT / 2 / Math.abs(vy),
  );
  return { x: cx + vx * scale, y: cy + vy * scale };
}

export function boardEdgeGeometry(from: BoardNodeType, to: BoardNodeType, edge: BoardEdgeType) {
  const fromCenter = { x: from.x + BOARD_NODE_WIDTH / 2, y: from.y + BOARD_NODE_HEIGHT / 2 };
  const toCenter = { x: to.x + BOARD_NODE_WIDTH / 2, y: to.y + BOARD_NODE_HEIGHT / 2 };
  const start = nodeBorderPoint(from, toCenter.x, toCenter.y);
  const end = nodeBorderPoint(to, fromCenter.x, fromCenter.y);
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const tip = edge.directed
    ? {
        x: end.x - Math.cos(angle) * 2,
        y: end.y - Math.sin(angle) * 2,
      }
    : end;
  const path = `M ${start.x} ${start.y} L ${tip.x} ${tip.y}`;
  const arrow = {
    x: tip.x,
    y: tip.y,
    points: [
      [tip.x, tip.y],
      [tip.x - ARROW_SIZE * Math.cos(angle - 0.4), tip.y - ARROW_SIZE * Math.sin(angle - 0.4)],
      [tip.x - ARROW_SIZE * Math.cos(angle + 0.4), tip.y - ARROW_SIZE * Math.sin(angle + 0.4)],
    ]
      .map((pair) => pair.join(','))
      .join(' '),
  };
  const labelX = (start.x + end.x) / 2;
  const labelY = (start.y + end.y) / 2;
  return { id: edge.id, path, directed: edge.directed, label: edge.label, arrow, labelX, labelY };
}
