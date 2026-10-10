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
});
