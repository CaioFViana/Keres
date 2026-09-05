import { useEffect } from 'react';
import { useDrizzle } from '../db';
import { useChapterStore } from '../state/chapterStore';

/** Wires the chapter store to the current story so a modal can list chapters without touching db. */
export function useBindChapterStore(storyId: string, fetchWhen: boolean) {
  const drizzleDb = useDrizzle();
  const {
    chapters,
    fetchChapters,
    setDbAndStoryId,
    initializeService,
  } = useChapterStore();

  useEffect(() => {
    if (drizzleDb && storyId) {
      setDbAndStoryId(drizzleDb, storyId);
      initializeService();
    }
  }, [drizzleDb, initializeService, setDbAndStoryId, storyId]);

  useEffect(() => {
    if (fetchWhen && storyId) fetchChapters();
  }, [fetchChapters, fetchWhen, storyId]);

  return { chapters };
}
