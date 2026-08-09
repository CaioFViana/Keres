/**
 * Posicionamento do grafo de uma história: cenas viram nós, escolhas viram arestas.
 *
 * Este módulo é puro de propósito - nada de React, de banco ou de plataforma. Ele recebe
 * cenas/escolhas/capítulos e devolve coordenadas prontas, o que permite ter *dois* renderers
 * sobre o mesmo resultado (a tela interativa e o arquivo SVG exportado) sem duplicar a parte
 * difícil, e permite testar o posicionamento sem subir o app.
 *
 * A escolha do algoritmo importa: um layout de força (o que a versão anterior usava) chuta
 * posições e relaxa até parar, então em grafo pequeno com nós grandes ele empilha tudo no
 * meio. Aqui o layout é em camadas (estilo Sugiyama): a camada de um nó vem da distância até
 * o início da história, e dentro da camada os nós ocupam colunas que nunca se sobrepõem - por
 * construção, não por sorte. Como efeito colateral o desenho é determinístico: a mesma
 * história gera sempre o mesmo mapa, então exportar duas vezes dá o mesmo arquivo.
 */

/** Cena, reduzida ao que o layout precisa (SceneSelect satisfaz esta forma). */
export interface GraphScene {
  id: string;
  name: string;
  chapterId: string;
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

/** Capítulo, reduzido ao que o layout precisa (ChapterSelect satisfaz esta forma). */
export interface GraphChapter {
  id: string;
  name: string;
  index: number;
}

export const NODE_WIDTH = 168;
export const NODE_HEIGHT = 72;
/** Margem em volta de tudo que é desenhado, arestas incluídas. */
export const GRAPH_PADDING = 28;
/** Espaço horizontal entre nós vizinhos na mesma camada. */
const COLUMN_GAP = 34;
/** Espaço vertical entre camadas - generoso porque é onde as arestas curvam. */
const LAYER_GAP = 92;
/** Separação entre trechos da história que não se conectam entre si. */
const COMPONENT_GAP = 72;
const COLUMN_STEP = NODE_WIDTH + COLUMN_GAP;
const LAYER_STEP = NODE_HEIGHT + LAYER_GAP;

const LABEL_MAX_LINES = 2;
/** Caracteres por linha que caibam em NODE_WIDTH na fonte usada nos nós. */
const LABEL_MAX_CHARS = 20;

const ARROW_LENGTH = 11;
const ARROW_HALF_WIDTH = 5.5;
/** Barriga do laço de uma cena que aponta para si mesma. */
const SELF_LOOP_BULGE = 46;

/**
 * Cores de capítulo escolhidas para funcionar sobre fundo claro *e* escuro.
 *
 * Puxar do tema daria cores mais integradas, mas o mapa exportado sai do app e é visto em
 * qualquer lugar; daí saturação média em vez de tons extremos.
 */
export const CHAPTER_PALETTE = [
  '#4F8DF7',
  '#E4713C',
  '#39A867',
  '#B563D6',
  '#D8A22B',
  '#3FA9B8',
  '#D7566F',
  '#7C8CF0',
  '#6FA130',
  '#C4693F',
];

export interface GraphPoint {
  x: number;
  y: number;
}

export interface GraphNode {
  id: string;
  scene: GraphScene;
  /** Nome quebrado em linhas - os dois renderers precisam da mesma quebra. */
  labelLines: string[];
  chapterId: string;
  chapterName: string;
  chapterColor: string;
  isStart: boolean;
  isFinish: boolean;
  /** Distância em camadas até o começo da história. */
  layer: number;
  x: number;
  y: number;
  width: number;
  height: number;
  /** `true` para as cenas que ficaram fora do fluxo, na grade do fim do mapa. */
  isDetached: boolean;
}

/**
 * `forward` desce uma ou mais camadas (o fluxo normal), `lateral` liga cenas da mesma camada,
 * `backward` volta para uma cena anterior e `self` é a cena que aponta para si mesma.
 *
 * A distinção existe porque um retorno desenhado como as outras arestas se perde no meio do
 * mapa, e retorno é justamente o que o autor de uma história ramificada mais precisa ver.
 */
export type GraphEdgeKind = 'forward' | 'lateral' | 'backward' | 'self';

export interface GraphEdge {
  id: string;
  choice: GraphChoice;
  sourceId: string;
  targetId: string;
  label: string;
  kind: GraphEdgeKind;
  /** `d` de um path SVG - uma única curva cúbica. */
  path: string;
  /** Triângulo da ponta, em coordenadas absolutas, pronto para `points`. */
  arrowPoints: string;
  /** Meio da curva, onde o texto da escolha é ancorado. */
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
  /** Tamanho total do desenho, já com as margens. */
  width: number;
  height: number;
  chapters: GraphChapterLegendEntry[];
  /** Escolhas ignoradas porque apontam para uma cena que não existe mais. */
  danglingChoiceCount: number;
  hasBackwardEdges: boolean;
  detachedSceneCount: number;
}

/** Nó em construção: guarda as ligações e a posição sendo calculada. */
interface WorkNode {
  scene: GraphScene;
  chapterIndex: number;
  outgoing: WorkEdge[];
  incoming: WorkEdge[];
  layer: number;
  /** Índice dentro da camada; define a ordem, não a posição final. */
  order: number;
  x: number;
  component: number;
}

interface WorkEdge {
  choice: GraphChoice;
  source: WorkNode;
  target: WorkNode;
  /**
   * Aresta que fecha um ciclo, detectada na busca em profundidade.
   *
   * Precisa ficar fora do cálculo de camadas: história ramificada tem volta ("tentar de
   * novo", "voltar à sala"), e um ciclo faria a atribuição de camadas nunca terminar.
   */
  closesCycle: boolean;
}

interface Cubic {
  start: GraphPoint;
  control1: GraphPoint;
  control2: GraphPoint;
  end: GraphPoint;
}

interface PlacedEdge {
  work: WorkEdge;
  source: GraphNode;
  target: GraphNode;
  kind: GraphEdgeKind;
  curve: Cubic;
}

/** Quebra o nome em linhas para caber no nó, com "…" quando não cabe. */
export function wrapLabel(text: string, maxChars = LABEL_MAX_CHARS, maxLines = LABEL_MAX_LINES): string[] {
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
    // Palavra sozinha maior que a linha inteira (nome sem espaços): corta na força.
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

/** Monta o layout completo. Devolve um grafo vazio quando não há cenas. */
export function buildStoryGraphLayout(
  scenes: GraphScene[],
  choices: GraphChoice[],
  chapters: GraphChapter[]
): StoryGraphLayout {
  const chapterById = new Map(chapters.map(chapter => [chapter.id, chapter]));
  const chapterColorById = buildChapterColors(chapters);
  const legend = buildLegend(scenes, chapters, chapterColorById);

  const nodeById = new Map<string, WorkNode>();
  for (const scene of scenes) {
    nodeById.set(scene.id, {
      scene,
      chapterIndex: chapterById.get(scene.chapterId)?.index ?? Number.MAX_SAFE_INTEGER,
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
  // Uma cena que nenhuma escolha alcança não tem lugar natural no fluxo. Essas vão para uma
  // grade no fim do mapa em vez de virarem N "histórias" de um nó só espalhadas na horizontal.
  const flows = components.filter(component => component.length > 1);
  const detached = components.filter(component => component.length === 1).flat();

  let xOffset = 0;
  let flowHeight = 0;
  for (const flow of flows) {
    assignLayers(flow);
    const layers = groupByLayer(flow);
    orderWithinLayers(layers);
    assignHorizontalPositions(layers);

    for (const node of flow) node.x += xOffset;
    const flowWidth = Math.max(...flow.map(node => node.x)) + NODE_WIDTH - xOffset;
    xOffset += flowWidth + COMPONENT_GAP;
    flowHeight = Math.max(flowHeight, layers.length * LAYER_STEP - LAYER_GAP);
  }

  const flowWidth = flows.length > 0 ? xOffset - COMPONENT_GAP : 0;
  layOutDetachedNodes(detached, flowWidth, flowHeight);
  const detachedIds = new Set(detached.map(node => node.scene.id));

  const nodes: GraphNode[] = allNodes.map(node => ({
    id: node.scene.id,
    scene: node.scene,
    labelLines: wrapLabel(node.scene.name),
    chapterId: node.scene.chapterId,
    chapterName: chapterById.get(node.scene.chapterId)?.name ?? '',
    chapterColor: chapterColorById.get(node.scene.chapterId) ?? CHAPTER_PALETTE[0],
    isStart: node.scene.isStart,
    isFinish: node.scene.isFinish,
    layer: node.layer,
    x: node.x,
    y: node.layer * LAYER_STEP,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
    isDetached: detachedIds.has(node.scene.id),
  }));

  const nodesById = new Map(nodes.map(node => [node.id, node]));
  const placedEdges = placeEdges(workEdges, nodesById);

  // As curvas de retorno e os laços saem para fora dos nós, então a caixa do desenho só pode
  // ser fechada depois de conhecê-las - senão o mapa exportado corta as voltas da história.
  const offset = normalizeToPadding(nodes, placedEdges);
  const labelAnchors = spreadLabelAnchors(placedEdges);

  return {
    nodes,
    edges: placedEdges.map(placed => serializeEdge(placed, labelAnchors.get(placed) ?? 0.5)),
    width: offset.width,
    height: offset.height,
    chapters: legend,
    danglingChoiceCount,
    hasBackwardEdges: placedEdges.some(placed => placed.kind === 'backward' || placed.kind === 'self'),
    detachedSceneCount: detached.length,
  };
}

function compareByStoryOrder(a: WorkNode, b: WorkNode): number {
  if (a.chapterIndex !== b.chapterIndex) return a.chapterIndex - b.chapterIndex;
  if (a.scene.index !== b.scene.index) return a.scene.index - b.scene.index;
  return a.scene.id.localeCompare(b.scene.id);
}

export function buildChapterColors(chapters: GraphChapter[]): Map<string, string> {
  const ordered = [...chapters].sort((a, b) => a.index - b.index || a.id.localeCompare(b.id));
  return new Map(ordered.map((chapter, position) => [chapter.id, CHAPTER_PALETTE[position % CHAPTER_PALETTE.length]]));
}

function buildLegend(
  scenes: GraphScene[],
  chapters: GraphChapter[],
  colors: Map<string, string>
): GraphChapterLegendEntry[] {
  const counts = new Map<string, number>();
  for (const scene of scenes) counts.set(scene.chapterId, (counts.get(scene.chapterId) ?? 0) + 1);

  return [...chapters]
    .sort((a, b) => a.index - b.index || a.id.localeCompare(b.id))
    .filter(chapter => (counts.get(chapter.id) ?? 0) > 0)
    .map(chapter => ({
      id: chapter.id,
      name: chapter.name,
      color: colors.get(chapter.id) ?? CHAPTER_PALETTE[0],
      sceneCount: counts.get(chapter.id) ?? 0,
    }));
}

/** Componentes ligados, ignorando a direção das arestas. */
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
 * Camada de cada nó = maior caminho desde uma cena inicial.
 *
 * O caminho *mais longo* (e não o mais curto) é o que garante que nenhuma aresta do fluxo
 * aponte para cima: se A leva a B, B fica em uma camada estritamente maior. É isso que faz o
 * mapa ser lido de cima para baixo, como a história é lida.
 */
function assignLayers(component: WorkNode[]): void {
  markCycleClosingEdges(component);

  const pendingIncoming = new Map<WorkNode, number>();
  for (const node of component) {
    node.layer = 0;
    pendingIncoming.set(node, node.incoming.filter(edge => !edge.closesCycle).length);
  }

  const queue = component.filter(node => pendingIncoming.get(node) === 0);
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

  // Rede de segurança: se sobrou alguém (só aconteceria se a detecção de ciclo deixasse algo
  // passar), põe o nó abaixo do maior antecessor já resolvido, em vez de deixá-lo na camada 0
  // sobrepondo o começo da história.
  for (const node of component) {
    if (pendingIncoming.get(node) === 0) continue;
    const resolvedPredecessors = node.incoming
      .filter(edge => !edge.closesCycle && pendingIncoming.get(edge.source) === 0)
      .map(edge => edge.source.layer);
    if (resolvedPredecessors.length > 0) node.layer = Math.max(...resolvedPredecessors) + 1;
    pendingIncoming.set(node, 0);
  }
}

/**
 * Marca as arestas que voltam para uma cena já visitada no caminho atual.
 *
 * Busca em profundidade iterativa (e não recursiva) porque uma história linear longa é uma
 * corrente de centenas de cenas, e recursão nessa profundidade estoura a pilha no aparelho
 * do usuário muito antes de estourar em qualquer teste.
 */
function markCycleClosingEdges(component: WorkNode[]): void {
  const state = new Map<WorkNode, 'unvisited' | 'onPath' | 'done'>();
  for (const node of component) state.set(node, 'unvisited');

  // Começar pelas cenas iniciais faz as voltas serem detectadas onde o autor as enxerga: a
  // aresta "de volta ao começo" é a que fecha o ciclo, não a que segue a história.
  const roots = [
    ...component.filter(node => node.scene.isStart),
    ...component.filter(node => !node.scene.isStart && node.incoming.length === 0),
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
  const layerCount = Math.max(...component.map(node => node.layer)) + 1;
  const layers: WorkNode[][] = Array.from({ length: layerCount }, () => []);
  for (const node of component) layers[node.layer].push(node);
  for (const layer of layers) {
    layer.sort(compareByStoryOrder);
    layer.forEach((node, index) => { node.order = index; });
  }
  return layers;
}

/**
 * Ordena os nós dentro de cada camada para reduzir cruzamentos de arestas.
 *
 * Heurística do baricentro: cada nó quer ficar na média das posições dos vizinhos da camada
 * adjacente. Alternar descida e subida algumas vezes converge rápido e é barato - minimizar
 * cruzamentos de verdade é NP-difícil e não valeria o custo numa tela de celular.
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
            : node.order
        );
      }

      layer.sort((a, b) => (barycenters.get(a)! - barycenters.get(b)!) || (a.order - b.order));
      layer.forEach((node, index) => { node.order = index; });
    }
  }
}

/**
 * Converte a ordem dentro da camada em coordenadas x.
 *
 * Só distribuir em colunas fixas já evitaria sobreposição, mas deixaria correntes lineares em
 * ziguezague. As passadas de alinhamento puxam cada nó para a média dos vizinhos e depois
 * reimpõem o espaçamento mínimo - as cenas em sequência acabam alinhadas em coluna, que é o
 * que faz o mapa parecer desenhado à mão em vez de gerado.
 */
function assignHorizontalPositions(layers: WorkNode[][]): void {
  for (const layer of layers) {
    layer.forEach((node, index) => { node.x = index * COLUMN_STEP; });
  }

  for (let pass = 0; pass < 4; pass += 1) {
    const goingDown = pass % 2 === 0;

    for (const layerIndex of sweepOrder(layers.length, goingDown)) {
      const layer = layers[layerIndex];
      const adjacentLayer = layerIndex + (goingDown ? -1 : 1);
      if (adjacentLayer < 0 || adjacentLayer >= layers.length) continue;

      const desired = layer.map(node => {
        const neighbours = neighboursInLayer(node, goingDown, adjacentLayer);
        if (neighbours.length === 0) return node.x;
        return neighbours.reduce((sum, neighbour) => sum + neighbour.x, 0) / neighbours.length;
      });

      applyWithMinimumSpacing(layer, desired);
    }
  }

  const allNodes = layers.flat();
  const minX = Math.min(...allNodes.map(node => node.x));
  for (const node of allNodes) node.x -= minX;
}

function sweepOrder(length: number, goingDown: boolean): number[] {
  const indices = Array.from({ length }, (_, index) => index);
  return goingDown ? indices : indices.reverse();
}

/** Vizinhos de `node` que estão exatamente na camada `layerIndex`, ignorando ciclos. */
function neighboursInLayer(node: WorkNode, incoming: boolean, layerIndex: number): WorkNode[] {
  return (incoming ? node.incoming : node.outgoing)
    .filter(edge => !edge.closesCycle)
    .map(edge => (incoming ? edge.source : edge.target))
    .filter(neighbour => neighbour.layer === layerIndex);
}

/**
 * Aproxima os nós das posições desejadas sem quebrar a ordem nem o espaçamento mínimo.
 *
 * A varredura só empurra para a direita, então a camada inteira sairia deslocada em relação
 * ao que os vizinhos pediam; devolver o bloco pela diferença das médias preserva todos os
 * espaçamentos e mantém a camada centrada onde ela deveria estar.
 */
function applyWithMinimumSpacing(layer: WorkNode[], desired: number[]): void {
  if (layer.length === 0) return;

  const positions = [...desired];
  for (let index = 1; index < positions.length; index += 1) {
    positions[index] = Math.max(positions[index], positions[index - 1] + COLUMN_STEP);
  }

  const drift = average(positions) - average(desired);
  layer.forEach((node, index) => { node.x = positions[index] - drift; });
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Grade para as cenas que nenhuma escolha alcança, abaixo do fluxo.
 *
 * O número de colunas acompanha a largura do resto do mapa para a grade não ficar mais larga
 * que a história - com uma história vazia de escolhas, cai em três colunas.
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

/** Curvas de cada aresta, ainda em coordenadas locais. */
function placeEdges(edges: WorkEdge[], nodesById: Map<string, GraphNode>): PlacedEdge[] {
  // Arestas paralelas (duas escolhas diferentes entre as mesmas cenas) receberiam a mesma
  // curva e ficariam indistinguíveis; a posição no grupo desloca cada uma para o lado.
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
        curve: buildCurve(source, target, kind, spread, loopSide),
      });
    });
  }

  return placed;
}

/**
 * Lado em que o laço de uma cena cabe: direita (1) ou esquerda (-1).
 *
 * Sem esta checagem o laço é desenhado sempre à direita e passa por dentro da cena vizinha,
 * já que o vão entre colunas é menor que a barriga da curva.
 */
function pickLoopSide(node: GraphNode, allNodes: GraphNode[]): 1 | -1 {
  const needed = SELF_LOOP_BULGE + 10;
  const sameLayer = allNodes.filter(other => other.id !== node.id && other.layer === node.layer);

  const blockedOnRight = sameLayer.some(other => other.x > node.x && other.x - (node.x + node.width) < needed);
  if (!blockedOnRight) return 1;

  const blockedOnLeft = sameLayer.some(other => other.x < node.x && node.x - (other.x + other.width) < needed);
  return blockedOnLeft ? 1 : -1;
}

/**
 * Espalha os rótulos ao longo das curvas que chegam na mesma cena.
 *
 * Várias escolhas convergindo para uma cena têm curvas quase juntas no meio, e os textos
 * ficariam empilhados. Variar o ponto de ancoragem separa-os na vertical sem mudar o desenho.
 */
function spreadLabelAnchors(placed: PlacedEdge[]): Map<PlacedEdge, number> {
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
  loopSide: 1 | -1
): Cubic {
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
    // Laço no flanco livre: a cena aponta para si mesma ("tentar de novo").
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
    // Mesma camada: sai por um flanco e entra pelo outro, curvando por baixo dos dois nós.
    const goingRight = target.x >= source.x;
    const start = { x: goingRight ? source.x + source.width : source.x, y: source.y + source.height * 0.7 };
    const end = { x: goingRight ? target.x : target.x + target.width, y: target.y + target.height * 0.7 };
    const dip = source.height * 0.7 + 26 + Math.abs(spread);
    return {
      start,
      control1: { x: start.x + (goingRight ? 40 : -40), y: start.y + dip },
      control2: { x: end.x + (goingRight ? -40 : 40), y: end.y + dip },
      end,
    };
  }

  // Volta para trás: contorna por fora, do topo da origem até a base do destino. O lado vem
  // da posição relativa para a curva não atravessar as cenas do meio.
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

/**
 * Desloca tudo para que nada fique fora da margem e devolve o tamanho final do desenho.
 *
 * Os pontos de controle das curvas entram na conta: uma curva de Bézier nunca sai do casco
 * dos seus pontos de controle, então incluí-los é uma folga segura e barata - garante que a
 * volta desenhada para fora do mapa não seja cortada na exportação.
 */
function normalizeToPadding(nodes: GraphNode[], edges: PlacedEdge[]): { width: number; height: number } {
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
    for (const point of [edge.curve.start, edge.curve.control1, edge.curve.control2, edge.curve.end]) {
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
    for (const point of [edge.curve.start, edge.curve.control1, edge.curve.control2, edge.curve.end]) {
      point.x += shiftX;
      point.y += shiftY;
    }
  }

  return {
    width: round(maxX - minX + GRAPH_PADDING * 2),
    height: round(maxY - minY + GRAPH_PADDING * 2),
  };
}

function serializeEdge(placed: PlacedEdge, labelAnchor: number): GraphEdge {
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

/** Triângulo da ponta, alinhado com a tangente da curva no ponto de chegada. */
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
