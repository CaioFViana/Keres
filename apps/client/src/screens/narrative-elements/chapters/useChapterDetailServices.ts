import { useMemo } from 'react';
import { useDrizzle } from '@/src/db';
import { createLocationService } from '@/src/services/storymanagement/entities/LocationService';
import { createChapterService } from '@/src/services/storymanagement/scenes-chapters/ChapterService';
import { createSceneService } from '@/src/services/storymanagement/scenes-chapters/SceneService';

/** The services the chapter detail talks to: the record, the story's spine, its scenes and places. */
export function useChapterDetailServices() {
  const drizzleDb = useDrizzle();
  return useMemo(
    () => ({
      chapterService: createChapterService(drizzleDb),
      sceneService: createSceneService(drizzleDb),
      locationService: createLocationService(drizzleDb),
    }),
    [drizzleDb],
  );
}
