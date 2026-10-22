import { useRef } from 'react';
import { useDrizzle } from '@/src/db';
import {
  createChapterService,
  type ChapterService,
} from '@/src/services/storymanagement/scenes-chapters/ChapterService';

/** Owns the chapter service used by the form. */
export function useChapterFormResources() {
  const drizzleDb = useDrizzle();
  const chapterServiceRef = useRef<ChapterService | null>(null);

  // Created in the first render, not after it: no screen can look for a service that is not there yet.
  chapterServiceRef.current ??= createChapterService(drizzleDb);

  return {
    drizzleDb,
    chapterServiceRef,
  };
}
