import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDrizzle } from '@/src/db';
import type {
  ChapterSelect,
  ChoiceSelect,
  RouteSelect,
  RouteStepSelect,
  SceneSelect,
} from '@/src/db/schema';
import { createChapterService } from '@/src/services/storymanagement/scenes-chapters/ChapterService';
import { createChoiceService } from '@/src/services/storymanagement/choices-stats/ChoiceService';
import { createChoiceCheckGroupService } from '@/src/services/storymanagement/choices-stats/ChoiceCheckGroupService';
import { createChoiceCheckService } from '@/src/services/storymanagement/choices-stats/ChoiceCheckService';
import { createEffectService } from '@/src/services/storymanagement/choices-stats/EffectService';
import { createRouteService } from '@/src/services/storymanagement/entities/RouteService';
import { createSceneService } from '@/src/services/storymanagement/scenes-chapters/SceneService';
import { entityEventEmitter } from '@/src/state/events/EventEmitter';
import type { EntityEventName } from '@/src/state/events/entityEvents';
import { useEntityInitialLoad } from '@/src/hooks/lists/useEntityRefreshLifecycle';
import {
  type ChoiceCheck,
  type ChoiceCheckGroup,
  type Effect,
  validateRouteSteps,
  validateRouteTraversal,
} from '@keres/shared';
import { logger } from '@/src/utils/logging/logger';

interface RouteData {
  routes: RouteSelect[];
  scenes: SceneSelect[];
  choices: ChoiceSelect[];
  chapters: ChapterSelect[];
  groups: ChoiceCheckGroup[];
  checks: ChoiceCheck[];
  effects: Effect[];
  stepsByRouteId: Map<string, RouteStepSelect[]>;
}

const emptyData = (): RouteData => ({
  routes: [],
  scenes: [],
  choices: [],
  chapters: [],
  groups: [],
  checks: [],
  effects: [],
  stepsByRouteId: new Map(),
});

/**
 * The single read model for Route authoring and reading.  Steps are refreshed together with their
 * scenes, so a renamed/deleted scene never leaves a stale label in a saved route.
 */
/** What a route's data depends on: the routes themselves and the choices they walk. */
const ROUTE_EVENTS: readonly EntityEventName[] = [
  'route_changed',
  'route_step_changed',
  'scene_changed',
  'choice_changed',
  'choice_check_group_changed',
  'choice_check_changed',
  'effect_changed',
];

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
      const [routes, scenes, choices, chapters, groups, checks, effects] = await Promise.all([
        service.getAllByStoryId(storyId),
        createSceneService(db).getAllByStoryId(storyId),
        createChoiceService(db).getAllByStoryId(storyId),
        createChapterService(db).getAllByStoryId(storyId),
        createChoiceCheckGroupService(db).getAllByStoryId(storyId),
        createChoiceCheckService(db).getAllByStoryId(storyId),
        createEffectService(db).getAllByStoryId(storyId),
      ]);
      const allSteps = await Promise.all(
        routes.map(async (route) => [route.id, await service.getSteps(route.id)] as const),
      );
      setData({
        routes,
        scenes,
        choices,
        chapters,
        groups,
        checks,
        effects,
        stepsByRouteId: new Map(allSteps),
      });
    } catch (error) {
      logger.error('Failed to load story routes:', error);
      setData(emptyData());
    } finally {
      setLoading(false);
    }
  }, [db, storyId]);

  useEntityInitialLoad(reload);

  useEffect(() => {
    for (const event of ROUTE_EVENTS) {
      entityEventEmitter.on(event, reload);
    }
    return () => {
      for (const event of ROUTE_EVENTS) {
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
      chapterNameOf: (chapterId: string | null) =>
        data.chapters.find((chapter) => chapter.id === chapterId)?.name,
      choicesFrom: (sceneId: string) => data.choices.filter((choice) => choice.sceneId === sceneId),
      validationOf: (routeId: string) =>
        validateRouteSteps(
          data.stepsByRouteId.get(routeId) ?? [],
          data.scenes.map((scene) => scene.id),
          data.choices,
        ),
      executionValidationOf: (routeId: string) =>
        validateRouteTraversal({
          steps: data.stepsByRouteId.get(routeId) ?? [],
          sceneIds: data.scenes.map((scene) => scene.id),
          choices: data.choices,
          groups: data.groups,
          checks: data.checks,
          effects: data.effects,
        }),
    }),
    [data, loading, reload],
  );
}
