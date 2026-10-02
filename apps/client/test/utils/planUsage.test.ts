import {
  evaluatePlanUsage,
  PLAN_ALERT_RATIO,
  PLAN_WARNING_RATIO,
  planUsageLevel,
} from '../../src/utils/planUsage';

describe('planUsageLevel', () => {
  it('warns from 90% of the limit and alerts from 95%', () => {
    expect(PLAN_WARNING_RATIO).toBe(0.9);
    expect(PLAN_ALERT_RATIO).toBe(0.95);

    expect(planUsageLevel(89, 100)).toBe('ok');
    expect(planUsageLevel(90, 100)).toBe('warning');
    expect(planUsageLevel(94, 100)).toBe('warning');
    expect(planUsageLevel(95, 100)).toBe('alert');
    expect(planUsageLevel(99, 100)).toBe('alert');
  });

  it('alerts at and past the limit, and for a limit of zero', () => {
    expect(planUsageLevel(100, 100)).toBe('alert');
    expect(planUsageLevel(120, 100)).toBe('alert');
    expect(planUsageLevel(0, 0)).toBe('alert');
  });

  it('has nothing to warn about without a limit', () => {
    expect(planUsageLevel(1_000_000, null)).toBe('ok');
  });

  it('uses the marks of the limit itself, not of a round number', () => {
    expect(planUsageLevel(8, 10)).toBe('ok');
    expect(planUsageLevel(9, 10)).toBe('warning');
    expect(planUsageLevel(10, 10)).toBe('alert');
    expect(planUsageLevel(18, 20)).toBe('warning');
    expect(planUsageLevel(19, 20)).toBe('alert');
  });
});

describe('evaluatePlanUsage', () => {
  it('has nothing without a plan, and for ceilings the plan does not set', () => {
    expect(evaluatePlanUsage(null, 500, 900)).toEqual({ story: null, total: null, worst: null });
    expect(evaluatePlanUsage({ maxEntitiesPerStory: null, maxEntitiesTotal: null }, 5, 5)).toEqual({
      story: null,
      total: null,
      worst: null,
    });
  });

  it('measures each ceiling against its own count', () => {
    const summary = evaluatePlanUsage(
      { maxEntitiesPerStory: 100, maxEntitiesTotal: 1000 },
      92,
      400,
    );

    expect(summary.story).toEqual({ scope: 'story', used: 92, limit: 100, level: 'warning' });
    expect(summary.total).toEqual({ scope: 'total', used: 400, limit: 1000, level: 'ok' });
    expect(summary.worst).toBe(summary.story);
  });

  it('points at the ceiling closest to being reached', () => {
    const summary = evaluatePlanUsage(
      { maxEntitiesPerStory: 100, maxEntitiesTotal: 1000 },
      91,
      990,
    );

    expect(summary.worst?.scope).toBe('total');
    expect(summary.worst?.level).toBe('alert');
  });

  it('has no worst while everything is inside the warning mark', () => {
    const summary = evaluatePlanUsage(
      { maxEntitiesPerStory: 100, maxEntitiesTotal: 1000 },
      10,
      100,
    );

    expect(summary.worst).toBeNull();
  });
});
