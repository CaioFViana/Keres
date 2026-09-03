import type { CalendarDefinitionType } from '@keres/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDrizzle } from '@/src/db';
import type { ChapterAnchorSelect, ChapterSelect, SceneSelect } from '@/src/db/schema';
import { createChapterAnchorService } from '@/src/services/storymanagement/ChapterAnchorService';
import { createChapterService } from '@/src/services/storymanagement/ChapterService';
import { createSceneService } from '@/src/services/storymanagement/SceneService';
import { useStoryStore } from '@/src/state/storyStore';
import { buildCalendarAnchorPreview } from '@/src/utils/calendarAnchorPreview';

/** Loads the small, timeline-relevant data set once and lets definitions be compared purely. */
export function useCalendarAnchorPreview(definition: CalendarDefinitionType, enabled: boolean) {
  const db = useDrizzle();
  const story = useStoryStore((state) => state.selectedStory);
  const [chapters, setChapters] = useState<ChapterSelect[]>([]);
  const [scenes, setScenes] = useState<SceneSelect[]>([]);
  const [anchors, setAnchors] = useState<ChapterAnchorSelect[]>([]);
  const [loading, setLoading] = useState(false);
  const reload = useCallback(async () => {
    if (!story || !enabled) return;
    setLoading(true);
    try {
      const [loadedChapters, loadedScenes, loadedAnchors] = await Promise.all([
        createChapterService(db).getAllByStoryId(story.id),
        createSceneService(db).getAllByStoryId(story.id),
        createChapterAnchorService(db).getAnchorsForStory(story.id),
      ]);
      setChapters(loadedChapters);
      setScenes(loadedScenes);
      setAnchors(loadedAnchors);
    } finally {
      setLoading(false);
    }
  }, [db, enabled, story]);
  useEffect(() => {
    void reload();
  }, [reload]);
  const rows = useMemo(
    () =>
      story ? buildCalendarAnchorPreview({ story, chapters, scenes, anchors, definition }) : [],
    [anchors, chapters, definition, scenes, story],
  );
  return { rows, loading };
}
