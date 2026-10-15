import { useEffect, useRef } from 'react';
import { useDrizzle } from '@/src/db';
import { useStoryPlots } from '@/src/screens/plots/useStoryPlots';
import { createPlotService } from '@/src/services/storymanagement/PlotService';
import { createPlotSceneService } from '@/src/services/storymanagement/PlotSceneService';

/** Owns plot services and the story-scoped plot/scene lookup data used by the form. */
export function usePlotFormResources(
  storyId?: string,
  storyType: 'linear' | 'branching' = 'linear',
) {
  const drizzleDb = useDrizzle();
  const plotServiceRef = useRef<ReturnType<typeof createPlotService> | null>(null);
  const plotSceneServiceRef = useRef<ReturnType<typeof createPlotSceneService> | null>(null);
  const {
    scenes,
    relationsOf,
    chapterNameOf,
    reload: reloadPlotData,
  } = useStoryPlots(storyId, storyType);

  useEffect(() => {
    plotServiceRef.current ??= createPlotService(drizzleDb);
    plotSceneServiceRef.current ??= createPlotSceneService(drizzleDb);
  }, [drizzleDb]);

  return {
    drizzleDb,
    plotServiceRef,
    plotSceneServiceRef,
    scenes,
    relationsOf,
    chapterNameOf,
    reloadPlotData,
  };
}
