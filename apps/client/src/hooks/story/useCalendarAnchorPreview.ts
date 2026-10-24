import type { CalendarDefinitionType } from '@keres/shared';
import { useMemo } from 'react';
import { useDrizzle } from '@/src/db';
import type { ChapterAnchorSelect, ChapterSelect, SceneSelect } from '@/src/db/schema';
import { useLoadedResource } from '@/src/hooks/lists/useLoadedResource';
import { createChapterAnchorService } from '@/src/services/storymanagement/scenes-chapters/ChapterAnchorService';
import { createChapterService } from '@/src/services/storymanagement/scenes-chapters/ChapterService';
import { createSceneService } from '@/src/services/storymanagement/scenes-chapters/SceneService';
import { useStoryStore } from '@/src/state/story/storyStore';
import { buildCalendarAnchorPreview } from '@/src/utils/entity/calendarAnchorPreview';

const NOTHING_LOADED: {
  chapters: ChapterSelect[];
  scenes: SceneSelect[];
  anchors: ChapterAnchorSelect[];
} = { chapters: [], scenes: [], anchors: [] };

/** Loads the small, timeline-relevant data set once and lets definitions be compared purely. */
export function useCalendarAnchorPreview(definition: CalendarDefinitionType, enabled: boolean) {
  const db = useDrizzle();
  const story = useStoryStore((state) => state.selectedStory);
  const load = useMemo(
    () =>
      story && enabled
        ? async () => {
            const [chapters, scenes, anchors] = await Promise.all([
              createChapterService(db).getAllByStoryId(story.id),
              createSceneService(db).getAllByStoryId(story.id),
              createChapterAnchorService(db).getAnchorsForStory(story.id),
            ]);
            return { chapters, scenes, anchors };
          }
        : null,
    [db, enabled, story],
  );
  const {
    data: { chapters, scenes, anchors },
    loading,
  } = useLoadedResource({ load, initial: NOTHING_LOADED, label: 'calendar anchor preview data' });
  const rows = useMemo(
    () =>
      story ? buildCalendarAnchorPreview({ story, chapters, scenes, anchors, definition }) : [],
    [anchors, chapters, definition, scenes, story],
  );
  return { rows, loading };
}
