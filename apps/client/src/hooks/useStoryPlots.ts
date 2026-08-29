import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDrizzle } from '../db';
import type { ChapterSelect, PlotSceneSelect, PlotSelect, SceneSelect } from '../db/schema';
import { createChapterService } from '../services/storymanagement/ChapterService';
import { createPlotSceneService } from '../services/storymanagement/PlotSceneService';
import { createPlotService } from '../services/storymanagement/PlotService';
import { createSceneService } from '../services/storymanagement/SceneService';
import { entityEventEmitter } from '../utils/EventEmitter';
import { useEntityInitialLoad } from './useEntityRefreshLifecycle';
import { sortScenesNarratively } from '../utils/narrativeSceneOrder';

/**
 * Everything a Plot screen needs, in a single query and refreshed by event - the same
 * arrangement as `useStoryStats`.
 *
 * The list, the detail, the matrix, the coverage and the reader read the same four sets and depend on
 * them agreeing about the narrative order; fetching each one on its own multiplied the
 * queries and left each screen sorting the scenes its own way.
 */
export interface StoryPlotsData {
  plots: PlotSelect[];
  relations: PlotSceneSelect[];
  /** The story's active scenes, already in narrative order (chapter, then scene). */
  scenes: SceneSelect[];
  chapters: ChapterSelect[];
  /** A Plot's relations, in the same narrative order as the scenes. */
  relationsOf: (plotId: string) => PlotSceneSelect[];
  sceneById: (sceneId: string) => SceneSelect | undefined;
  /** A scene's chapter name: it is what situates the scene outside its own chapter's list. */
  chapterNameOf: (chapterId: string | null | undefined) => string | undefined;
  plotById: (plotId: string) => PlotSelect | undefined;
  /** Covered scenes / the story's active scenes, with the percentage rounded. */
  coverageOf: (plotId: string) => { covered: number; total: number; percentage: number };
  loading: boolean;
  reload: () => Promise<void>;
}

const EMPTY: {
  plots: PlotSelect[];
  relations: PlotSceneSelect[];
  scenes: SceneSelect[];
  chapters: ChapterSelect[];
} = { plots: [], relations: [], scenes: [], chapters: [] };

export function useStoryPlots(storyId: string | undefined | null): StoryPlotsData {
  const drizzleDb = useDrizzle();
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!storyId) {
      setData(EMPTY);
      setLoading(false);
      return;
    }
    try {
      const [plots, relations, scenes, chapters] = await Promise.all([
        createPlotService(drizzleDb).getAllByStoryId(storyId),
        createPlotSceneService(drizzleDb).getAllByStoryId(storyId),
        createSceneService(drizzleDb).getAllByStoryId(storyId),
        createChapterService(drizzleDb).getAllByStoryId(storyId),
      ]);
      setData({ plots, relations, scenes: sortScenesNarratively(scenes, chapters), chapters });
    } catch (error) {
      console.error('Failed to load the plots of the story:', error);
      setData(EMPTY);
    } finally {
      setLoading(false);
    }
  }, [drizzleDb, storyId]);

  useEntityInitialLoad(reload);

  useEffect(() => {
    const events = ['plot_changed', 'plot_scene_changed', 'scene_changed', 'chapter_changed'];
    for (const event of events) entityEventEmitter.on(event, reload);
    return () => {
      for (const event of events) entityEventEmitter.off(event, reload);
    };
  }, [reload]);

  return useMemo(() => {
    const sceneIndex = new Map(data.scenes.map((scene, position) => [scene.id, position]));
    const scenesById = new Map(data.scenes.map((scene) => [scene.id, scene]));
    const plotsById = new Map(data.plots.map((plot) => [plot.id, plot]));
    const chapterNames = new Map(data.chapters.map((chapter) => [chapter.id, chapter.name]));
    // Relations pointing at a removed scene do not enter: the Plot would start "covering" a
    // scene that no longer exists, and the reader would try to open an empty detail.
    const relations = data.relations.filter((relation) => scenesById.has(relation.sceneId));
    const byPlot = new Map<string, PlotSceneSelect[]>();
    for (const relation of relations) {
      const current = byPlot.get(relation.plotId);
      if (current) current.push(relation);
      else byPlot.set(relation.plotId, [relation]);
    }
    for (const list of byPlot.values())
      list.sort(
        (a, b) =>
          (sceneIndex.get(a.sceneId) ?? Number.MAX_SAFE_INTEGER) -
          (sceneIndex.get(b.sceneId) ?? Number.MAX_SAFE_INTEGER),
      );
    return {
      ...data,
      relations,
      relationsOf: (plotId: string) => byPlot.get(plotId) ?? [],
      sceneById: (sceneId: string) => scenesById.get(sceneId),
      chapterNameOf: (chapterId: string | null | undefined) =>
        chapterId ? chapterNames.get(chapterId) : undefined,
      plotById: (plotId: string) => plotsById.get(plotId),
      coverageOf: (plotId: string) => {
        const covered = byPlot.get(plotId)?.length ?? 0;
        const total = data.scenes.length;
        return { covered, total, percentage: Math.round((covered / total || 0) * 100) };
      },
      loading,
      reload,
    };
  }, [data, loading, reload]);
}
