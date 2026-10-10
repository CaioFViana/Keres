/** The ceilings of a plan, as the server states them: a ceiling it does not have is `null`. */
export interface PlanLimits {
  maxStories: number | null;
  maxEntitiesTotal: number | null;
  maxPublicationsPerDay: number | null;
  maxPublishedArcs: number | null;
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** `plan_limit_<what>_one` for 1, `_other` for any other number, `_unlimited` for no ceiling. */
function line(t: Translate, what: string, limit: number | null): string {
  if (limit === null) return t(`plan_limit_${what}_unlimited`);
  return t(`plan_limit_${what}_${limit === 1 ? 'one' : 'other'}`, { count: limit });
}

/** A plan's ceilings as short lines; a ceiling the plan does not have reads "unlimited". */
export function planLimitLines(limits: PlanLimits, t: Translate): string[] {
  return [
    line(t, 'stories', limits.maxStories),
    line(t, 'entities', limits.maxEntitiesTotal),
    line(t, 'publications', limits.maxPublicationsPerDay),
    line(t, 'works', limits.maxPublishedArcs),
  ];
}
