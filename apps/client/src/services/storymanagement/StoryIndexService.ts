import { inspectContiguousOneBasedIndexes, type ChapterType } from '@keres/shared';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import type { ChapterSelect, SceneSelect } from '../../db/schema';
import { chapters, scenes } from '../../db/schema';

/**
 * The numbering of chapters and scenes: chapters 1..N in the story, scenes 1..M within the chapter,
 * with no holes and no repeats.
 *
 * Numbers derive from ranks on every write (see rules/rank.ts), so a crooked numbering can only come
 * from a stray write of a number itself; this finds one and re-derives it.
 */

export type StoryIndexProblemKind = 'gap' | 'duplicate' | 'start';

export interface StoryIndexProblem {
  scope: 'chapters' | 'scenes';
  kind: StoryIndexProblemKind;
  /** Events and chapters have independent 1..N sequences. */
  chapterType?: ChapterType;
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

/** `null` when the list is already 1..N; otherwise, the first problem found. */
export function inspectIndexSequence(indexes: number[]): StoryIndexProblemKind | null {
  return inspectContiguousOneBasedIndexes(indexes);
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

      for (const chapterType of ['chapter', 'event'] as const) {
        const rows = storyChapters.filter((chapter) => (chapter.type ?? 'chapter') === chapterType);
        const chapterProblem = inspectIndexSequence(rows.map((chapter) => chapter.index));
        if (chapterProblem) {
          problems.push({
            scope: 'chapters',
            kind: chapterProblem,
            ...(chapterType === 'event' ? { chapterType } : {}),
          });
        }
      }

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

    async normalizeIndexes(_currentUserId: string, storyId: string) {
      const before = await Promise.all([livingChapters(storyId), livingScenes(storyId)]);
      // Numbers derive from ranks (the local rank triggers), and a rank edit of any row of a
      // container renumbers it. Touching each container's first row with its own rank re-derives
      // every number a stray write may have bent - locally only: numbers are never synchronized, so
      // there is nothing to record or send.
      const touch = (table: typeof chapters | typeof scenes, id: string) =>
        db
          .update(table)
          .set({ rank: sql`${table.rank}` })
          .where(eq(table.id, id))
          .run();
      const firstOf = new Map<string, string>();
      for (const chapter of before[0]) firstOf.set(`chapter:${chapter.type}`, chapter.id);
      for (const id of firstOf.values()) touch(chapters, id);
      const firstScene = new Map<string, string>();
      for (const scene of before[1]) firstScene.set(`${scene.chapterId}`, scene.id);
      for (const id of firstScene.values()) touch(scenes, id);

      const [afterChapters, afterScenes] = await Promise.all([
        livingChapters(storyId),
        livingScenes(storyId),
      ]);
      const moved = <T extends { id: string; index: number }>(was: T[], now: T[]) => {
        const previous = new Map(was.map((row) => [row.id, row.index]));
        return now.filter((row) => previous.get(row.id) !== row.index).length;
      };
      return {
        chapters: moved(before[0], afterChapters),
        scenes: moved(before[1], afterScenes),
      };
    },
  };
};
