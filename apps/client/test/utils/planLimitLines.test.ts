import { planLimitLines } from '../../src/utils/planLimitLines';

const t = (key: string, options?: Record<string, unknown>) =>
  options ? `${key}:${options.count}` : key;

const unlimited = {
  maxStories: null,
  maxEntitiesTotal: null,
  maxPublicationsPerDay: null,
  maxPublishedArcs: null,
};

describe('planLimitLines', () => {
  it('says every ceiling the plan does not have is unlimited', () => {
    expect(planLimitLines(unlimited, t)).toEqual([
      'plan_limit_stories_unlimited',
      'plan_limit_entities_unlimited',
      'plan_limit_publications_unlimited',
      'plan_limit_works_unlimited',
    ]);
  });

  it('counts the ceilings it has, with the singular for one', () => {
    expect(
      planLimitLines(
        { maxStories: 1, maxEntitiesTotal: 500, maxPublicationsPerDay: 0, maxPublishedArcs: 1 },
        t,
      ),
    ).toEqual([
      'plan_limit_stories_one:1',
      'plan_limit_entities_other:500',
      'plan_limit_publications_other:0',
      'plan_limit_works_one:1',
    ]);
  });
  it('adds the cap on comments per story when the plan states it, unlimited when blank', () => {
    expect(planLimitLines({ ...unlimited, maxCommentsPerStory: null }, t)).toEqual([
      'plan_limit_stories_unlimited',
      'plan_limit_entities_unlimited',
      'plan_limit_publications_unlimited',
      'plan_limit_works_unlimited',
      'plan_limit_comments_unlimited',
    ]);
    expect(planLimitLines({ ...unlimited, maxCommentsPerStory: 1 }, t).at(-1)).toBe(
      'plan_limit_comments_one:1',
    );
    expect(planLimitLines({ ...unlimited, maxCommentsPerStory: 0 }, t).at(-1)).toBe(
      'plan_limit_comments_none',
    );
  });

  it('leaves the comment line out only when the plan does not state the cap (an older server)', () => {
    expect(planLimitLines(unlimited, t)).toHaveLength(4);
  });

  it('adds the cap on collaborators per story when the plan states it: unlimited, a count, and none for zero', () => {
    expect(planLimitLines({ ...unlimited, maxContributorsPerStory: null }, t).at(-1)).toBe(
      'plan_limit_contributors_unlimited',
    );
    expect(planLimitLines({ ...unlimited, maxContributorsPerStory: 1 }, t).at(-1)).toBe(
      'plan_limit_contributors_one:1',
    );
    expect(planLimitLines({ ...unlimited, maxContributorsPerStory: 6 }, t).at(-1)).toBe(
      'plan_limit_contributors_other:6',
    );
    expect(planLimitLines({ ...unlimited, maxContributorsPerStory: 0 }, t).at(-1)).toBe(
      'plan_limit_contributors_none',
    );
  });

  it('leaves the collaborator line out when the plan does not state the cap (an older server)', () => {
    expect(planLimitLines(unlimited, t)).toHaveLength(4);
    expect(planLimitLines({ ...unlimited, maxCommentsPerStory: 3 }, t)).toHaveLength(5);
  });

  it('shows the comment line for a plan on sale, next to the other per-story lines', () => {
    const onSale = { ...unlimited, maxStories: 3, maxCommentsPerStory: 10 };
    expect(planLimitLines(onSale, t)).toEqual([
      'plan_limit_stories_other:3',
      'plan_limit_entities_unlimited',
      'plan_limit_publications_unlimited',
      'plan_limit_works_unlimited',
      'plan_limit_comments_other:10',
    ]);
  });
});
