import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDrizzle } from '../db';
import type { ChapterSelect, ChoiceSelect, RouteSelect, RouteStepSelect, SceneSelect } from '../db/schema';
import { createChapterService } from '../services/storymanagement/ChapterService';
import { createChoiceService } from '../services/storymanagement/ChoiceService';
import { createRouteService } from '../services/storymanagement/RouteService';
import { createSceneService } from '../services/storymanagement/SceneService';
import { entityEventEmitter } from '../utils/EventEmitter';
import { useEntityInitialLoad } from './useEntityRefreshLifecycle';

interface RouteData {
  routes: RouteSelect[];
  scenes: SceneSelect[];
  choices: ChoiceSelect[];
  chapters: ChapterSelect[];
  stepsByRouteId: Map<string, RouteStepSelect[]>;
}

const emptyData = (): RouteData => ({ routes: [], scenes: [], choices: [], chapters: [], stepsByRouteId: new Map() });

/**
 * The single read model for Route authoring and reading.  Steps are refreshed together with their
 * scenes, so a renamed/deleted scene never leaves a stale label in a saved route.
 */
export function useStoryRoutes(storyId: string | undefined | null) {
  const db = useDrizzle();
  const [data, setData] = useState<RouteData>(emptyData);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!storyId) {
      setData(emptyData());
      setLoading(false);
      return;
    }
    try {
      const service = createRouteService(db);
      const [routes, scenes, choices, chapters] = await Promise.all([
        service.getAllByStoryId(storyId),
        createSceneService(db).getAllByStoryId(storyId),
        createChoiceService(db).getAllByStoryId(storyId),
        createChapterService(db).getAllByStoryId(storyId),
      ]);
      const allSteps = await Promise.all(
        routes.map(async (route) => [route.id, await service.getSteps(route.id)] as const),
      );
      setData({ routes, scenes, choices, chapters, stepsByRouteId: new Map(allSteps) });
    } catch (error) {
      console.error('Failed to load story routes:', error);
      setData(emptyData());
    } finally {
      setLoading(false);
    }
  }, [db, storyId]);

  useEntityInitialLoad(reload);

  useEffect(() => {
    for (const event of [
      'route_changed',
      'route_step_changed',
      'scene_changed',
      'choice_changed',
    ]) {
      entityEventEmitter.on(event, reload);
    }
    return () => {
      for (const event of [
        'route_changed',
        'route_step_changed',
        'scene_changed',
        'choice_changed',
      ]) {
        entityEventEmitter.off(event, reload);
      }
    };
  }, [reload]);

  return useMemo(
    () => ({
      ...data,
      loading,
      reload,
      stepsOf: (routeId: string) => data.stepsByRouteId.get(routeId) ?? [],
      sceneById: (sceneId: string) => data.scenes.find((scene) => scene.id === sceneId),
      chapterNameOf: (chapterId: string | null) => data.chapters.find((chapter) => chapter.id === chapterId)?.name,
      choicesFrom: (sceneId: string) => data.choices.filter((choice) => choice.sceneId === sceneId),
    }),
    [data, loading, reload],
  );
}
