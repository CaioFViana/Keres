import type { StoryPlan } from '@keres/shared';

/** From here the plan's usage shows as a warning: the bar changes colour, and the editor says so. */
export const PLAN_WARNING_RATIO = 0.9;
/** From here it is an alert: the bar takes the alert colour, and a notification is shown once. */
export const PLAN_ALERT_RATIO = 0.95;

export type PlanUsageLevel = 'ok' | 'warning' | 'alert';

/**
 * How close `used` is to `limit`. No limit (`null`) is always fine; a limit of zero, or any usage at or
 * past it, is an alert.
 */
export function planUsageLevel(used: number, limit: number | null): PlanUsageLevel {
  if (limit === null) return 'ok';
  if (used >= limit) return 'alert';
  if (used >= limit * PLAN_ALERT_RATIO) return 'alert';
  if (used >= limit * PLAN_WARNING_RATIO) return 'warning';
  return 'ok';
}

/** One ceiling of the plan and what is used against it. */
export interface PlanUsage {
  /** `story`: the ceiling for this one story; `total`: the one across all the owner's stories. */
  scope: 'story' | 'total';
  used: number;
  limit: number;
  level: PlanUsageLevel;
}

export interface PlanUsageSummary {
  story: PlanUsage | null;
  total: PlanUsage | null;
  /** The closest to its ceiling of those that are past the warning mark; `null` when none is. */
  worst: PlanUsage | null;
}

const usageOf = (
  scope: PlanUsage['scope'],
  used: number,
  limit: number | null,
): PlanUsage | null =>
  limit === null ? null : { scope, used, limit, level: planUsageLevel(used, limit) };

const ratioOf = (usage: PlanUsage) => usage.used / Math.max(1, usage.limit);

/**
 * What the story's owner plan makes of the counts: the per-story ceiling against `storyUsed` (the count of
 * this story, local, so it includes what has not synchronized yet) and the total ceiling against
 * `totalUsed` (all the owner's stories, as the server last counted them).
 */
export function evaluatePlanUsage(
  plan: Pick<StoryPlan, 'maxEntitiesPerStory' | 'maxEntitiesTotal'> | null,
  storyUsed: number,
  totalUsed: number,
): PlanUsageSummary {
  const story = usageOf('story', storyUsed, plan?.maxEntitiesPerStory ?? null);
  const total = usageOf('total', totalUsed, plan?.maxEntitiesTotal ?? null);
  const past = [story, total].filter(
    (usage): usage is PlanUsage => usage !== null && usage.level !== 'ok',
  );
  const worst = past.sort((a, b) => ratioOf(b) - ratioOf(a))[0] ?? null;
  return { story, total, worst };
}
