import { buildStoryGraphLayout, GraphChapter, GraphChoice, GraphScene } from './storyGraphLayout';

/**
 * Ordena Item Journeys pela posição narrativa da cena de cada uma, não por `createdAt` (que é
 * só o instante em que o registro foi inserido, sem relação com a ordem da história).
 *
 * - Linear: `(chapter.index, scene.index)` - a mesma dupla que o resto do app já trata como
 *   ordem canônica (ver `compareByStoryOrder` em `storyGraphLayout.ts`).
 * - Branching: a `layer` que `buildStoryGraphLayout` já calcula pra a tela do Mapa da História
 *   (distância em camadas até o começo, maior caminho - não BFS/menor caminho, de propósito:
 *   isso garante que uma cena nunca apareça antes de um pré-requisito dela quando dois
 *   caminhos convergem, o que menor-caminho não garante). Zero mudança em `storyGraphLayout.ts`
 *   além de consumir o que ele já expõe publicamente.
 *
 * `createdAt` só entra como desempate final (mesma cena, ou mesma camada).
 */

interface OrderableItemJourney {
  sceneId: string;
  createdAt: Date;
}

export function orderItemJourneysByNarrative<T extends OrderableItemJourney>(
  journeys: T[],
  storyType: 'linear' | 'branching',
  scenes: GraphScene[],
  choices: GraphChoice[],
  chapters: GraphChapter[],
): T[] {
  const sceneById = new Map(scenes.map((scene) => [scene.id, scene]));
  const chapterIndexById = new Map(chapters.map((chapter) => [chapter.id, chapter.index]));

  const layerBySceneId = new Map<string, number>();
  if (storyType === 'branching') {
    const layout = buildStoryGraphLayout(scenes, choices, chapters);
    for (const node of layout.nodes) {
      layerBySceneId.set(node.id, node.layer);
    }
  }

  const orderKey = (journey: T): [number, number, number, number] => {
    const scene = sceneById.get(journey.sceneId);
    const chapterIndex = scene
      ? (chapterIndexById.get(scene.chapterId) ?? Number.MAX_SAFE_INTEGER)
      : Number.MAX_SAFE_INTEGER;
    const sceneIndex = scene?.index ?? Number.MAX_SAFE_INTEGER;
    // Cena desconhecida (referência solta) cai por último, junto do resto do que não resolveu.
    const layer =
      storyType === 'branching'
        ? (layerBySceneId.get(journey.sceneId) ?? Number.MAX_SAFE_INTEGER)
        : 0;
    return [layer, chapterIndex, sceneIndex, journey.createdAt.getTime()];
  };

  return [...journeys].sort((a, b) => {
    const keyA = orderKey(a);
    const keyB = orderKey(b);
    for (let i = 0; i < keyA.length; i++) {
      if (keyA[i] !== keyB[i]) {
        return keyA[i] - keyB[i];
      }
    }
    return 0;
  });
}
