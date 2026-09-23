import type { TFunction } from 'i18next';
import { useCallback, useEffect, useState } from 'react';
import { useDrizzle } from '../db';
import type {
  ChapterSelect,
  ChoiceSelect,
  RouteSelect,
  RouteStepSelect,
  SceneSelect,
} from '../db/schema';
import { createChapterService } from '../services/storymanagement/ChapterService';
import { createChoiceService } from '../services/storymanagement/ChoiceService';
import { createRouteService } from '../services/storymanagement/RouteService';
import { createSceneService } from '../services/storymanagement/SceneService';
import {
  loadChoiceAnnotations as fetchChoiceAnnotations,
  type ChoiceAnnotationLines,
} from '../utils/choiceAnnotations';
import { entityEventEmitter } from '../utils/EventEmitter';
import { useEntityInitialLoad } from './useEntityRefreshLifecycle';

/**
 * The manuscript's read model: every container (chapters AND events), every scene with
 * its body, every choice, and every route with its steps. Lighter than `useStoryRoutes`
 * (no checks or effects - reading prose never validates traversal) and complete where
 * that hook is not (its chapters exclude events). The choices feed the exporter's
 * "go to page X" cross-references, and `loadChoiceAnnotations` (export-time only)
 * resolves their requirement/effect lines from the same snapshot. Refreshes on every
 * change that could move a section, including saves from the inline editor
 * (`scene_changed`).
 */
export function useManuscriptData(storyId: string | undefined | null) {
  const db = useDrizzle();
  const [chapters, setChapters] = useState<ChapterSelect[]>([]);
  const [scenes, setScenes] = useState<SceneSelect[]>([]);
  const [routes, setRoutes] = useState<RouteSelect[]>([]);
  const [choices, setChoices] = useState<ChoiceSelect[]>([]);
  const [stepsByRouteId, setStepsByRouteId] = useState<Map<string, RouteStepSelect[]>>(new Map());
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!storyId) {
      setChapters([]);
      setScenes([]);
      setRoutes([]);
      setChoices([]);
      setStepsByRouteId(new Map());
      setLoading(false);
      return;
    }
    try {
      const routeService = createRouteService(db);
      const [allChapters, allScenes, allRoutes, allChoices] = await Promise.all([
        createChapterService(db).getAllByStoryId(storyId, null),
        createSceneService(db).getAllByStoryId(storyId),
        routeService.getAllByStoryId(storyId),
        createChoiceService(db).getAllByStoryId(storyId),
      ]);
      const allSteps = await Promise.all(
        allRoutes.map(async (route) => [route.id, await routeService.getSteps(route.id)] as const),
      );
      setChapters(allChapters);
      setScenes(allScenes);
      setRoutes(allRoutes);
      setChoices(allChoices);
      setStepsByRouteId(new Map(allSteps));
    } catch (error) {
      console.error('Failed to load manuscript data:', error);
      setChapters([]);
      setScenes([]);
      setRoutes([]);
      setChoices([]);
      setStepsByRouteId(new Map());
    } finally {
      setLoading(false);
    }
  }, [db, storyId]);

  const loadChoiceAnnotations = useCallback(
    async (translate: TFunction): Promise<Map<string, ChoiceAnnotationLines>> => {
      if (!storyId) return new Map();
      return fetchChoiceAnnotations(db, storyId, scenes, translate);
    },
    [db, storyId, scenes],
  );

  useEntityInitialLoad(reload);

  useEffect(() => {
    const events = [
      'scene_changed',
      'chapter_changed',
      'choice_changed',
      'route_changed',
      'route_step_changed',
    ];
    for (const event of events) entityEventEmitter.on(event, reload);
    return () => {
      for (const event of events) entityEventEmitter.off(event, reload);
    };
  }, [reload]);

  return {
    chapters,
    scenes,
    routes,
    choices,
    stepsByRouteId,
    loading,
    reload,
    loadChoiceAnnotations,
  };
}
