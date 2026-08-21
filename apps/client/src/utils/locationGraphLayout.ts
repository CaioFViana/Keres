import { GraphPoint, wrapLabel } from './storyGraphLayout';

/**
 * Posicionamento do grafo de estrutura de Locations: cada Location vira um nó, e as duas
 * relações (`contains`/`connected_to`) viram arestas com estilos diferentes.
 *
 * Diferente do grafo de relações entre personagens (radial, sem hierarquia), `contains` TEM
 * uma direção natural (pai -> filho) e - por construção, ver `LocationRelationSyncHandler` no
 * servidor - forma sempre uma floresta (cada Location tem no máximo um pai vivo, sem ciclos).
 * Isso permite um layout em árvore simples (topo-para-baixo, sem minimização de cruzamentos)
 * em vez do layout em camadas mais complexo do mapa de história (que precisa lidar com DAGs
 * arbitrários). `connected_to` não tem hierarquia - essas arestas são desenhadas por cima,
 * entre onde quer que os nós já tenham caído pela árvore, sem influenciar o posicionamento.
 *
 * Puro de propósito (sem React/banco/plataforma), como os outros dois layouts de grafo do app.
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
/** Defesa contra dado corrompido (um ciclo que escapou da validação) - nunca deveria ser atingido numa árvore válida. */
const MAX_TREE_DEPTH = 500;

export interface LocationGraphNode {
  id: string;
  location: GraphLocation;
  labelLines: string[];
  /** Camada na árvore 'contains' - 0 para raízes. Sempre 0 para nós isolados. */
  depth: number;
  /** Sem nenhuma relação (nem contains, nem connected_to). */
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
  /** `d` de um path SVG entre as bordas dos dois nós. */
  path: string;
}

export interface LocationGraphLayout {
  nodes: LocationGraphNode[];
  edges: LocationGraphEdge[];
  width: number;
  height: number;
  /** Árvores 'contains' com mais de um nó ou com ao menos uma conexão. */
  treeCount: number;
  /** Locations sem nenhuma relação registrada. */
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

  // Relações penduradas numa Location já excluída mas ainda não limpa - mesmo tratamento que o
  // resto do app dá a esse tipo de linha órfã: ignorada, não quebra o desenho.
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

  // Compartilhado entre as árvores: uma Location alcançável por mais de um caminho (dois `contains`
  // apontando para ela, ou um ciclo) é desenhada uma vez só, não uma vez por caminho.
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

/**
 * Raízes da floresta `contains`.
 *
 * Normalmente é só "quem não tem pai". O caso extra existe para dado corrompido: num ciclo
 * `contains` fechado (a contém b, b contém a) toda Location tem pai, nenhuma seria raiz, e o
 * mapa inteiro sairia vazio - o pior resultado possível, porque o usuário não veria nem o
 * problema nem o resto da história. O servidor (`LocationRelationSyncHandler`) impede esse
 * dado; isto é a rede de segurança para quando ele chega assim mesmo. Elege a Location de
 * menor id de cada grupo inalcançável como raiz, de forma determinística, para o grupo
 * aparecer no mapa em vez de sumir dele.
 */
function collectRoots(
  locations: GraphLocation[],
  parentOf: Map<string, string>,
  childrenOf: Map<string, string[]>,
): GraphLocation[] {
  const roots = locations.filter((location) => !parentOf.has(location.id));
  const reachable = new Set<string>();

  // Iterativo, não recursivo: a profundidade aqui é a da árvore de Locations do usuário, e
  // este módulo existe justamente para aguentar uma história grande sem estourar a pilha.
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
 * Layout em árvore topo-para-baixo de uma única raiz: largura de cada subárvore calculada de
 * baixo para cima (pós-ordem), pai centralizado acima dos filhos. Sem minimização de
 * cruzamentos (desnecessária - é uma árvore, não um DAG geral) e sem simulação iterativa.
 *
 * `placed` é compartilhado entre as árvores da mesma chamada e garante que cada Location seja
 * posicionada uma única vez, mesmo quando mais de um caminho leva até ela.
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
    // Marcado na entrada, antes de descer: cobre tanto "já desenhado por outro caminho" quanto
    // um ciclo `contains` corrompido, que aqui simplesmente para de descer em vez de recursão
    // infinita. O `MAX_TREE_DEPTH` continua como última defesa.
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

/** Empacota as árvores em prateleiras (shelf packing) - mesma técnica de `characterRelationGraphLayout`. */
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
