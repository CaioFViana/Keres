import { useEffect, useRef } from 'react';
import { useDrizzle } from '../../../db';
import {
  createChapterService,
  type ChapterService,
} from '../../../services/storymanagement/ChapterService';

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
