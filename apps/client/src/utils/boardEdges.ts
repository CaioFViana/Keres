import type { BoardEdgeType, BoardNodeType } from '@keres/shared';
import { BOARD_NODE_HEIGHT, BOARD_NODE_WIDTH } from './boardLayout';

export function boardEdgeGeometry(from: BoardNodeType, to: BoardNodeType, edge: BoardEdgeType) {
  const x1 = from.x + BOARD_NODE_WIDTH / 2;
  const y1 = from.y + BOARD_NODE_HEIGHT / 2;
  const x2 = to.x + BOARD_NODE_WIDTH / 2;
  const y2 = to.y + BOARD_NODE_HEIGHT / 2;
  const path = `M ${x1} ${y1} L ${x2} ${y2}`;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const arrow = {
    x: x2,
    y: y2,
    points: [
      [x2, y2],
      [x2 - 10 * Math.cos(angle - 0.4), y2 - 10 * Math.sin(angle - 0.4)],
      [x2 - 10 * Math.cos(angle + 0.4), y2 - 10 * Math.sin(angle + 0.4)],
    ]
      .map((pair) => pair.join(','))
      .join(' '),
  };
  const labelX = (x1 + x2) / 2;
  const labelY = (y1 + y2) / 2;
  return { id: edge.id, path, directed: edge.directed, label: edge.label, arrow, labelX, labelY };
}
