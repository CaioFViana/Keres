import type { GraphLayoutDirection } from './graphLayoutDirection';
import type {
  Cubic,
  GraphEdge,
  GraphEdgeKind,
  GraphNode,
  GraphPoint,
  PlacedEdge,
  WorkEdge,
} from './storyGraphLayout';
const GRAPH_PADDING = 28;
const LAYER_GAP = 92;

const ARROW_LENGTH = 11;
const ARROW_HALF_WIDTH = 5.5;
const SELF_LOOP_BULGE = 46;
/** Curvas de cada aresta, ainda em coordenadas locais. */
export function placeEdges(
  edges: WorkEdge[],
  nodesById: Map<string, GraphNode>,
  direction: GraphLayoutDirection,
): PlacedEdge[] {
  // Parallel edges (two different choices between the same scenes) would get the same curve and become
  // indistinguishable; the position within the group offsets each one sideways.
  const groups = new Map<string, WorkEdge[]>();
  for (const edge of edges) {
    const key = `${edge.source.scene.id}->${edge.target.scene.id}`;
    const group = groups.get(key);
    if (group) group.push(edge);
    else groups.set(key, [edge]);
  }

  const placed: PlacedEdge[] = [];
  for (const group of groups.values()) {
    group.forEach((edge, indexInGroup) => {
      const source = nodesById.get(edge.source.scene.id);
      const target = nodesById.get(edge.target.scene.id);
      if (!source || !target) return;

      const spread = (indexInGroup - (group.length - 1) / 2) * 26;
      const kind = classifyEdge(source, target);
      const loopSide = kind === 'self' ? pickLoopSide(source, [...nodesById.values()]) : 1;
      placed.push({
        work: edge,
        source,
        target,
        kind,
        curve: buildCurve(source, target, kind, spread, loopSide, direction),
      });
    });
  }

  return placed;
}

/**
 * The side on which a scene's loop fits: right (1) or left (-1).
 *
 * Without this check the loop is always drawn on the right and passes through the neighbouring scene,
 * since the gap between columns is smaller than the curve's belly.
 */
function pickLoopSide(node: GraphNode, allNodes: GraphNode[]): 1 | -1 {
  const needed = SELF_LOOP_BULGE + 10;
  const sameLayer = allNodes.filter((other) => other.id !== node.id && other.layer === node.layer);

  const blockedOnRight = sameLayer.some(
    (other) => other.x > node.x && other.x - (node.x + node.width) < needed,
  );
  if (!blockedOnRight) return 1;

  const blockedOnLeft = sameLayer.some(
    (other) => other.x < node.x && node.x - (other.x + other.width) < needed,
  );
  return blockedOnLeft ? 1 : -1;
}

/**
 * Spreads the labels along the curves that arrive at the same scene.
 *
 * Several choices converging on one scene have curves that nearly touch in the middle, and the texts
 * would be stacked. Varying the anchor point separates them vertically without changing the drawing.
 */
export function spreadLabelAnchors(placed: PlacedEdge[]): Map<PlacedEdge, number> {
  const byTarget = new Map<string, PlacedEdge[]>();
  for (const edge of placed) {
    const group = byTarget.get(edge.target.id);
    if (group) group.push(edge);
    else byTarget.set(edge.target.id, [edge]);
  }

  const anchors = new Map<PlacedEdge, number>();
  for (const group of byTarget.values()) {
    group.forEach((edge, index) => {
      const offset = group.length > 1 ? (index / (group.length - 1) - 0.5) * 0.2 : 0;
      anchors.set(edge, 0.5 + offset);
    });
  }
  return anchors;
}

function classifyEdge(source: GraphNode, target: GraphNode): GraphEdgeKind {
  if (source.id === target.id) return 'self';
  if (target.layer > source.layer) return 'forward';
  if (target.layer === source.layer) return 'lateral';
  return 'backward';
}

function buildCurve(
  source: GraphNode,
  target: GraphNode,
  kind: GraphEdgeKind,
  spread: number,
  loopSide: 1 | -1,
  direction: GraphLayoutDirection,
): Cubic {
  if (direction === 'left-to-right') {
    return buildLeftToRightCurve(source, target, kind, spread, loopSide);
  }
  const sourceBottom = { x: source.x + source.width / 2, y: source.y + source.height };
  const targetTop = { x: target.x + target.width / 2, y: target.y };

  if (kind === 'forward') {
    const drop = Math.max(targetTop.y - sourceBottom.y, LAYER_GAP);
    return {
      start: { x: sourceBottom.x + spread, y: sourceBottom.y },
      control1: { x: sourceBottom.x + spread, y: sourceBottom.y + drop * 0.45 },
      control2: { x: targetTop.x + spread, y: targetTop.y - drop * 0.45 },
      end: { x: targetTop.x + spread, y: targetTop.y },
    };
  }

  if (kind === 'self') {
    // A loop on the free flank: the scene points at itself ("try again").
    const flank = loopSide === 1 ? source.x + source.width : source.x;
    const bulge = (SELF_LOOP_BULGE + Math.abs(spread)) * loopSide;
    return {
      start: { x: flank, y: source.y + source.height * 0.32 },
      control1: { x: flank + bulge, y: source.y - 18 },
      control2: { x: flank + bulge, y: source.y + source.height + 18 },
      end: { x: flank, y: source.y + source.height * 0.68 },
    };
  }

  if (kind === 'lateral') {
    // Same layer: it leaves through one flank and enters through the other, curving under both nodes.
    const goingRight = target.x >= source.x;
    const start = {
      x: goingRight ? source.x + source.width : source.x,
      y: source.y + source.height * 0.7,
    };
    const end = {
      x: goingRight ? target.x : target.x + target.width,
      y: target.y + target.height * 0.7,
    };
    const dip = source.height * 0.7 + 26 + Math.abs(spread);
    return {
      start,
      control1: { x: start.x + (goingRight ? 40 : -40), y: start.y + dip },
      control2: { x: end.x + (goingRight ? -40 : 40), y: end.y + dip },
      end,
    };
  }

  // Going back: it goes around the outside, from the source's top to the target's bottom. The side
  // comes from the relative position so the curve does not cross the scenes in between.
  const side = source.x >= target.x ? 1 : -1;
  const detour = source.width * 0.8 + Math.abs(spread);
  const sourceTop = { x: source.x + source.width / 2, y: source.y };
  const targetBottom = { x: target.x + target.width / 2, y: target.y + target.height };
  return {
    start: sourceTop,
    control1: { x: sourceTop.x + side * detour, y: sourceTop.y - LAYER_GAP * 0.55 },
    control2: { x: targetBottom.x + side * detour, y: targetBottom.y + LAYER_GAP * 0.55 },
    end: targetBottom,
  };
}

function buildLeftToRightCurve(
  source: GraphNode,
  target: GraphNode,
  kind: GraphEdgeKind,
  spread: number,
  loopSide: 1 | -1,
): Cubic {
  const sourceRight = { x: source.x + source.width, y: source.y + source.height / 2 };
  const targetLeft = { x: target.x, y: target.y + target.height / 2 };

  if (kind === 'forward') {
    const run = Math.max(targetLeft.x - sourceRight.x, LAYER_GAP);
    return {
      start: { x: sourceRight.x, y: sourceRight.y + spread },
      control1: { x: sourceRight.x + run * 0.45, y: sourceRight.y + spread },
      control2: { x: targetLeft.x - run * 0.45, y: targetLeft.y + spread },
      end: { x: targetLeft.x, y: targetLeft.y + spread },
    };
  }

  if (kind === 'self') {
    const flank = loopSide === 1 ? source.y + source.height : source.y;
    const bulge = (SELF_LOOP_BULGE + Math.abs(spread)) * loopSide;
    return {
      start: { x: source.x + source.width * 0.32, y: flank },
      control1: { x: source.x - 18, y: flank + bulge },
      control2: { x: source.x + source.width + 18, y: flank + bulge },
      end: { x: source.x + source.width * 0.68, y: flank },
    };
  }

  if (kind === 'lateral') {
    const goingDown = target.y >= source.y;
    const start = {
      x: source.x + source.width * 0.7,
      y: goingDown ? source.y + source.height : source.y,
    };
    const end = {
      x: target.x + target.width * 0.7,
      y: goingDown ? target.y : target.y + target.height,
    };
    const detour = source.width * 0.7 + 26 + Math.abs(spread);
    return {
      start,
      control1: { x: start.x + detour, y: start.y + (goingDown ? 40 : -40) },
      control2: { x: end.x + detour, y: end.y + (goingDown ? -40 : 40) },
      end,
    };
  }

  const side = source.y >= target.y ? 1 : -1;
  const detour = source.height * 1.2 + Math.abs(spread);
  const sourceLeft = { x: source.x, y: source.y + source.height / 2 };
  const targetRight = { x: target.x + target.width, y: target.y + target.height / 2 };
  return {
    start: sourceLeft,
    control1: { x: sourceLeft.x - LAYER_GAP * 0.55, y: sourceLeft.y + side * detour },
    control2: { x: targetRight.x + LAYER_GAP * 0.55, y: targetRight.y + side * detour },
    end: targetRight,
  };
}

/**
 * Shifts everything so nothing falls outside the margin, and returns the drawing's final size.
 *
 * The curves' control points are part of the arithmetic: a Bézier curve never leaves the hull of its
 * control points, so including them is a safe and cheap slack - it guarantees a return drawn outside
 * the map is not cut off in the export.
 */
export function normalizeToPadding(
  nodes: GraphNode[],
  edges: PlacedEdge[],
): { width: number; height: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const consider = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };

  for (const node of nodes) {
    consider(node.x, node.y);
    consider(node.x + node.width, node.y + node.height);
  }
  for (const edge of edges) {
    for (const point of [
      edge.curve.start,
      edge.curve.control1,
      edge.curve.control2,
      edge.curve.end,
    ]) {
      consider(point.x, point.y);
    }
  }

  const shiftX = GRAPH_PADDING - minX;
  const shiftY = GRAPH_PADDING - minY;

  for (const node of nodes) {
    node.x += shiftX;
    node.y += shiftY;
  }
  for (const edge of edges) {
    for (const point of [
      edge.curve.start,
      edge.curve.control1,
      edge.curve.control2,
      edge.curve.end,
    ]) {
      point.x += shiftX;
      point.y += shiftY;
    }
  }

  return {
    width: round(maxX - minX + GRAPH_PADDING * 2),
    height: round(maxY - minY + GRAPH_PADDING * 2),
  };
}

export function serializeEdge(placed: PlacedEdge, labelAnchor: number): GraphEdge {
  const { curve } = placed;
  return {
    id: placed.work.choice.id,
    choice: placed.work.choice,
    sourceId: placed.source.id,
    targetId: placed.target.id,
    label: placed.work.choice.text ?? '',
    kind: placed.kind,
    path: `M ${round(curve.start.x)} ${round(curve.start.y)} C ${round(curve.control1.x)} ${round(curve.control1.y)}, ${round(curve.control2.x)} ${round(curve.control2.y)}, ${round(curve.end.x)} ${round(curve.end.y)}`,
    arrowPoints: buildArrowPoints(curve),
    labelPosition: cubicPointAt(curve, labelAnchor),
    color: placed.source.chapterColor,
  };
}

function cubicPointAt(curve: Cubic, t: number): GraphPoint {
  const inverse = 1 - t;
  const a = inverse * inverse * inverse;
  const b = 3 * inverse * inverse * t;
  const c = 3 * inverse * t * t;
  const d = t * t * t;
  return {
    x: round(a * curve.start.x + b * curve.control1.x + c * curve.control2.x + d * curve.end.x),
    y: round(a * curve.start.y + b * curve.control1.y + c * curve.control2.y + d * curve.end.y),
  };
}

/** The tip's triangle, aligned with the curve's tangent at the arrival point. */
function buildArrowPoints(curve: Cubic): string {
  let dx = curve.end.x - curve.control2.x;
  let dy = curve.end.y - curve.control2.y;
  if (Math.hypot(dx, dy) < 0.001) {
    dx = curve.end.x - curve.start.x;
    dy = curve.end.y - curve.start.y;
  }
  const length = Math.hypot(dx, dy) || 1;
  const unitX = dx / length;
  const unitY = dy / length;

  const baseX = curve.end.x - unitX * ARROW_LENGTH;
  const baseY = curve.end.y - unitY * ARROW_LENGTH;
  const left = { x: baseX - unitY * ARROW_HALF_WIDTH, y: baseY + unitX * ARROW_HALF_WIDTH };
  const right = { x: baseX + unitY * ARROW_HALF_WIDTH, y: baseY - unitX * ARROW_HALF_WIDTH };

  return `${round(curve.end.x)},${round(curve.end.y)} ${round(left.x)},${round(left.y)} ${round(right.x)},${round(right.y)}`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
