import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDrizzle } from '../db';
import type { ChapterSelect, PlotSceneSelect, PlotSelect, SceneSelect } from '../db/schema';
import { createChapterService } from '../services/storymanagement/ChapterService';
import { createPlotSceneService } from '../services/storymanagement/PlotSceneService';
import { createPlotService } from '../services/storymanagement/PlotService';
import { createSceneService } from '../services/storymanagement/SceneService';
import { entityEventEmitter } from '../utils/EventEmitter';
import { sortScenesNarratively } from '../utils/narrativeSceneOrder';

/**
 * Tudo que uma tela de Plot precisa, numa consulta só e atualizada por evento - o mesmo
 * arranjo de `useStoryStats`.
 *
 * Lista, detalhe, matriz, cobertura e leitor leem os mesmos quatro conjuntos e dependem de
 * concordarem sobre a ordem narrativa; buscar cada um por conta própria multiplicava as
 * consultas e deixava cada tela ordenar as cenas do seu jeito.
 */
export interface StoryPlotsData {
  plots: PlotSelect[];
  relations: PlotSceneSelect[];
  /** Cenas ativas da história, já em ordem narrativa (capítulo, depois cena). */
  scenes: SceneSelect[];
  chapters: ChapterSelect[];
  /** Relações de um Plot, na mesma ordem narrativa das cenas. */
  relationsOf: (plotId: string) => PlotSceneSelect[];
  sceneById: (sceneId: string) => SceneSelect | undefined;
  plotById: (plotId: string) => PlotSelect | undefined;
  /** Cenas cobertas / cenas ativas da história, com o percentual arredondado. */
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

  useEffect(() => {
    reload();
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
    // Relações apontando para uma cena removida não entram: o Plot passaria a "cobrir" uma
    // cena que não existe mais, e o leitor tentaria abrir um detalhe vazio.
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
