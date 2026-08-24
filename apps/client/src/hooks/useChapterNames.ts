import { useCallback, useEffect, useState } from 'react';
import { useDrizzle } from '../db';
import type { SceneSelect } from '../db/schema';
import { createChapterService } from '../services/storymanagement/ChapterService';
import { entityEventEmitter } from '../utils/EventEmitter';

/**
 * O nome do capítulo de uma cena, para as listas que mostram cenas fora do capítulo delas.
 *
 * "Cena 3" no meio das cenas de um personagem, de um local ou de uma trama não diz de onde a
 * cena veio; o capítulo é o que situa. A história sai das próprias cenas em vez de virar mais
 * uma prop atravessando cada tela: todas essas listas mostram cenas de uma história só.
 */
export function useChapterNames(scenes: Pick<SceneSelect, 'storyId'>[]): (
  chapterId: string,
) => string | undefined {
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

  useEffect(() => {
    reload();
    entityEventEmitter.on('chapter_changed', reload);
    return () => entityEventEmitter.off('chapter_changed', reload);
  }, [reload]);

  return useCallback((chapterId: string) => names.get(chapterId), [names]);
}
