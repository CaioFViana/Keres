import { and, asc, eq } from 'drizzle-orm';
import { AppDrizzleClient } from '../../db';
import { chapters, ChapterSelect, choices, scenes, SceneSelect } from '../../db/schema';

/**
 * Validação e apoio para conversão de tipo de história (Linear <-> Branching).
 *
 * Ordenação linear é por capítulo (`Scene.index` dentro de `chapterId`) - não existe (nem
 * nunca existiu) navegação entre capítulos numa história linear. A única exceção é a aresta
 * que liga o fim de um capítulo ao início do próximo: ela é o que define a sequência dos
 * capítulos, então é a única aresta cruzando capítulos que uma conversão Branching -> Linear
 * aceita sem rejeitar.
 */

export interface Edge {
  sceneId: string;
  nextSceneId: string;
}

export type LinearIncompatibilityKind = 'cross_chapter' | 'bifurcation' | 'convergence' | 'cycle' | 'orphan';

export interface LinearIncompatibilityReason {
  chapterId: string;
  chapterName: string;
  kind: LinearIncompatibilityKind;
}

export type LinearCompatibilityResult =
  | { compatible: true }
  | { compatible: false; reasons: LinearIncompatibilityReason[] };

export interface ChapterWithScenes {
  chapter: ChapterSelect;
  scenes: SceneSelect[];
}

export async function loadStoryGraph(db: AppDrizzleClient, storyId: string): Promise<{
  storyChapters: ChapterSelect[];
  storyScenes: SceneSelect[];
  storyChoices: Edge[];
}> {
  const [storyChapters, storyScenes, storyChoices] = await Promise.all([
    db.select().from(chapters).where(and(eq(chapters.storyId, storyId), eq(chapters.isDeleted, false))).orderBy(asc(chapters.index)).all(),
    db.select().from(scenes).where(and(eq(scenes.storyId, storyId), eq(scenes.isDeleted, false))).orderBy(asc(scenes.index)).all(),
    db.select({ sceneId: choices.sceneId, nextSceneId: choices.nextSceneId }).from(choices).where(and(eq(choices.storyId, storyId), eq(choices.isDeleted, false))).all(),
  ]);
  return { storyChapters, storyScenes, storyChoices };
}

/** Capítulos com pelo menos uma cena, na ordem de `chapters.index`, cada um com suas cenas na ordem de `scenes.index`. */
export function groupScenesByChapter(chaptersOrdered: ChapterSelect[], allScenes: SceneSelect[]): ChapterWithScenes[] {
  const scenesByChapter = new Map<string, SceneSelect[]>();
  for (const scene of allScenes) {
    const list = scenesByChapter.get(scene.chapterId) ?? [];
    list.push(scene);
    scenesByChapter.set(scene.chapterId, list);
  }
  for (const list of scenesByChapter.values()) {
    list.sort((a, b) => a.index - b.index);
  }
  return chaptersOrdered
    .map((chapter) => ({ chapter, scenes: scenesByChapter.get(chapter.id) ?? [] }))
    .filter((entry) => entry.scenes.length > 0);
}

/**
 * Separa as escolhas da história em arestas intra-capítulo (por capítulo) e capítulos-fonte
 * de escolhas cruzando capítulos que NÃO batem com o padrão legítimo (última cena do
 * capítulo M -> primeira cena do próximo capítulo não-vazio M+1).
 */
export function classifyEdges(
  nonEmptyChapters: ChapterWithScenes[],
  storyChoices: Edge[]
): { intraEdgesByChapter: Map<string, Edge[]>; illegitimateCrossChapterSourceChapters: Set<string> } {
  const chapterIdByScene = new Map<string, string>();
  for (const { chapter, scenes: chapterScenes } of nonEmptyChapters) {
    for (const scene of chapterScenes) {
      chapterIdByScene.set(scene.id, chapter.id);
    }
  }
  const chapterSequenceIndex = new Map(nonEmptyChapters.map((entry, i) => [entry.chapter.id, i]));
  const chapterEntryById = new Map(nonEmptyChapters.map((entry) => [entry.chapter.id, entry]));

  const intraEdgesByChapter = new Map<string, Edge[]>();
  const illegitimateCrossChapterSourceChapters = new Set<string>();

  for (const edge of storyChoices) {
    const sourceChapterId = chapterIdByScene.get(edge.sceneId);
    const targetChapterId = chapterIdByScene.get(edge.nextSceneId);
    if (!sourceChapterId || !targetChapterId) {
      continue; // Escolha apontando para uma cena que não existe (mais) - fora do escopo desta checagem.
    }

    if (sourceChapterId === targetChapterId) {
      const list = intraEdgesByChapter.get(sourceChapterId) ?? [];
      list.push(edge);
      intraEdgesByChapter.set(sourceChapterId, list);
      continue;
    }

    const sourceEntry = chapterEntryById.get(sourceChapterId);
    const targetEntry = chapterEntryById.get(targetChapterId);
    const sourceSeq = chapterSequenceIndex.get(sourceChapterId);
    const targetSeq = chapterSequenceIndex.get(targetChapterId);

    const isLastSceneOfSource = !!sourceEntry && sourceEntry.scenes[sourceEntry.scenes.length - 1].id === edge.sceneId;
    const isFirstSceneOfTarget = !!targetEntry && targetEntry.scenes[0].id === edge.nextSceneId;
    const isConsecutiveChapters = sourceSeq !== undefined && targetSeq !== undefined && targetSeq === sourceSeq + 1;

    if (!(isLastSceneOfSource && isFirstSceneOfTarget && isConsecutiveChapters)) {
      illegitimateCrossChapterSourceChapters.add(sourceChapterId);
    }
  }

  return { intraEdgesByChapter, illegitimateCrossChapterSourceChapters };
}

export async function checkLinearCompatibility(db: AppDrizzleClient, storyId: string): Promise<LinearCompatibilityResult> {
  const { storyChapters, storyScenes, storyChoices } = await loadStoryGraph(db, storyId);
  const nonEmptyChapters = groupScenesByChapter(storyChapters, storyScenes);
  const { intraEdgesByChapter, illegitimateCrossChapterSourceChapters } = classifyEdges(nonEmptyChapters, storyChoices);

  const reasons: LinearIncompatibilityReason[] = [];
  const addReason = (chapterId: string, chapterName: string, kind: LinearIncompatibilityKind) => {
    if (!reasons.some((r) => r.chapterId === chapterId && r.kind === kind)) {
      reasons.push({ chapterId, chapterName, kind });
    }
  };

  for (const { chapter, scenes: chapterScenes } of nonEmptyChapters) {
    if (illegitimateCrossChapterSourceChapters.has(chapter.id)) {
      addReason(chapter.id, chapter.name, 'cross_chapter');
    }

    const intraEdges = intraEdgesByChapter.get(chapter.id) ?? [];
    const outDegree = new Map<string, number>(chapterScenes.map((s) => [s.id, 0]));
    const inDegree = new Map<string, number>(chapterScenes.map((s) => [s.id, 0]));
    for (const edge of intraEdges) {
      outDegree.set(edge.sceneId, (outDegree.get(edge.sceneId) ?? 0) + 1);
      inDegree.set(edge.nextSceneId, (inDegree.get(edge.nextSceneId) ?? 0) + 1);
    }

    let structuralViolation = false;
    if ([...outDegree.values()].some((d) => d > 1)) {
      addReason(chapter.id, chapter.name, 'bifurcation');
      structuralViolation = true;
    }
    if ([...inDegree.values()].some((d) => d > 1)) {
      addReason(chapter.id, chapter.name, 'convergence');
      structuralViolation = true;
    }

    if (chapterScenes.length > 1) {
      // Componentes conexos (não-direcionado), só com as arestas intra-capítulo.
      const parent = new Map<string, string>(chapterScenes.map((s) => [s.id, s.id]));
      const find = (id: string): string => {
        let root = id;
        while (parent.get(root) !== root) root = parent.get(root)!;
        return root;
      };
      for (const edge of intraEdges) {
        const a = find(edge.sceneId);
        const b = find(edge.nextSceneId);
        if (a !== b) parent.set(a, b);
      }
      const componentCount = new Set(chapterScenes.map((s) => find(s.id))).size;
      if (componentCount > 1) {
        addReason(chapter.id, chapter.name, 'orphan');
        structuralViolation = true;
      }
    }

    // Com grau <=1 nos dois sentidos e um único componente conexo (checagens acima), a única
    // forma de nenhuma cena do capítulo ter inDegree 0 é ele formar um ciclo - não sobra
    // nenhuma cena candidata a "primeira" da cadeia.
    if (!structuralViolation && chapterScenes.length > 0) {
      const hasChainStart = chapterScenes.some((s) => (inDegree.get(s.id) ?? 0) === 0);
      if (!hasChainStart) {
        addReason(chapter.id, chapter.name, 'cycle');
      }
    }
  }

  return reasons.length > 0 ? { compatible: false, reasons } : { compatible: true };
}

/**
 * Ordem da cadeia de um capítulo (só chamar depois de `checkLinearCompatibility` confirmar
 * compatibilidade - assume grau <=1 nos dois sentidos e um único componente conexo).
 */
export function computeChapterChainOrder(chapterScenes: SceneSelect[], intraEdges: Edge[]): string[] {
  if (chapterScenes.length === 0) return [];

  const nextByScene = new Map(intraEdges.map((e) => [e.sceneId, e.nextSceneId]));
  const inDegree = new Map<string, number>(chapterScenes.map((s) => [s.id, 0]));
  for (const edge of intraEdges) {
    inDegree.set(edge.nextSceneId, (inDegree.get(edge.nextSceneId) ?? 0) + 1);
  }

  const start = chapterScenes.find((s) => (inDegree.get(s.id) ?? 0) === 0);
  if (!start) {
    throw new Error('Chapter has no valid chain start - checkLinearCompatibility should have rejected this conversion.');
  }

  const order: string[] = [];
  const visited = new Set<string>();
  let current: string | undefined = start.id;
  while (current && !visited.has(current)) {
    visited.add(current);
    order.push(current);
    current = nextByScene.get(current);
  }
  return order;
}
