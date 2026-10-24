import { useEffect, useState } from 'react';
import { useDrizzle } from '@/src/db';
import type { ChapterSelect, RouteSelect, RouteStepSelect } from '@/src/db/schema';
import { createChapterService } from '@/src/services/storymanagement/scenes-chapters/ChapterService';
import { createRouteService } from '@/src/services/storymanagement/entities/RouteService';
import { fireAndLog } from '@/src/utils/logging/fireAndLog';

export interface CharacterTrajectoryData {
  chapters: ChapterSelect[];
  routes: RouteSelect[];
  stepsByRoute: Record<string, RouteStepSelect[]>;
}

/**
 * The chapters, routes and route steps behind a character trajectory. It lives
 * here and not in the section because components must not fetch (see the import
 * boundaries test): linear stories skip the route load entirely.
 */
export function useCharacterTrajectoryData(
  storyId: string,
  storyType: 'linear' | 'branching',
): CharacterTrajectoryData {
  const db = useDrizzle();
  const [chapters, setChapters] = useState<ChapterSelect[]>([]);
  const [routes, setRoutes] = useState<RouteSelect[]>([]);
  const [stepsByRoute, setStepsByRoute] = useState<Record<string, RouteStepSelect[]>>({});

  useEffect(() => {
    let cancelled = false;
    fireAndLog(
      (async () => {
        const loadedChapters = await createChapterService(db).getAllByStoryId(storyId);
        let loadedRoutes: RouteSelect[] = [];
        const loadedSteps: Record<string, RouteStepSelect[]> = {};
        if (storyType === 'branching') {
          const routeService = createRouteService(db);
          loadedRoutes = (await routeService.getAllByStoryId(storyId)).filter(
            (route) => !route.isDeleted,
          );
          for (const route of loadedRoutes) {
            loadedSteps[route.id] = (await routeService.getSteps(route.id)).filter(
              (step) => !step.isDeleted,
            );
          }
        }
        if (cancelled) return;
        setChapters(loadedChapters.filter((chapter) => !chapter.isDeleted));
        setRoutes(loadedRoutes);
        setStepsByRoute(loadedSteps);
      })(),
      'useCharacterTrajectoryData',
    );
    return () => {
      cancelled = true;
    };
  }, [db, storyId, storyType]);

  return { chapters, routes, stepsByRoute };
}
