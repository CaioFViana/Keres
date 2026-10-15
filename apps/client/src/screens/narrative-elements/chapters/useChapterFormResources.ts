import { useEffect, useRef } from 'react';
import { useDrizzle } from '@/src/db';
import {
  createChapterService,
  type ChapterService,
} from '@/src/services/storymanagement/scenes-chapters/ChapterService';

/** Owns the chapter service used by the form. */
export function useChapterFormResources() {
  const drizzleDb = useDrizzle();
  const chapterServiceRef = useRef<ChapterService | null>(null);

  useEffect(() => {
    chapterServiceRef.current ??= createChapterService(drizzleDb);
  }, [drizzleDb]);

  return {
    drizzleDb,
    chapterServiceRef,
  };
}
