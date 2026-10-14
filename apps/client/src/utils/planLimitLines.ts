/** The ceilings of a plan, as the server states them: a ceiling it does not have is `null`. */
export interface PlanLimits {
  maxStories: number | null;
  maxEntitiesTotal: number | null;
  maxPublicationsPerDay: number | null;
  maxPublishedArcs: number | null;
  /**
   * The cap on comments per story. Optional because a plan read from an older server may not carry it: no line then.
   */
  maxCommentsPerStory?: number | null;
  /**
   * The cap on collaborators per story (readers and writers, not the owner). Optional for the same reason: no line
   * from a server that predates it.
   */
  maxContributorsPerStory?: number | null;
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** `plan_limit_<what>_<one|other>` for 1 or another number, `_unlimited` for no ceiling. */
function line(t: Translate, what: string, limit: number | null): string {
  if (limit === null) return t(`plan_limit_${what}_unlimited`);
  return t(`plan_limit_${what}_${limit === 1 ? 'one' : 'other'}`, { count: limit });
}

/** A plan's ceilings as short lines; a ceiling the plan does not have reads "unlimited". */
export function planLimitLines(limits: PlanLimits, t: Translate): string[] {
  const lines = [
    line(t, 'stories', limits.maxStories),
    line(t, 'entities', limits.maxEntitiesTotal),
    line(t, 'publications', limits.maxPublicationsPerDay),
    line(t, 'works', limits.maxPublishedArcs),
  ];
  if (limits.maxCommentsPerStory !== undefined) {
    // Zero is its own line: "Up to 0 comments per story" would read as a mistake, and no comments is the plain fact.
    lines.push(
      limits.maxCommentsPerStory === 0
        ? t('plan_limit_comments_none')
        : line(t, 'comments', limits.maxCommentsPerStory),
    );
  }
  if (limits.maxContributorsPerStory !== undefined) {
    // Zero is its own line for the same reason: nobody may be invited is the plain fact.
    lines.push(
      limits.maxContributorsPerStory === 0
        ? t('plan_limit_contributors_none')
        : line(t, 'contributors', limits.maxContributorsPerStory),
    );
  }
  return lines;
}
