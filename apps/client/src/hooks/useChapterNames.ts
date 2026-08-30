import { useCallback, useEffect, useState } from 'react';
import { useDrizzle } from '../db';
import type { SceneSelect } from '../db/schema';
import { createChapterService } from '../services/storymanagement/ChapterService';
import { entityEventEmitter } from '../utils/EventEmitter';
import { useEntityInitialLoad } from './useEntityRefreshLifecycle';

/**
 * A scene's chapter name, for the lists that show scenes outside their own chapter.
 *
 * "Scene 3" in the middle of a character's, a location's or a plot's scenes does not say where the
 * scene came from; the chapter is what situates it. The story comes from the scenes themselves rather
 * than becoming yet another prop crossing every screen: all these lists show scenes from a single
 * story.
 */
export function useChapterNames(
  scenes: Pick<SceneSelect, 'storyId'>[],
): (chapterId: string | null | undefined) => string | undefined {
  const drizzleDb = useDrizzle();
  const storyId = scenes[0]?.storyId;
  const [names, setNames] = useState<Map<string, string>>(new Map());

  const reload = useCallback(async () => {
    if (!storyId) {
      setNames(new Map());
      return;
    }
    try {
      const chapters = await createChapterService(drizzleDb).getAllByStoryId(storyId);
      setNames(new Map(chapters.map((chapter) => [chapter.id, chapter.name])));
    } catch (error) {
      console.error('Failed to load chapter names:', error);
      setNames(new Map());
    }
  }, [drizzleDb, storyId]);

  useEntityInitialLoad(reload);

  useEffect(() => {
    entityEventEmitter.on('chapter_changed', reload);
    return () => entityEventEmitter.off('chapter_changed', reload);
  }, [reload]);

  return useCallback(
    (chapterId: string | null | undefined) => (chapterId ? names.get(chapterId) : undefined),
    [names],
  );
}
