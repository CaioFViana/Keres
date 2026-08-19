import { GraphPoint, wrapLabel } from './storyGraphLayout';

/**
 * Posicionamento do grafo de relações entre personagens: personagens viram nós, relações
 * viram arestas. Puro de propósito, como `storyGraphLayout.ts` - nada de React, banco ou
 * plataforma, para poder testar o posicionamento isolado e reaproveitar entre tela e (no
 * futuro, se fizer sentido) exportação.
 *
 * O grafo de escolhas tem uma direção natural (início -> fim de uma história) e por isso usa
 * um layout em camadas. Aqui não: "quem conhece quem" não tem começo nem fim, então camadas
 * não fazem sentido - o layout usado é radial (um círculo por grupo de personagens
 * conectados). A escolha também é sobre escala: um layout de força (simulação iterativa que
 * relaxa até parar) dá um resultado mais "orgânico", mas o custo cresce com o quadrado do
 * número de personagens em simulação síncrona na thread de JS - inviável para a história
 * "massiva" que este recurso precisa aguentar. Um círculo é O(n log n) (só ordenação),
 * determinístico (a mesma história sempre desenha o mesmo mapa) e o custo não depende de
 * quantas iterações rodar, porque não há iteração nenhuma.
 *
 * Cada componente conectado (grupo de personagens ligados entre si, ignorando o resto) vira
 * o seu próprio círculo, e os círculos são empacotados lado a lado como prateleiras. Isso
 * evita um único círculo gigante quando a história tem várias famílias/facções sem relação
 * entre si - cada uma fica legível no seu canto em vez de se perder num círculo só.
 * Personagens sem nenhuma relação registrada vão para uma grade separada, do mesmo jeito que
 * cenas inalcançáveis vão para a grade de "desconectadas" no mapa de história.
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
/** Espaço mínimo entre nós vizinhos no mesmo círculo. */
const NODE_GAP = 18;
/** Espaço entre clusters/linhas na grade de empacotamento. */
const CLUSTER_GAP = 60;
/** Raio mínimo mesmo para clusters de 2-3 personagens, para não ficarem espremidos. */
const MIN_CLUSTER_RADIUS = NODE_HEIGHT * 1.6;
/** Afastamento da ponta da aresta em relação à borda do nó - a linha não deve tocar o texto. */
const EDGE_NODE_GAP = 4;
const LABEL_MAX_CHARS = 14;
const LABEL_MAX_LINES = 2;

export interface RelationGraphNode {
  id: string;
  character: GraphCharacter;
  labelLines: string[];
  /** Quantas relações este personagem tem - 0 para os que caem na grade "sem relações". */
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
  /** `d` de um path SVG - um segmento reto entre as bordas dos dois nós (sem seta: a relação não tem direção). */
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

/** Nó em construção: guarda os vizinhos enquanto os componentes ainda não foram separados. */
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

/** Monta o layout completo. Devolve um grafo vazio quando não há personagens. */
export function buildCharacterRelationGraphLayout(
  characters: GraphCharacter[],
  relations: GraphRelation[],
): CharacterRelationGraphLayout {
  const nodeById = new Map<string, WorkNode>();
  for (const character of characters) {
    nodeById.set(character.id, { character, neighbors: [], component: -1 });
  }

  const workEdges: WorkEdge[] = [];
  for (const relation of relations) {
    const a = nodeById.get(relation.character1Id);
    const b = nodeById.get(relation.character2Id);
    // Personagem excluído mas a relação ainda não foi limpa - mesmo tratamento que uma
    // escolha pendurada no mapa de história: ignorada em vez de quebrar o desenho.
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

  const packed = packClusters(clusterBoxes);
  const isolatedNodes = layoutIsolatedGrid(
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

/** Componentes ligados, ignorando qualquer noção de direção - aqui nunca existiu uma. */
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
 * Ordena os personagens de um cluster para percorrer o círculo por proximidade de relação,
 * não por nome. Começar pelo mais conectado e visitar vizinhos em largura (BFS) faz quem se
 * relaciona direto ficar perto no círculo, o que reduz cordas cruzando o meio do desenho -
 * sem isso, uma ordem arbitrária cruzaria arestas para todo lado.
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

/** Distribui um cluster em círculo, com raio grande o bastante para os nós não se sobreporem. */
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
 * Empacota os clusters em prateleiras (shelf packing): preenche uma linha até estourar uma
 * largura-alvo, depois começa a próxima. Longe de ótimo, mas simples, O(k) e suficiente para
 * uma história com dezenas de famílias/facções sem relação entre si não virar uma faixa
 * horizontal quilométrica.
 */
function packClusters(clusters: ClusterBox[]): {
  nodes: RelationGraphNode[];
  width: number;
  height: number;
} {
  if (clusters.length === 0) {
    return { nodes: [], width: 0, height: 0 };
  }

  const totalArea = clusters.reduce((sum, cluster) => sum + cluster.width * cluster.height, 0);
  const rowTargetWidth = Math.max(
    maxOf(clusters.map((cluster) => cluster.width)),
    Math.sqrt(totalArea) * 1.4,
  );

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

/**
 * Grade para os personagens sem nenhuma relação registrada, abaixo dos clusters.
 *
 * O número de colunas acompanha a largura do resto do mapa para a grade não ficar mais larga
 * que os clusters - sem nenhum cluster (história só com personagens soltos), cai em quatro.
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
 * Ponto na borda do nó, na direção de `towards` - onde a aresta deve começar/terminar para
 * não atravessar por cima do texto do personagem. O nó é tratado como uma elipse para este
 * cálculo: aproximação visual barata, o suficiente para uma linha reta encostar na borda
 * arredondada em vez de parar no meio do nome.
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
 * `Math.max(...values)`/`Math.min(...values)` estouram a pilha de argumentos em arrays muito
 * grandes - exatamente o risco que este módulo existe para evitar num grafo "massivo".
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
