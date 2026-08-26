import type { GraphPoint } from './storyGraphLayout';
import { wrapLabel } from './storyGraphLayout';
import type { GraphLayoutDirection } from './graphLayoutDirection';

/**
 * Positioning for the Location structure graph: each Location becomes a node, and the two
 * relations (`contains`/`connected_to`) become edges with different styles.
 *
 * Unlike the character relation graph (radial, no hierarchy), `contains` DOES have a natural
 * direction (parent -> child) and - by construction, see `LocationRelationSyncHandler` on the
 * server - always forms a forest (each Location has at most one live parent, no cycles). That
 * allows a simple tree layout (top-down, with no crossing minimisation) instead of the story map's
 * more complex layered layout (which has to handle arbitrary DAGs). `connected_to` has no
 * hierarchy - those edges are drawn on top, between wherever the nodes already landed via the
 * tree, without influencing the positioning.
 *
 * Pure on purpose (no React/database/platform), like the app's other two graph layouts.
 */

export interface GraphLocation {
  id: string;
  name: string;
}

export type LocationRelationKind = 'contains' | 'connected_to';

export interface GraphLocationRelation {
  id: string;
  locationAId: string;
  locationBId: string;
  relationType: LocationRelationKind;
}

export const NODE_WIDTH = 112;
export const NODE_HEIGHT = 44;
export const GRAPH_PADDING = 28;
const NODE_GAP = 18;
const LAYER_GAP = 46;
const CLUSTER_GAP = 60;
const EDGE_NODE_GAP = 4;
const LABEL_MAX_CHARS = 14;
const LABEL_MAX_LINES = 2;
/** A defence against corrupted data (a cycle that escaped validation) - it should never be reached on a valid tree. */
const MAX_TREE_DEPTH = 500;

export interface LocationGraphNode {
  id: string;
  location: GraphLocation;
  labelLines: string[];
  /** Layer in the 'contains' tree - 0 for roots. Always 0 for isolated nodes. */
  depth: number;
  /** No relation at all (neither contains nor connected_to). */
  isIsolated: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LocationGraphEdge {
  id: string;
  relation: GraphLocationRelation;
  relationType: LocationRelationKind;
  sourceId: string;
  targetId: string;
  /** An SVG path's `d` between the two nodes' borders. */
  path: string;
}

export interface LocationGraphLayout {
  nodes: LocationGraphNode[];
  edges: LocationGraphEdge[];
  width: number;
  height: number;
  /** 'contains' trees with more than one node or with at least one connection. */
  treeCount: number;
  /** Locations with no recorded relation. */
  isolatedCount: number;
}

interface PositionedNode {
  id: string;
  location: GraphLocation;
  depth: number;
  x: number;
  y: number;
}

interface TreeBox {
  nodes: LocationGraphNode[];
  width: number;
  height: number;
}

export function buildLocationGraphLayout(
  locations: GraphLocation[],
  relations: GraphLocationRelation[],
  direction: GraphLayoutDirection = 'top-to-bottom',
): LocationGraphLayout {
  if (locations.length === 0) {
    return {
      nodes: [],
      edges: [],
      width: GRAPH_PADDING * 2,
      height: GRAPH_PADDING * 2,
      treeCount: 0,
      isolatedCount: 0,
    };
  }

  const locationById = new Map(locations.map((location) => [location.id, location]));

  // Relations dangling from a Location that was deleted but not cleaned up yet - the same treatment
  // the rest of the app gives that kind of orphan row: ignored, it does not break the drawing.
  const containsEdges = relations.filter(
    (r) =>
      r.relationType === 'contains' &&
      locationById.has(r.locationAId) &&
      locationById.has(r.locationBId),
  );
  const connectedEdges = relations.filter(
    (r) =>
      r.relationType === 'connected_to' &&
      locationById.has(r.locationAId) &&
      locationById.has(r.locationBId),
  );

  const parentOf = new Map<string, string>();
  const childrenOf = new Map<string, string[]>();
  for (const edge of containsEdges) {
    parentOf.set(edge.locationBId, edge.locationAId);
    if (!childrenOf.has(edge.locationAId)) childrenOf.set(edge.locationAId, []);
    childrenOf.get(edge.locationAId)!.push(edge.locationBId);
  }

  const connectionDegree = new Map<string, number>();
  for (const edge of connectedEdges) {
    connectionDegree.set(edge.locationAId, (connectionDegree.get(edge.locationAId) ?? 0) + 1);
    connectionDegree.set(edge.locationBId, (connectionDegree.get(edge.locationBId) ?? 0) + 1);
  }

  const roots = collectRoots(locations, parentOf, childrenOf);

  const isolatedRoots: GraphLocation[] = [];
  const treeRoots: GraphLocation[] = [];
  for (const root of roots) {
    const hasChildren = (childrenOf.get(root.id)?.length ?? 0) > 0;
    const hasConnection = (connectionDegree.get(root.id) ?? 0) > 0;
    if (!hasChildren && !hasConnection) {
      isolatedRoots.push(root);
    } else {
      treeRoots.push(root);
    }
  }

  // Shared between the trees: a Location reachable by more than one path (two `contains` pointing at
  // it, or a cycle) is drawn once, not once per path.
  const placed = new Set<string>();
  const treeBoxes = treeRoots
    .map((root) => layoutTree(root, childrenOf, locationById, placed))
    // Maiores primeiro deixa o empacotamento em prateleiras mais compacto (first-fit decreasing).
    .sort((a, b) => b.width * b.height - a.width * a.height);

  const packed = packTrees(treeBoxes);
  const isolatedGraphNodes = layoutIsolatedGrid(
    isolatedRoots,
    packed.width,
    packed.nodes.length > 0 ? packed.height + CLUSTER_GAP : 0,
  );

  const nodes = [...packed.nodes, ...isolatedGraphNodes];
  if (direction === 'left-to-right') orientNodesLeftToRight(nodes);
  const { width, height } = normalizeToPadding(nodes);

  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const edges: LocationGraphEdge[] = [];
  for (const edge of containsEdges) {
    const source = nodesById.get(edge.locationAId);
    const target = nodesById.get(edge.locationBId);
    if (!source || !target) continue;
    edges.push(buildEdge(edge, 'contains', source, target));
  }
  for (const edge of connectedEdges) {
    const source = nodesById.get(edge.locationAId);
    const target = nodesById.get(edge.locationBId);
    if (!source || !target) continue;
    edges.push(buildEdge(edge, 'connected_to', source, target));
  }

  return {
    nodes,
    edges,
    width,
    height,
    treeCount: treeRoots.length,
    isolatedCount: isolatedRoots.length,
  };
}

/** Turns the vertical tree into a tree read from left to right. */
function orientNodesLeftToRight(nodes: LocationGraphNode[]): void {
  const horizontalLayerStep = NODE_WIDTH + LAYER_GAP;
  const verticalColumnStep = NODE_HEIGHT + NODE_GAP;
  const sourceLayerStep = NODE_HEIGHT + LAYER_GAP;
  const sourceColumnStep = NODE_WIDTH + NODE_GAP;
  for (const node of nodes) {
    const previousX = node.x;
    const previousY = node.y;
    node.x = (previousY / sourceLayerStep) * horizontalLayerStep;
    node.y = (previousX / sourceColumnStep) * verticalColumnStep;
  }
}

/**
 * Roots of the `contains` forest.
 *
 * Normally it is just "whoever has no parent". The extra case exists for corrupted data: in a
 * closed `contains` cycle (a contains b, b contains a) every Location has a parent, none would be
 * a root, and the whole map would come out empty - the worst possible result, because the user
 * would see neither the problem nor the rest of the story. The server
 * (`LocationRelationSyncHandler`) prevents that data; this is the safety net for when it arrives
 * that way anyway. It elects the lowest-id Location of each unreachable group as a root,
 * deterministically, so the group shows up on the map instead of vanishing from it.
 */
function collectRoots(
  locations: GraphLocation[],
  parentOf: Map<string, string>,
  childrenOf: Map<string, string[]>,
): GraphLocation[] {
  const roots = locations.filter((location) => !parentOf.has(location.id));
  const reachable = new Set<string>();

  // Iterative, not recursive: the depth here is that of the user's Location tree, and this module
  // exists precisely to withstand a large story without blowing the stack.
  const markReachable = (startId: string) => {
    const stack = [startId];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (reachable.has(id)) continue;
      reachable.add(id);
      for (const childId of childrenOf.get(id) ?? []) stack.push(childId);
    }
  };

  for (const root of roots) markReachable(root.id);

  const unreachable = [...locations]
    .filter((location) => !reachable.has(location.id))
    .sort((a, b) => a.id.localeCompare(b.id));
  for (const orphan of unreachable) {
    if (reachable.has(orphan.id)) continue;
    roots.push(orphan);
    markReachable(orphan.id);
  }

  return roots;
}

/**
 * Top-down tree layout for a single root: each subtree's width computed bottom-up (post-order),
 * the parent centred above its children. No crossing minimisation (unnecessary - it is a tree, not
 * a general DAG) and no iterative simulation.
 *
 * `placed` is shared between the trees of the same call and guarantees each Location is positioned
 * exactly once, even when more than one path leads to it.
 */
function layoutTree(
  root: GraphLocation,
  childrenOf: Map<string, string[]>,
  locationById: Map<string, GraphLocation>,
  placed: Set<string>,
): TreeBox {
  const positioned: PositionedNode[] = [];

  function measureAndPlace(nodeId: string, depth: number, xOffset: number): number {
    const location = locationById.get(nodeId);
    // Marked on entry, before descending: it covers both "already drawn via another path" and a
    // corrupted `contains` cycle, which here simply stops descending instead of recursing forever.
    // `MAX_TREE_DEPTH` remains the last line of defence.
    if (!location || placed.has(nodeId) || depth > MAX_TREE_DEPTH) {
      return NODE_WIDTH;
    }
    placed.add(nodeId);

    const childIds = [...(childrenOf.get(nodeId) ?? [])].sort((a, b) =>
      (locationById.get(a)?.name ?? '').localeCompare(locationById.get(b)?.name ?? ''),
    );

    if (childIds.length === 0) {
      positioned.push({
        id: nodeId,
        location,
        depth,
        x: xOffset,
        y: depth * (NODE_HEIGHT + LAYER_GAP),
      });
      return NODE_WIDTH;
    }

    let childX = xOffset;
    const childCenters: number[] = [];
    for (const childId of childIds) {
      const childWidth = measureAndPlace(childId, depth + 1, childX);
      childCenters.push(childX + childWidth / 2);
      childX += childWidth + NODE_GAP;
    }
    const subtreeWidth = Math.max(childX - NODE_GAP - xOffset, NODE_WIDTH);
    const center = (childCenters[0] + childCenters[childCenters.length - 1]) / 2;
    positioned.push({
      id: nodeId,
      location,
      depth,
      x: center - NODE_WIDTH / 2,
      y: depth * (NODE_HEIGHT + LAYER_GAP),
    });
    return subtreeWidth;
  }

  const totalWidth = measureAndPlace(root.id, 0, 0);
  const nodes = positioned.map((p) => buildNode(p));

  return {
    nodes,
    width: Math.max(totalWidth, NODE_WIDTH),
    height: maxOf(nodes.map((node) => node.y + node.height)),
  };
}

/** Packs the trees into shelves (shelf packing) - the same technique as `characterRelationGraphLayout`. */
function packTrees(trees: TreeBox[]): {
  nodes: LocationGraphNode[];
  width: number;
  height: number;
} {
  if (trees.length === 0) {
    return { nodes: [], width: 0, height: 0 };
  }

  const totalArea = trees.reduce((sum, tree) => sum + tree.width * tree.height, 0);
  const rowTargetWidth = Math.max(
    maxOf(trees.map((tree) => tree.width)),
    Math.sqrt(totalArea) * 1.4,
  );

  const nodes: LocationGraphNode[] = [];
  let rowX = 0;
  let rowY = 0;
  let rowHeight = 0;
  let packedWidth = 0;

  for (const tree of trees) {
    if (rowX > 0 && rowX + tree.width > rowTargetWidth) {
      rowY += rowHeight + CLUSTER_GAP;
      rowX = 0;
      rowHeight = 0;
    }

    for (const node of tree.nodes) {
      nodes.push({ ...node, x: node.x + rowX, y: node.y + rowY });
    }

    rowX += tree.width + CLUSTER_GAP;
    rowHeight = Math.max(rowHeight, tree.height);
    packedWidth = Math.max(packedWidth, rowX - CLUSTER_GAP);
  }

  return { nodes, width: packedWidth, height: rowY + rowHeight };
}

function layoutIsolatedGrid(
  isolated: GraphLocation[],
  canvasWidth: number,
  startY: number,
): LocationGraphNode[] {
  if (isolated.length === 0) return [];

  const columnStep = NODE_WIDTH + NODE_GAP;
  const usableWidth = canvasWidth > 0 ? canvasWidth : columnStep * 4;
  const columns = Math.max(1, Math.min(isolated.length, Math.floor(usableWidth / columnStep)));

  const sorted = [...isolated].sort((a, b) => a.name.localeCompare(b.name));

  return sorted.map((location, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    return buildNode(
      {
        id: location.id,
        location,
        depth: 0,
        x: column * columnStep,
        y: startY + row * (NODE_HEIGHT + NODE_GAP),
      },
      true,
    );
  });
}

function buildNode(positioned: PositionedNode, isIsolated = false): LocationGraphNode {
  return {
    id: positioned.id,
    location: positioned.location,
    labelLines: wrapLabel(positioned.location.name, LABEL_MAX_CHARS, LABEL_MAX_LINES),
    depth: positioned.depth,
    isIsolated,
    x: positioned.x,
    y: positioned.y,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
  };
}

function normalizeToPadding(nodes: LocationGraphNode[]): { width: number; height: number } {
  if (nodes.length === 0) {
    return { width: GRAPH_PADDING * 2, height: GRAPH_PADDING * 2 };
  }

  const shiftX = GRAPH_PADDING - minOf(nodes.map((node) => node.x));
  const shiftY = GRAPH_PADDING - minOf(nodes.map((node) => node.y));
  for (const node of nodes) {
    node.x += shiftX;
    node.y += shiftY;
  }

  return {
    width: round(maxOf(nodes.map((node) => node.x + node.width)) + GRAPH_PADDING),
    height: round(maxOf(nodes.map((node) => node.y + node.height)) + GRAPH_PADDING),
  };
}

function pointOnNodeBoundary(node: LocationGraphNode, towards: GraphPoint): GraphPoint {
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

function buildEdge(
  relation: GraphLocationRelation,
  relationType: LocationRelationKind,
  source: LocationGraphNode,
  target: LocationGraphNode,
): LocationGraphEdge {
  const sourceCenter = { x: source.x + source.width / 2, y: source.y + source.height / 2 };
  const targetCenter = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
  const start = pointOnNodeBoundary(source, targetCenter);
  const end = pointOnNodeBoundary(target, sourceCenter);

  return {
    id: relation.id,
    relation,
    relationType,
    sourceId: source.id,
    targetId: target.id,
    path: `M ${round(start.x)} ${round(start.y)} L ${round(end.x)} ${round(end.y)}`,
  };
}

function minOf(values: number[]): number {
  return values.reduce((min, value) => (value < min ? value : min), values[0] ?? 0);
}

function maxOf(values: number[]): number {
  return values.reduce((max, value) => (value > max ? value : max), values[0] ?? 0);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
