import type { RouteStep } from '../entities/RouteStep';
import type { Scene } from '../entities/Scene';
import type { CalendarDefinitionType } from '../schemas/StoryCalendarSchemas';
import {
  buildStoryTimelineLayout,
  type StoryTimelineLayout,
  type StoryTimelineScaleMode,
} from '../graphs/storyTimelineLayout';

/**
 * A read-only chronological projection of one authored route.
 *
 * A route step is a visit, rather than merely a scene reference: using the step id as the timeline
 * row id deliberately lets a route visit the same scene more than once. The first visit has no
 * gap, matching the ordinary Story Timeline's "gap belongs to the transition into a scene" rule.
 */
export function buildRouteChronology(
  steps: Pick<RouteStep, 'id' | 'position' | 'sceneId' | 'isDeleted'>[],
  scenes: Pick<
    Scene,
    'id' | 'name' | 'chapterId' | 'summary' | 'gap' | 'gapType' | 'duration' | 'durationType'
  >[],
  options: {
    calendar?: CalendarDefinitionType | null;
    scaleMode?: StoryTimelineScaleMode;
    chapterNameOf?: (chapterId: string | null) => string;
    /** Absolute route-relative starts keyed by scene id, normally from a date override. */
    sceneElapsedOverrides?: Record<string, number>;
  } = {},
): StoryTimelineLayout {
  const sceneById = new Map(scenes.map((scene) => [scene.id, scene]));
  const activeSteps = steps
    .filter((step) => !step.isDeleted)
    .sort((a, b) => a.position - b.position);
  const overrides: Record<string, number> = {};
  const routeScenes = activeSteps.flatMap((step, index) => {
    const scene = sceneById.get(step.sceneId);
    if (!scene) return [];
    const declaredStart = options.sceneElapsedOverrides?.[scene.id];
    if (declaredStart !== undefined) overrides[step.id] = declaredStart;
    return [
      {
        ...scene,
        // The visual palette is intentionally neutral: chapters are the canonical linear grouping,
        // while this axis is a route traversal and may re-enter a chapter many times.
        id: step.id,
        chapterId: scene.chapterId ?? '__unassigned__',
        chapterName: options.chapterNameOf?.(scene.chapterId) ?? '',
        chapterColor: '#7c5ce0',
        index,
      },
    ];
  });
  return buildStoryTimelineLayout(routeScenes, {
    calendar: options.calendar,
    scaleMode: options.scaleMode,
    sceneElapsedOverrides: overrides,
  });
}
