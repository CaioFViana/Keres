import { AVATAR_FALLBACK_PALETTE } from '../metadata/avatar';
import type { GraphLayoutDirection } from './graphLayoutDirection';
import {
  normalizeToPadding,
  placeEdges,
  serializeEdge,
  spreadLabelAnchors,
} from './storyGraphLayoutEdges';
/**
 * Positioning for a story's graph: scenes become nodes, choices become edges.
 *
 * This module is pure on purpose - no React, no database, no platform. It receives
 * scenes/choices/chapters and returns finished coordinates, which allows *two* renderers over the
 * same result (the interactive screen and the exported SVG file) without duplicating the hard part,
 * and allows testing the positioning without starting the app.
 *
 * The choice of algorithm matters: a force-directed layout (what the previous version used) guesses
 * positions and relaxes until it settles, so on a small graph with large nodes it piles everything
 * in the middle. Here the layout is layered (Sugiyama style): a node's layer comes from its
 * distance to the start of the story, and within a layer the nodes take columns that never overlap
 * - by construction, not by luck. As a side effect the drawing is deterministic: the same story
 * always produces the same map, so exporting twice gives the same file.
 */

/** Cena, reduzida ao que o layout precisa (SceneSelect satisfaz esta forma). */
export interface GraphScene {
  id: string;
  name: string;
  chapterId: string | null;
  index: number;
  isStart: boolean;
  isFinish: boolean;
  summary?: string | null;
  gap?: number | null;
  gapType?: string | null;
  duration?: number | null;
  durationType?: string | null;
}

/** Escolha, reduzida ao que o layout precisa (ChoiceSelect satisfaz esta forma). */
export interface GraphChoice {
  id: string;
  sceneId: string;
  nextSceneId: string;
  text: string;
}

/** A chapter, reduced to what the layout needs (ChapterSelect satisfies this shape). */
export interface GraphChapter {
  id: string;
  name: string;
  index: number;
}

export const NODE_WIDTH = 168;
export const NODE_HEIGHT = 72;
/** Margin around everything that is drawn, edges included. */
export const GRAPH_PADDING = 28;
/** Horizontal space between neighbouring nodes in the same layer. */
const COLUMN_GAP = 34;
/** Vertical space between layers - generous because that is where the edges curve. */
const LAYER_GAP = 92;
/** Separation between stretches of the story that do not connect to each other. */
const COMPONENT_GAP = 72;
const COLUMN_STEP = NODE_WIDTH + COLUMN_GAP;
const LAYER_STEP = NODE_HEIGHT + LAYER_GAP;

const LABEL_MAX_LINES = 2;
/** Characters per line that fit within NODE_WIDTH in the font used on the nodes. */
const LABEL_MAX_CHARS = 20;


/**
 * Chapter colours chosen to work on a light *and* a dark background.
 *
 * Pulling from the theme would give more integrated colours, but the exported map leaves the app and
 * is seen anywhere; hence medium saturation instead of extreme tones.
 */
/** The same palette that serves as a fallback for avatars - a single copy, in `@keres/shared`. */
export const CHAPTER_PALETTE = AVATAR_FALLBACK_PALETTE;

export interface GraphPoint {
  x: number;
  y: number;
}

export interface GraphNode {
  id: string;
  scene: GraphScene;
  /** The name broken into lines - both renderers need the same wrapping. */
  labelLines: string[];
  chapterId: string | null;
  chapterName: string;
  chapterColor: string;
  isStart: boolean;
  isFinish: boolean;
  /** Distance in layers to the beginning of the story. */
  layer: number;
  x: number;
  y: number;
  width: number;
  height: number;
  /** `true` para as cenas que ficaram fora do fluxo, na grade do fim do mapa. */
  isDetached: boolean;
}

/**
 * `forward` goes down one or more layers (the normal flow), `lateral` links scenes in the same
 * layer, `backward` goes back to an earlier scene and `self` is a scene pointing at itself.
 *
 * The distinction exists because a return drawn like the other edges gets lost in the middle of the
 * map, and returns are exactly what the author of a branching story most needs to see.
 */
export type GraphEdgeKind = 'forward' | 'lateral' | 'backward' | 'self';

export interface GraphEdge {
  id: string;
  choice: GraphChoice;
  sourceId: string;
  targetId: string;
  label: string;
  kind: GraphEdgeKind;
  /** An SVG path's `d` - a single cubic curve. */
  path: string;
  /** The tip's triangle, in absolute coordinates, ready for `points`. */
  arrowPoints: string;
  /** Middle of the curve, where the choice's text is anchored. */
  labelPosition: GraphPoint;
  color: string;
}

export interface GraphChapterLegendEntry {
  id: string;
  name: string;
  color: string;
  sceneCount: number;
}

export interface StoryGraphLayout {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Total size of the drawing, margins included. */
  width: number;
  height: number;
  chapters: GraphChapterLegendEntry[];
  /** Choices ignored because they point at a scene that no longer exists. */
  danglingChoiceCount: number;
  hasBackwardEdges: boolean;
  detachedSceneCount: number;
}

/** A node under construction: it holds the links and the position being computed. */
interface WorkNode {
  scene: GraphScene;
  chapterIndex: number;
  outgoing: WorkEdge[];
  incoming: WorkEdge[];
  layer: number;
  /** Index within the layer; it defines the order, not the final position. */
  order: number;
  x: number;
  component: number;
}

export interface WorkEdge {
  choice: GraphChoice;
  source: WorkNode;
  target: WorkNode;
  /**
   * An edge that closes a cycle, detected during the depth-first search.
   *
   * It has to stay out of the layer computation: a branching story has returns ("try again", "back to
   * the room"), and a cycle would make layer assignment never finish.
   */
  closesCycle: boolean;
}

export interface Cubic {
  start: GraphPoint;
  control1: GraphPoint;
  control2: GraphPoint;
  end: GraphPoint;
}

export interface PlacedEdge {
  work: WorkEdge;
  source: GraphNode;
  target: GraphNode;
  kind: GraphEdgeKind;
  curve: Cubic;
}

/** Breaks the name into lines to fit the node, with "…" when it does not fit. */
export function wrapLabel(
  text: string,
  maxChars = LABEL_MAX_CHARS,
  maxLines = LABEL_MAX_LINES,
): string[] {
  const normalized = (text ?? '').trim().replace(/\s+/g, ' ');
  if (!normalized) return [''];

  const words = normalized.split(' ');
  const lines: string[] = [];
  let current = '';
  let wordIndex = 0;
  let cutMidWord = false;

  while (wordIndex < words.length && lines.length < maxLines) {
    const word = words[wordIndex];
    const candidate = current ? `${current} ${word}` : word;

    if (candidate.length <= maxChars) {
      current = candidate;
      wordIndex += 1;
      continue;
    }
    if (current) {
      lines.push(current);
      current = '';
      continue;
    }
    // A single word longer than the whole line (a name with no spaces): cut it by force.
    lines.push(word.slice(0, maxChars));
    cutMidWord = true;
    wordIndex += 1;
  }

  const droppedTail = current !== '' && lines.length >= maxLines;
  if (current && lines.length < maxLines) lines.push(current);

  if ((wordIndex < words.length || droppedTail || cutMidWord) && lines.length > 0) {
    const last = lines[lines.length - 1];
    lines[lines.length - 1] = `${last.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
  }

  return lines.length > 0 ? lines : [''];
}

/** Builds the complete layout. Returns an empty graph when there are no scenes. */
export function buildStoryGraphLayout(
  scenes: GraphScene[],
  choices: GraphChoice[],
  chapters: GraphChapter[],
  direction: GraphLayoutDirection = 'top-to-bottom',
): StoryGraphLayout {
  const chapterById = new Map(chapters.map((chapter) => [chapter.id, chapter]));
  const chapterColorById = buildChapterColors(chapters);
  const legend = buildLegend(scenes, chapters, chapterColorById);

  const nodeById = new Map<string, WorkNode>();
  for (const scene of scenes) {
    nodeById.set(scene.id, {
      scene,
      chapterIndex: scene.chapterId
        ? (chapterById.get(scene.chapterId)?.index ?? Number.MAX_SAFE_INTEGER)
        : Number.MAX_SAFE_INTEGER,
      outgoing: [],
      incoming: [],
      layer: 0,
      order: 0,
      x: 0,
      component: -1,
    });
  }

  const workEdges: WorkEdge[] = [];
  let danglingChoiceCount = 0;
  for (const choice of choices) {
    const source = nodeById.get(choice.sceneId);
    const target = nodeById.get(choice.nextSceneId);
    if (!source || !target) {
      danglingChoiceCount += 1;
      continue;
    }
    const edge: WorkEdge = { choice, source, target, closesCycle: false };
    source.outgoing.push(edge);
    target.incoming.push(edge);
    workEdges.push(edge);
  }

  const allNodes = [...nodeById.values()].sort(compareByStoryOrder);
  if (allNodes.length === 0) {
    return {
      nodes: [],
      edges: [],
      width: GRAPH_PADDING * 2,
      height: GRAPH_PADDING * 2,
      chapters: legend,
      danglingChoiceCount,
      hasBackwardEdges: false,
      detachedSceneCount: 0,
    };
  }

  const components = findComponents(allNodes);
  // A scene no choice reaches has no natural place in the flow. Those go to a grid at the end of the
  // map instead of becoming N single-node "stories" spread out horizontally.
  const flows = components.filter((component) => component.length > 1);
  const detached = components.filter((component) => component.length === 1).flat();

  let xOffset = 0;
  let flowHeight = 0;
  for (const flow of flows) {
    assignLayers(flow);
    const layers = groupByLayer(flow);
    orderWithinLayers(layers);
    assignHorizontalPositions(layers);

    for (const node of flow) node.x += xOffset;
    const flowWidth = Math.max(...flow.map((node) => node.x)) + NODE_WIDTH - xOffset;
    xOffset += flowWidth + COMPONENT_GAP;
    flowHeight = Math.max(flowHeight, layers.length * LAYER_STEP - LAYER_GAP);
  }

  const flowWidth = flows.length > 0 ? xOffset - COMPONENT_GAP : 0;
  layOutDetachedNodes(detached, flowWidth, flowHeight);
  const detachedIds = new Set(detached.map((node) => node.scene.id));

  const nodes: GraphNode[] = allNodes.map((node) => ({
    id: node.scene.id,
    scene: node.scene,
    labelLines: wrapLabel(node.scene.name),
    chapterId: node.scene.chapterId,
    chapterName: node.scene.chapterId ? (chapterById.get(node.scene.chapterId)?.name ?? '') : '',
    chapterColor: node.scene.chapterId
      ? (chapterColorById.get(node.scene.chapterId) ?? CHAPTER_PALETTE[0])
      : CHAPTER_PALETTE[0],
    isStart: node.scene.isStart,
    isFinish: node.scene.isFinish,
    layer: node.layer,
    x: node.x,
    y: node.layer * LAYER_STEP,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
    isDetached: detachedIds.has(node.scene.id),
  }));

  if (direction === 'left-to-right') orientNodesLeftToRight(nodes);

  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const placedEdges = placeEdges(workEdges, nodesById, direction);

  // Return curves and loops go outside the nodes, so the drawing's box can only be closed after they
  // are known - otherwise the exported map cuts off the story's returns.
  const offset = normalizeToPadding(nodes, placedEdges);
  const labelAnchors = spreadLabelAnchors(placedEdges);

  return {
    nodes,
    edges: placedEdges.map((placed) => serializeEdge(placed, labelAnchors.get(placed) ?? 0.5)),
    width: offset.width,
    height: offset.height,
    chapters: legend,
    danglingChoiceCount,
    hasBackwardEdges: placedEdges.some(
      (placed) => placed.kind === 'backward' || placed.kind === 'self',
    ),
    detachedSceneCount: detached.length,
  };
}

/** Rotates the flow, preserving spacing appropriate for cards that are not square. */
function orientNodesLeftToRight(nodes: GraphNode[]): void {
  const horizontalLayerStep = NODE_WIDTH + LAYER_GAP;
  const verticalColumnStep = NODE_HEIGHT + COLUMN_GAP;
  for (const node of nodes) {
    const previousX = node.x;
    const previousY = node.y;
    node.x = (previousY / LAYER_STEP) * horizontalLayerStep;
    node.y = (previousX / COLUMN_STEP) * verticalColumnStep;
  }
}

function compareByStoryOrder(a: WorkNode, b: WorkNode): number {
  if (a.chapterIndex !== b.chapterIndex) return a.chapterIndex - b.chapterIndex;
  if (a.scene.index !== b.scene.index) return a.scene.index - b.scene.index;
  return a.scene.id.localeCompare(b.scene.id);
}

export function buildChapterColors(chapters: GraphChapter[]): Map<string, string> {
  const ordered = [...chapters].sort((a, b) => a.index - b.index || a.id.localeCompare(b.id));
  return new Map(
    ordered.map((chapter, position) => [
      chapter.id,
      CHAPTER_PALETTE[position % CHAPTER_PALETTE.length],
    ]),
  );
}

function buildLegend(
  scenes: GraphScene[],
  chapters: GraphChapter[],
  colors: Map<string, string>,
): GraphChapterLegendEntry[] {
  const counts = new Map<string, number>();
  for (const scene of scenes) {
    if (!scene.chapterId) continue;
    counts.set(scene.chapterId, (counts.get(scene.chapterId) ?? 0) + 1);
  }

  return [...chapters]
    .sort((a, b) => a.index - b.index || a.id.localeCompare(b.id))
    .filter((chapter) => (counts.get(chapter.id) ?? 0) > 0)
    .map((chapter) => ({
      id: chapter.id,
      name: chapter.name,
      color: colors.get(chapter.id) ?? CHAPTER_PALETTE[0],
      sceneCount: counts.get(chapter.id) ?? 0,
    }));
}

/** Connected components, ignoring the direction of the edges. */
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
      for (const edge of [...node.outgoing, ...node.incoming]) {
        const neighbour = edge.source === node ? edge.target : edge.source;
        if (neighbour.component === -1) {
          neighbour.component = componentIndex;
          queue.push(neighbour);
        }
      }
    }

    components.push(members.sort(compareByStoryOrder));
  }

  return components;
}

/**
 * Each node's layer = the longest path from a starting scene.
 *
 * The *longest* path (rather than the shortest) is what guarantees no flow edge points upwards: if A
 * leads to B, B lands on a strictly greater layer. That is what makes the map read from top to
 * bottom, the way the story is read.
 */
function assignLayers(component: WorkNode[]): void {
  markCycleClosingEdges(component);

  const pendingIncoming = new Map<WorkNode, number>();
  for (const node of component) {
    node.layer = 0;
    pendingIncoming.set(node, node.incoming.filter((edge) => !edge.closesCycle).length);
  }

  const queue = component.filter((node) => pendingIncoming.get(node) === 0);
  let processed = 0;

  while (queue.length > 0) {
    const node = queue.shift()!;
    processed += 1;
    for (const edge of node.outgoing) {
      if (edge.closesCycle) continue;
      const target = edge.target;
      target.layer = Math.max(target.layer, node.layer + 1);
      const remaining = (pendingIncoming.get(target) ?? 1) - 1;
      pendingIncoming.set(target, remaining);
      if (remaining === 0) queue.push(target);
    }
  }

  if (processed === component.length) return;

  // Safety net: if anyone is left over (which would only happen if cycle detection let something
  // through), the node is put below the highest already-resolved predecessor, instead of being left on
  // layer 0 overlapping the beginning of the story.
  for (const node of component) {
    if (pendingIncoming.get(node) === 0) continue;
    const resolvedPredecessors = node.incoming
      .filter((edge) => !edge.closesCycle && pendingIncoming.get(edge.source) === 0)
      .map((edge) => edge.source.layer);
    if (resolvedPredecessors.length > 0) node.layer = Math.max(...resolvedPredecessors) + 1;
    pendingIncoming.set(node, 0);
  }
}

/**
 * Marks the edges that go back to a scene already visited on the current path.
 *
 * An iterative (not recursive) depth-first search, because a long linear story is a chain of hundreds
 * of scenes, and recursion at that depth blows the stack on the user's device long before it blows
 * in any test.
 */
function markCycleClosingEdges(component: WorkNode[]): void {
  const state = new Map<WorkNode, 'unvisited' | 'onPath' | 'done'>();
  for (const node of component) state.set(node, 'unvisited');

  // Starting from the initial scenes makes the returns be detected where the author sees them: the
  // "back to the beginning" edge is the one that closes the cycle, not the one that follows the story.
  const roots = [
    ...component.filter((node) => node.scene.isStart),
    ...component.filter((node) => !node.scene.isStart && node.incoming.length === 0),
    ...component,
  ];

  for (const root of roots) {
    if (state.get(root) !== 'unvisited') continue;

    const stack: { node: WorkNode; nextEdge: number }[] = [{ node: root, nextEdge: 0 }];
    state.set(root, 'onPath');

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      if (frame.nextEdge >= frame.node.outgoing.length) {
        state.set(frame.node, 'done');
        stack.pop();
        continue;
      }

      const edge = frame.node.outgoing[frame.nextEdge];
      frame.nextEdge += 1;

      const targetState = state.get(edge.target);
      if (targetState === 'onPath') {
        edge.closesCycle = true;
      } else if (targetState === 'unvisited') {
        state.set(edge.target, 'onPath');
        stack.push({ node: edge.target, nextEdge: 0 });
      }
    }
  }
}

function groupByLayer(component: WorkNode[]): WorkNode[][] {
  const layerCount = Math.max(...component.map((node) => node.layer)) + 1;
  const layers: WorkNode[][] = Array.from({ length: layerCount }, () => []);
  for (const node of component) layers[node.layer].push(node);
  for (const layer of layers) {
    layer.sort(compareByStoryOrder);
    layer.forEach((node, index) => {
      node.order = index;
    });
  }
  return layers;
}

/**
 * Orders the nodes within each layer to reduce edge crossings.
 *
 * The barycentre heuristic: each node wants to sit at the average of its neighbours' positions in
 * the adjacent layer. Alternating downward and upward passes a few times converges quickly and is
 * cheap - truly minimising crossings is NP-hard and would not be worth the cost on a phone screen.
 */
function orderWithinLayers(layers: WorkNode[][]): void {
  for (let pass = 0; pass < 4; pass += 1) {
    const goingDown = pass % 2 === 0;

    for (const layerIndex of sweepOrder(layers.length, goingDown)) {
      const layer = layers[layerIndex];
      const adjacentLayer = layerIndex + (goingDown ? -1 : 1);
      if (adjacentLayer < 0 || adjacentLayer >= layers.length) continue;

      const barycenters = new Map<WorkNode, number>();
      for (const node of layer) {
        const neighbours = neighboursInLayer(node, goingDown, adjacentLayer);
        barycenters.set(
          node,
          neighbours.length > 0
            ? neighbours.reduce((sum, neighbour) => sum + neighbour.order, 0) / neighbours.length
            : node.order,
        );
      }

      layer.sort((a, b) => barycenters.get(a)! - barycenters.get(b)! || a.order - b.order);
      layer.forEach((node, index) => {
        node.order = index;
      });
    }
  }
}

/**
 * Turns the order within a layer into x coordinates.
 *
 * Merely spreading nodes across fixed columns would already avoid overlap, but it would leave linear
 * chains zigzagging. The alignment passes pull each node towards its neighbours' average and then
 * reimpose the minimum spacing - scenes in sequence end up aligned in a column, which is what makes
 * the map look hand-drawn rather than generated.
 */
function assignHorizontalPositions(layers: WorkNode[][]): void {
  for (const layer of layers) {
    layer.forEach((node, index) => {
      node.x = index * COLUMN_STEP;
    });
  }

  for (let pass = 0; pass < 4; pass += 1) {
    const goingDown = pass % 2 === 0;

    for (const layerIndex of sweepOrder(layers.length, goingDown)) {
      const layer = layers[layerIndex];
      const adjacentLayer = layerIndex + (goingDown ? -1 : 1);
      if (adjacentLayer < 0 || adjacentLayer >= layers.length) continue;

      const desired = layer.map((node) => {
        const neighbours = neighboursInLayer(node, goingDown, adjacentLayer);
        if (neighbours.length === 0) return node.x;
        return neighbours.reduce((sum, neighbour) => sum + neighbour.x, 0) / neighbours.length;
      });

      applyWithMinimumSpacing(layer, desired);
    }
  }

  const allNodes = layers.flat();
  const minX = Math.min(...allNodes.map((node) => node.x));
  for (const node of allNodes) node.x -= minX;
}

function sweepOrder(length: number, goingDown: boolean): number[] {
  const indices = Array.from({ length }, (_, index) => index);
  return goingDown ? indices : indices.reverse();
}

/** Neighbours of `node` that are exactly on layer `layerIndex`, ignoring cycles. */
function neighboursInLayer(node: WorkNode, incoming: boolean, layerIndex: number): WorkNode[] {
  return (incoming ? node.incoming : node.outgoing)
    .filter((edge) => !edge.closesCycle)
    .map((edge) => (incoming ? edge.source : edge.target))
    .filter((neighbour) => neighbour.layer === layerIndex);
}

/**
 * Brings the nodes closer to their desired positions without breaking the order or the minimum
 * spacing.
 *
 * The sweep only pushes to the right, so the whole layer would end up displaced relative to what the
 * neighbours asked for; shifting the block back by the difference of the averages preserves every
 * spacing and keeps the layer centred where it should be.
 */
function applyWithMinimumSpacing(layer: WorkNode[], desired: number[]): void {
  if (layer.length === 0) return;

  const positions = [...desired];
  for (let index = 1; index < positions.length; index += 1) {
    positions[index] = Math.max(positions[index], positions[index - 1] + COLUMN_STEP);
  }

  const drift = average(positions) - average(desired);
  layer.forEach((node, index) => {
    node.x = positions[index] - drift;
  });
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * A grid for the scenes no choice reaches, below the flow.
 *
 * The number of columns follows the width of the rest of the map so the grid is not wider than the
 * story - with a story empty of choices, it falls back to three columns.
 */
function layOutDetachedNodes(detached: WorkNode[], flowWidth: number, flowHeight: number): void {
  if (detached.length === 0) return;

  const usableWidth = flowWidth > 0 ? flowWidth : COLUMN_STEP * 3;
  const columns = Math.max(1, Math.min(detached.length, Math.floor(usableWidth / COLUMN_STEP)));
  const firstLayer = flowHeight > 0 ? Math.ceil((flowHeight + LAYER_GAP) / LAYER_STEP) : 0;

  detached.sort(compareByStoryOrder).forEach((node, index) => {
    node.x = (index % columns) * COLUMN_STEP;
    node.layer = firstLayer + Math.floor(index / columns);
  });
}

