import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDrizzle } from '@/src/db';
import type { StoryArcSelect } from '@/src/db/schema';
import { createStoryArcService } from '@/src/services/storymanagement/StoryArcService';
import { useStoryStore } from '@/src/state/storyStore';
import { useTheme } from '@/src/theme';
import { entityEventEmitter } from '@/src/utils/EventEmitter';
import { resolveEffectiveTheme } from '@/src/utils/storyArcFilter';

/** Loads the story's Arcs and keeps the active-Arc selection and effective theme in sync. */
export function useStoryArcs() {
  const db = useDrizzle();
  const story = useStoryStore((state) => state.selectedStory);
  const activeArcId = useStoryStore((state) => state.activeArcId);
  const setActiveArcId = useStoryStore((state) => state.setActiveArcId);
  const { setTheme } = useTheme();
  const [arcs, setArcs] = useState<StoryArcSelect[]>([]);

  const reload = useCallback(async () => {
    if (!story?.id) {
      setArcs([]);
      return;
    }
    setArcs(await createStoryArcService(db).getArcsForStory(story.id));
  }, [db, story?.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const handler = (storyId: string) => {
      if (storyId === story?.id) void reload();
    };
    entityEventEmitter.on('story_arc_changed', handler);
    return () => {
      entityEventEmitter.off('story_arc_changed', handler);
    };
  }, [reload, story?.id]);

  useEffect(() => {
    if (activeArcId && !arcs.some((arc) => arc.id === activeArcId)) {
      setActiveArcId(null);
    }
  }, [activeArcId, arcs, setActiveArcId]);

  const activeArc = useMemo(
    () => arcs.find((arc) => arc.id === activeArcId) ?? null,
    [activeArcId, arcs],
  );

  useEffect(() => {
    setTheme(resolveEffectiveTheme(story?.theme, activeArc?.themeOverride));
  }, [activeArc?.themeOverride, setTheme, story?.theme]);

  return {
    arcs,
    activeArc,
    activeArcId,
    setActiveArcId,
    showSelector: arcs.length > 1,
    reload,
  };
}
