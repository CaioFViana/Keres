import type { GraphPoint } from './storyGraphLayout';
import { wrapLabel } from './storyGraphLayout';
import type { GraphLayoutDirection } from './graphLayoutDirection';

/**
 * Positioning for the character relation graph: characters become nodes, relations become edges.
 * Pure on purpose, like `storyGraphLayout.ts` - no React, no database, no platform, so the
 * positioning can be tested in isolation and reused between the screen and (later, if it makes
 * sense) the export.
 *
 * The choice graph has a natural direction (start -> end of a story) and therefore uses a layered
 * layout. Not here: "who knows whom" has no beginning and no end, so layers make no sense - the
 * layout used is radial (one circle per group of connected characters). The choice is also about
 * scale: a force-directed layout (an iterative simulation that relaxes until it settles) gives a
 * more "organic" result, but its cost grows with the square of the number of characters in a
 * synchronous simulation on the JS thread - unworkable for the "massive" story this feature has to
 * withstand. A circle is O(n log n) (sorting only), deterministic (the same story always draws the
 * same map) and its cost does not depend on how many iterations are run, because there is no
 * iteration at all.
 *
 * Each connected component (a group of characters linked to one another, ignoring the rest)
 * becomes its own circle, and the circles are packed side by side like shelves. That avoids a
 * single giant circle when a story has several unrelated families/factions - each one stays
 * readable in its own corner instead of getting lost in one big circle. Characters with no
 * recorded relation go to a separate grid, the same way unreachable scenes go to the
 * "disconnected" grid on the story map.
 */

export interface GraphCharacter {
  id: string;
  name: string;
}

export interface GraphRelation {
  id: string;
  character1Id: string;
  character2Id: string;
  relationType: string;
}

export const NODE_WIDTH = 112;
export const NODE_HEIGHT = 44;
export const GRAPH_PADDING = 28;
/** Minimum space between neighbouring nodes on the same circle. */
const NODE_GAP = 18;
/** Space between clusters/rows in the packing grid. */
const CLUSTER_GAP = 60;
/** Minimum radius even for clusters of 2-3 characters, so they are not squeezed together. */
const MIN_CLUSTER_RADIUS = NODE_HEIGHT * 1.6;
/** How far the edge's tip stays from the node's border - the line must not touch the text. */
const EDGE_NODE_GAP = 4;
const LABEL_MAX_CHARS = 14;
const LABEL_MAX_LINES = 2;

export interface RelationGraphNode {
  id: string;
  character: GraphCharacter;
  labelLines: string[];
  /** How many relations this character has - 0 for those that land in the "no relations" grid. */
  degree: number;
  isIsolated: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RelationGraphEdge {
  id: string;
  relation: GraphRelation;
  sourceId: string;
  targetId: string;
  label: string;
  /** An SVG path's `d` - a straight segment between the two nodes' borders (no arrow: the relation has no direction). */
  path: string;
  labelPosition: GraphPoint;
}

export interface CharacterRelationGraphLayout {
  nodes: RelationGraphNode[];
  edges: RelationGraphEdge[];
  width: number;
  height: number;
  /** Grupos de personagens conectados entre si, isolados do resto. */
  clusterCount: number;
  isolatedCount: number;
}

/** A node under construction: it holds the neighbours while the components have not been separated yet. */
interface WorkNode {
  character: GraphCharacter;
  neighbors: WorkEdge[];
  component: number;
}

interface WorkEdge {
  relation: GraphRelation;
  a: WorkNode;
  b: WorkNode;
}

/** Builds the complete layout. Returns an empty graph when there are no characters. */
export function buildCharacterRelationGraphLayout(
  characters: GraphCharacter[],
  relations: GraphRelation[],
  direction: GraphLayoutDirection = 'top-to-bottom',
): CharacterRelationGraphLayout {
  const nodeById = new Map<string, WorkNode>();
  for (const character of characters) {
    nodeById.set(character.id, { character, neighbors: [], component: -1 });
  }

  const workEdges: WorkEdge[] = [];
  for (const relation of relations) {
    const a = nodeById.get(relation.character1Id);
    const b = nodeById.get(relation.character2Id);
    // A deleted character whose relation has not been cleaned up yet - the same treatment as a choice
    // left dangling on the story map: ignored rather than breaking the drawing.
    if (!a || !b) continue;
    const edge: WorkEdge = { relation, a, b };
    a.neighbors.push(edge);
    b.neighbors.push(edge);
    workEdges.push(edge);
  }

  const allNodes = [...nodeById.values()];
  if (allNodes.length === 0) {
    return {
      nodes: [],
      edges: [],
      width: GRAPH_PADDING * 2,
      height: GRAPH_PADDING * 2,
      clusterCount: 0,
      isolatedCount: 0,
    };
  }

  const components = findComponents(allNodes);
  const clusterComponents = components.filter((component) => component.length > 1);
  const isolatedComponents = components.filter((component) => component.length === 1).flat();

  const clusterBoxes = clusterComponents
    .map(layoutComponentCircular)
    // Maiores primeiro deixa o empacotamento em prateleiras mais compacto (first-fit decreasing).
    .sort((a, b) => b.width * b.height - a.width * a.height);

  const packed = packClusters(clusterBoxes, direction);
  const isolatedNodes =
    direction === 'left-to-right'
      ? layoutIsolatedColumn(
          isolatedComponents,
          packed.nodes.length > 0 ? packed.width + CLUSTER_GAP : 0,
          packed.height,
        )
      : layoutIsolatedGrid(
          isolatedComponents,
          packed.width,
          packed.nodes.length > 0 ? packed.height + CLUSTER_GAP : 0,
        );

  const nodes = [...packed.nodes, ...isolatedNodes];
  const { width, height } = normalizeToPadding(nodes);

  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const edges: RelationGraphEdge[] = [];
  for (const workEdge of workEdges) {
    const source = nodesById.get(workEdge.a.character.id);
    const target = nodesById.get(workEdge.b.character.id);
    if (!source || !target) continue;
    edges.push(buildEdge(workEdge, source, target));
  }

  return {
    nodes,
    edges,
    width,
    height,
    clusterCount: clusterComponents.length,
    isolatedCount: isolatedComponents.length,
  };
}

/** Connected components, ignoring any notion of direction - there never was one here. */
function findComponents(nodes: WorkNode[]): WorkNode[][] {
  const components: WorkNode[][] = [];

  for (const start of nodes) {
    if (start.component !== -1) continue;
    const componentIndex = components.length;
    const members: WorkNode[] = [];
    const queue = [start];
    start.component = componentIndex;

    while (queue.length > 0) {
      const node = queue.pop()!;
      members.push(node);
      for (const edge of node.neighbors) {
        const neighbor = edge.a === node ? edge.b : edge.a;
        if (neighbor.component === -1) {
          neighbor.component = componentIndex;
          queue.push(neighbor);
        }
      }
    }

    components.push(members);
  }

  return components;
}

/**
 * Orders a cluster's characters so the circle is walked by relation proximity rather than by
 * name. Starting from the most connected one and visiting neighbours breadth-first (BFS) puts
 * directly related characters near each other on the circle, which reduces chords crossing the
 * middle of the drawing - without that, an arbitrary order would cross edges everywhere.
 */
function orderByBreadthFromHub(members: WorkNode[]): WorkNode[] {
  const hub = [...members].sort(
    (a, b) =>
      b.neighbors.length - a.neighbors.length || a.character.id.localeCompare(b.character.id),
  )[0];

  const order: WorkNode[] = [];
  const visited = new Set<WorkNode>([hub]);
  const queue = [hub];

  while (queue.length > 0) {
    const node = queue.shift()!;
    order.push(node);
    const next = node.neighbors
      .map((edge) => (edge.a === node ? edge.b : edge.a))
      .filter((neighbor) => !visited.has(neighbor))
      .sort((a, b) => a.character.name.localeCompare(b.character.name));
    for (const neighbor of next) {
      visited.add(neighbor);
      queue.push(neighbor);
    }
  }

  return order;
}

interface ClusterBox {
  nodes: RelationGraphNode[];
  width: number;
  height: number;
}

/** Spreads a cluster around a circle, with a radius large enough that the nodes do not overlap. */
function layoutComponentCircular(members: WorkNode[]): ClusterBox {
  const ordered = orderByBreadthFromHub(members);
  const count = ordered.length;

  const circumferenceNeeded = count * (NODE_WIDTH + NODE_GAP);
  const radius = Math.max(MIN_CLUSTER_RADIUS, circumferenceNeeded / (2 * Math.PI));

  const nodes = ordered.map((work, index) => {
    const angle = (index / count) * Math.PI * 2 - Math.PI / 2; // primeiro nó no topo do círculo
    const centerX = Math.cos(angle) * radius;
    const centerY = Math.sin(angle) * radius;
    return buildNode(work, centerX - NODE_WIDTH / 2, centerY - NODE_HEIGHT / 2);
  });

  const minX = minOf(nodes.map((node) => node.x));
  const minY = minOf(nodes.map((node) => node.y));
  for (const node of nodes) {
    node.x -= minX;
    node.y -= minY;
  }

  return {
    nodes,
    width: maxOf(nodes.map((node) => node.x + node.width)),
    height: maxOf(nodes.map((node) => node.y + node.height)),
  };
}

/**
 * Packs the clusters into shelves (shelf packing): it fills a row until a target width is
 * exceeded, then starts the next one. Far from optimal, but simple, O(k) and enough to keep a
 * story with dozens of unrelated families/factions from turning into a kilometre-long horizontal
 * strip.
 */
function packClusters(
  clusters: ClusterBox[],
  direction: GraphLayoutDirection = 'top-to-bottom',
): {
  nodes: RelationGraphNode[];
  width: number;
  height: number;
} {
  if (clusters.length === 0) {
    return { nodes: [], width: 0, height: 0 };
  }

  const totalArea = clusters.reduce((sum, cluster) => sum + cluster.width * cluster.height, 0);
  const rowTargetWidth =
    direction === 'left-to-right'
      ? Infinity
      : Math.max(maxOf(clusters.map((cluster) => cluster.width)), Math.sqrt(totalArea) * 1.4);

  const nodes: RelationGraphNode[] = [];
  let rowX = 0;
  let rowY = 0;
  let rowHeight = 0;
  let packedWidth = 0;

  for (const cluster of clusters) {
    if (rowX > 0 && rowX + cluster.width > rowTargetWidth) {
      rowY += rowHeight + CLUSTER_GAP;
      rowX = 0;
      rowHeight = 0;
    }

    for (const node of cluster.nodes) {
      nodes.push({ ...node, x: node.x + rowX, y: node.y + rowY });
    }

    rowX += cluster.width + CLUSTER_GAP;
    rowHeight = Math.max(rowHeight, cluster.height);
    packedWidth = Math.max(packedWidth, rowX - CLUSTER_GAP);
  }

  return { nodes, width: packedWidth, height: rowY + rowHeight };
}

/** On wide screens, characters with no relations sit to the right of the connected groups. */
function layoutIsolatedColumn(
  isolated: WorkNode[],
  startX: number,
  canvasHeight: number,
): RelationGraphNode[] {
  if (isolated.length === 0) return [];

  const rowStep = NODE_HEIGHT + NODE_GAP;
  const rows = Math.max(1, Math.floor((canvasHeight || rowStep * 4) / rowStep));
  const sorted = [...isolated].sort((a, b) => a.character.name.localeCompare(b.character.name));

  return sorted.map((work, index) => {
    const column = Math.floor(index / rows);
    const row = index % rows;
    return buildNode(work, startX + column * (NODE_WIDTH + NODE_GAP), row * rowStep);
  });
}

/**
 * A grid for the characters with no recorded relation, below the clusters.
 *
 * The number of columns follows the width of the rest of the map so the grid is not wider than the
 * clusters - with no cluster at all (a story with nothing but loose characters), it falls back to
 * four.
 */
function layoutIsolatedGrid(
  isolated: WorkNode[],
  canvasWidth: number,
  startY: number,
): RelationGraphNode[] {
  if (isolated.length === 0) return [];

  const columnStep = NODE_WIDTH + NODE_GAP;
  const usableWidth = canvasWidth > 0 ? canvasWidth : columnStep * 4;
  const columns = Math.max(1, Math.min(isolated.length, Math.floor(usableWidth / columnStep)));

  const sorted = [...isolated].sort((a, b) => a.character.name.localeCompare(b.character.name));

  return sorted.map((work, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    return buildNode(work, column * columnStep, startY + row * (NODE_HEIGHT + NODE_GAP));
  });
}

function buildNode(work: WorkNode, x: number, y: number): RelationGraphNode {
  return {
    id: work.character.id,
    character: work.character,
    labelLines: wrapLabel(work.character.name, LABEL_MAX_CHARS, LABEL_MAX_LINES),
    degree: work.neighbors.length,
    isIsolated: work.neighbors.length === 0,
    x,
    y,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
  };
}

/** Desloca tudo para dentro da margem e devolve o tamanho final do desenho. */
function normalizeToPadding(nodes: RelationGraphNode[]): { width: number; height: number } {
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

/**
 * A point on the node's border, in the direction of `towards` - where the edge should
 * start/finish so it does not cross over the character's text. The node is treated as an ellipse
 * for this calculation: a cheap visual approximation, enough for a straight line to touch the
 * rounded border instead of stopping in the middle of the name.
 */
function pointOnNodeBoundary(node: RelationGraphNode, towards: GraphPoint): GraphPoint {
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
  work: WorkEdge,
  source: RelationGraphNode,
  target: RelationGraphNode,
): RelationGraphEdge {
  const sourceCenter = { x: source.x + source.width / 2, y: source.y + source.height / 2 };
  const targetCenter = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
  const start = pointOnNodeBoundary(source, targetCenter);
  const end = pointOnNodeBoundary(target, sourceCenter);

  return {
    id: work.relation.id,
    relation: work.relation,
    sourceId: source.id,
    targetId: target.id,
    label: work.relation.relationType ?? '',
    path: `M ${round(start.x)} ${round(start.y)} L ${round(end.x)} ${round(end.y)}`,
    labelPosition: { x: round((start.x + end.x) / 2), y: round((start.y + end.y) / 2) },
  };
}

/**
 * `Math.max(...values)`/`Math.min(...values)` blow the argument stack on very large arrays -
 * exactly the risk this module exists to avoid on a "massive" graph.
 */
function minOf(values: number[]): number {
  return values.reduce((min, value) => (value < min ? value : min), values[0] ?? 0);
}

function maxOf(values: number[]): number {
  return values.reduce((max, value) => (value > max ? value : max), values[0] ?? 0);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
