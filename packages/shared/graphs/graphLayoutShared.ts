import type { GraphPoint } from './storyGraphLayout';

/**
 * Geometry shared by the graph layouts that draw straight edges between node boxes (the character
 * relation map and the location map). Pure, like the layouts that use it.
 */

/** How far the edge's tip stays from the node's border - the line must not touch the text. */
const EDGE_NODE_GAP = 4;

export interface PaddedBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** `Math.max(...values)`/`Math.min(...values)` blow the argument stack on very large arrays. */
export function minOf(values: number[]): number {
  return values.reduce((min, value) => (value < min ? value : min), values[0] ?? 0);
}

export function maxOf(values: number[]): number {
  return values.reduce((max, value) => (value > max ? value : max), values[0] ?? 0);
}

/** Shifts everything inside the margin and returns the final drawing size. */
export function normalizeToPadding(
  nodes: PaddedBox[],
  padding: number,
): { width: number; height: number } {
  if (nodes.length === 0) {
    return { width: padding * 2, height: padding * 2 };
  }

  const shiftX = padding - minOf(nodes.map((node) => node.x));
  const shiftY = padding - minOf(nodes.map((node) => node.y));
  for (const node of nodes) {
    node.x += shiftX;
    node.y += shiftY;
  }

  return {
    width: round(maxOf(nodes.map((node) => node.x + node.width)) + padding),
    height: round(maxOf(nodes.map((node) => node.y + node.height)) + padding),
  };
}

/**
 * A point on the node's border, in the direction of `towards` - where the edge should
 * start/finish so it does not cross over the node's text. The node is treated as an ellipse
 * for this calculation: a cheap visual approximation, enough for a straight line to touch the
 * rounded border instead of stopping in the middle of the name.
 */
export function pointOnNodeBoundary(node: PaddedBox, towards: GraphPoint): GraphPoint {
  const centerX = node.x + node.width / 2;
  const centerY = node.y + node.height / 2;
  const dx = towards.x - centerX;
  const dy = towards.y - centerY;
  if (dx === 0 && dy === 0) return { x: centerX, y: centerY };

  const rx = node.width / 2 + EDGE_NODE_GAP;
  const ry = node.height / 2 + EDGE_NODE_GAP;
  const scale = 1 / Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry));
  return { x: centerX + dx * scale, y: centerY + dy * scale };
}

/** A straight segment between two node boxes, cut where it leaves each border. */
export function straightEdgeBetween(
  source: PaddedBox,
  target: PaddedBox,
): { start: GraphPoint; end: GraphPoint; path: string } {
  const sourceCenter = { x: source.x + source.width / 2, y: source.y + source.height / 2 };
  const targetCenter = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
  const start = pointOnNodeBoundary(source, targetCenter);
  const end = pointOnNodeBoundary(target, sourceCenter);

  return {
    start,
    end,
    path: `M ${round(start.x)} ${round(start.y)} L ${round(end.x)} ${round(end.y)}`,
  };
}

/**
 * Connected components, given how to reach each node's neighbours. Members come back in the order
 * they were visited; a caller that needs another order sorts them itself.
 */
export function findConnectedComponents<T extends { component: number }>(
  nodes: T[],
  neighboursOf: (node: T) => T[],
): T[][] {
  const components: T[][] = [];

  for (const start of nodes) {
    if (start.component !== -1) continue;
    const componentIndex = components.length;
    const members: T[] = [];
    const queue = [start];
    start.component = componentIndex;

    while (queue.length > 0) {
      const node = queue.pop()!;
      members.push(node);
      for (const neighbour of neighboursOf(node)) {
        if (neighbour.component === -1) {
          neighbour.component = componentIndex;
          queue.push(neighbour);
        }
      }
    }

    components.push(members);
  }

  return components;
}
