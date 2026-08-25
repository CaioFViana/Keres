import { and, asc, eq } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import type { ChapterSelect, SceneSelect } from '../../db/schema';
import { chapters, scenes } from '../../db/schema';
import { createChapterService } from './ChapterService';
import { createSceneService } from './SceneService';

/**
 * A numeração de capítulos e cenas: capítulos 1..N na história, cenas 1..M dentro do capítulo,
 * sem buracos e sem repetição.
 *
 * A convenção não é estética: a API recusa uma reordenação cujos índices não formem 1..N
 * contíguo, então uma numeração torta local vira conflito de sincronização na primeira vez que
 * a pessoa arrasta uma cena. Exclusões antigas, importações e histórias que nasceram antes da
 * convenção deixam exatamente essa numeração torta para trás.
 */

export type StoryIndexProblemKind = 'gap' | 'duplicate' | 'start';

export interface StoryIndexProblem {
  scope: 'chapters' | 'scenes';
  kind: StoryIndexProblemKind;
  /** Capítulo afetado; ausente quando o problema é na numeração dos próprios capítulos. */
  chapterId?: string;
  chapterName?: string;
}

export interface StoryIndexService {
  /** O que está fora da convenção, sem tocar em nada. */
  findIndexProblems(storyId: string): Promise<StoryIndexProblem[]>;
  /**
   * Renumera o que estiver torto, preservando a ordem atual. Devolve quantos capítulos e
   * quantas cenas mudaram de número.
   */
  normalizeIndexes(
    currentUserId: string,
    storyId: string,
  ): Promise<{ chapters: number; scenes: number }>;
}

/** Ordem atual, com desempates estáveis para dois registros que hoje disputam o mesmo número. */
const byCurrentOrder = <T extends { index: number; createdAt: Date; id: string }>(a: T, b: T) =>
  a.index - b.index || a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id);

/** `null` quando a lista já é 1..N; caso contrário, o primeiro problema encontrado. */
export function inspectIndexSequence(indexes: number[]): StoryIndexProblemKind | null {
  if (indexes.length === 0) return null;
  const sorted = [...indexes].sort((a, b) => a - b);
  if (new Set(sorted).size !== sorted.length) return 'duplicate';
  if (sorted[0] !== 1) return 'start';
  return sorted.every((value, position) => value === position + 1) ? null : 'gap';
}

export const createStoryIndexService = (db: AppDrizzleClient): StoryIndexService => {
  const livingChapters = async (storyId: string): Promise<ChapterSelect[]> =>
    db
      .select()
      .from(chapters)
      .where(and(eq(chapters.storyId, storyId), eq(chapters.isDeleted, false)))
      .orderBy(asc(chapters.index))
      .all();

  const livingScenes = async (storyId: string): Promise<SceneSelect[]> =>
    db
      .select()
      .from(scenes)
      .where(and(eq(scenes.storyId, storyId), eq(scenes.isDeleted, false)))
      .orderBy(asc(scenes.index))
      .all();

  return {
    async findIndexProblems(storyId: string): Promise<StoryIndexProblem[]> {
      const [storyChapters, storyScenes] = await Promise.all([
        livingChapters(storyId),
        livingScenes(storyId),
      ]);
      const problems: StoryIndexProblem[] = [];

      const chapterProblem = inspectIndexSequence(storyChapters.map((chapter) => chapter.index));
      if (chapterProblem) problems.push({ scope: 'chapters', kind: chapterProblem });

      for (const chapter of storyChapters) {
        const chapterScenes = storyScenes.filter((scene) => scene.chapterId === chapter.id);
        const sceneProblem = inspectIndexSequence(chapterScenes.map((scene) => scene.index));
        if (sceneProblem)
          problems.push({
            scope: 'scenes',
            kind: sceneProblem,
            chapterId: chapter.id,
            chapterName: chapter.name,
          });
      }

      return problems;
    },

    async normalizeIndexes(currentUserId: string, storyId: string) {
      const [storyChapters, storyScenes] = await Promise.all([
        livingChapters(storyId),
        livingScenes(storyId),
      ]);

      // Reaproveita as reordenações já existentes em vez de escrever índice por índice: elas
      // gravam a operação `reorder` que o servidor entende, então normalizar também empurra a
      // ordem correta para lá - que é como uma história já divergente se cura.
      const orderedChapters = [...storyChapters].sort(byCurrentOrder);
      const chapterOrder = orderedChapters.map((chapter, position) => ({
        id: chapter.id,
        newIndex: position + 1,
      }));
      const changedChapters = chapterOrder.filter(
        (entry, position) => orderedChapters[position]!.index !== entry.newIndex,
      ).length;
      if (changedChapters > 0) {
        await createChapterService(db).reorderChapters(currentUserId, storyId, chapterOrder);
      }

      const sceneService = createSceneService(db);
      let changedScenes = 0;
      for (const chapter of orderedChapters) {
        const orderedScenes = storyScenes
          .filter((scene) => scene.chapterId === chapter.id)
          .sort(byCurrentOrder);
        const sceneOrder = orderedScenes.map((scene, position) => ({
          id: scene.id,
          newIndex: position + 1,
        }));
        const changed = sceneOrder.filter(
          (entry, position) => orderedScenes[position]!.index !== entry.newIndex,
        ).length;
        if (changed === 0) continue;
        await sceneService.reorderScenes(currentUserId, storyId, chapter.id, sceneOrder);
        changedScenes += changed;
      }

      return { chapters: changedChapters, scenes: changedScenes };
    },
  };
};
