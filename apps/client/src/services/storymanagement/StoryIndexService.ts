import { and, asc, eq } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import type { ChapterSelect, SceneSelect } from '../../db/schema';
import { chapters, scenes } from '../../db/schema';
import { createChapterService } from './ChapterService';
import { createSceneService } from './SceneService';

/**
 * The numbering of chapters and scenes: chapters 1..N in the story, scenes 1..M within the chapter,
 * with no holes and no repeats.
 *
 * The convention is not aesthetic: the API refuses a reorder whose indices do not form a contiguous
 * 1..N, so a crooked local numbering becomes a synchronization conflict the first time the person drags
 * a scene. Old deletions, imports and stories born before the convention leave exactly that crooked
 * numbering behind.
 */

export type StoryIndexProblemKind = 'gap' | 'duplicate' | 'start';

export interface StoryIndexProblem {
  scope: 'chapters' | 'scenes';
  kind: StoryIndexProblemKind;
  /** The affected chapter; absent when the problem is in the chapters' own numbering. */
  chapterId?: string;
  chapterName?: string;
}

export interface StoryIndexService {
  /** What is out of convention, without touching anything. */
  findIndexProblems(storyId: string): Promise<StoryIndexProblem[]>;
  /**
   * Renumbers whatever is crooked, preserving the current order. It returns how many chapters and how
   * many scenes changed number.
   */
  normalizeIndexes(
    currentUserId: string,
    storyId: string,
  ): Promise<{ chapters: number; scenes: number }>;
}

/** The current order, with stable tie-breaks for two records currently fighting over the same number. */
const byCurrentOrder = <T extends { index: number; createdAt: Date; id: string }>(a: T, b: T) =>
  a.index - b.index || a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id);

/** `null` when the list is already 1..N; otherwise, the first problem found. */
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

      // It reuses the existing reorder paths instead of writing index by index: they record the `reorder`
      // operation the server understands, so normalising also pushes the correct order over there - which is
      // how an already-divergent story heals.
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
