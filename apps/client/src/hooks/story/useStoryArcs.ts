import { useEffect, useMemo } from 'react';
import { useDrizzle } from '@/src/db';
import type { StoryArcSelect } from '@/src/db/schema';
import { createStoryArcService } from '@/src/services/storymanagement/scenes-chapters/StoryArcService';
import { useStoryStore } from '@/src/state/story/storyStore';
import { useTheme } from '@/src/theme';
import { useLoadedResource } from '@/src/hooks/lists/useLoadedResource';
import { resolveEffectiveTheme } from '@/src/utils/search/storyArcFilter';

const NO_ARCS: StoryArcSelect[] = [];
const ARC_EVENTS = ['story_arc_changed'] as const;

/** Loads the story's Arcs and keeps the active-Arc selection and effective theme in sync. */
export function useStoryArcs() {
  const db = useDrizzle();
  const story = useStoryStore((state) => state.selectedStory);
  const activeArcId = useStoryStore((state) => state.activeArcId);
  const setActiveArcId = useStoryStore((state) => state.setActiveArcId);
  const setEffectiveArc = useStoryStore((state) => state.setEffectiveArc);
  const { setTheme } = useTheme();
  const storyId = story?.id;
  const arcService = useMemo(() => createStoryArcService(db), [db]);
  const load = useMemo(
    () => (storyId ? () => arcService.getArcsForStory(storyId) : null),
    [arcService, storyId],
  );
  const {
    data: arcs,
    loading,
    failed,
    reload,
  } = useLoadedResource({
    load,
    initial: NO_ARCS,
    events: ARC_EVENTS,
    storyId,
    label: 'story arcs',
  });
  // Loading is not the same as empty (and neither is a failed read): every mount starts with no
  // arcs, and only the user (or a genuinely deleted arc) may clear the selection - never the load.
  const loaded = !loading && !failed;

  useEffect(() => {
    if (loaded && activeArcId && !arcs.some((arc) => arc.id === activeArcId)) {
      setActiveArcId(null);
    }
  }, [loaded, activeArcId, arcs, setActiveArcId]);

  const activeArc = useMemo(
    () => arcs.find((arc) => arc.id === activeArcId) ?? null,
    [activeArcId, arcs],
  );

  // One Arc in the story is the only work there is, so its medium applies in the every-Arc view too.
  const effectiveArc = activeArc ?? (arcs.length === 1 ? arcs[0] : null);
  const effectiveId = effectiveArc?.id ?? null;
  const effectiveMedium = effectiveArc?.medium ?? null;
  const effectiveVocabulary = effectiveArc?.vocabulary ?? null;
  const effectiveAuthor = effectiveArc?.author ?? null;
  useEffect(() => {
    if (!effectiveId || !effectiveMedium) {
      setEffectiveArc(null);
      return;
    }
    setEffectiveArc({
      id: effectiveId,
      medium: effectiveMedium,
      vocabulary: effectiveVocabulary,
      author: effectiveAuthor,
    });
  }, [effectiveAuthor, effectiveId, effectiveMedium, effectiveVocabulary, setEffectiveArc]);

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
