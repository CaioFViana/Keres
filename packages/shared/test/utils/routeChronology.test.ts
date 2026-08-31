import { describe, expect, it } from 'vitest';
import { buildRouteChronology } from '../../utils/routeChronology';

const scene = (id: string, timing: Record<string, unknown> = {}) => ({
  id,
  name: id,
  chapterId: 'chapter',
  summary: null,
  gap: null,
  gapType: null,
  duration: null,
  durationType: null,
  ...timing,
});

describe('buildRouteChronology', () => {
  it('uses the route order and does not charge the first visit its gap', () => {
    const layout = buildRouteChronology(
      [
        { id: 'first-visit', position: 1, sceneId: 'first', isDeleted: false },
        { id: 'second-visit', position: 2, sceneId: 'second', isDeleted: false },
      ],
      [
        scene('first', { gap: 8, gapType: 'hours', duration: 1, durationType: 'hours' }),
        scene('second', { gap: 2, gapType: 'hours', duration: 1, durationType: 'hours' }),
      ],
    );

    expect(layout.rows.map((row) => row.id)).toEqual(['first-visit', 'second-visit']);
    expect(layout.rows[0].elapsedSeconds).toBe(0);
    expect(layout.rows[1].elapsedSeconds).toBe(3 * 60 * 60);
  });

  it('keeps repeated scene visits distinct', () => {
    const layout = buildRouteChronology(
      [
        { id: 'visit-one', position: 1, sceneId: 'loop', isDeleted: false },
        { id: 'visit-two', position: 2, sceneId: 'loop', isDeleted: false },
      ],
      [scene('loop', { gap: 30, gapType: 'minutes', duration: 1, durationType: 'hours' })],
    );

    expect(layout.rows.map((row) => row.id)).toEqual(['visit-one', 'visit-two']);
    expect(layout.rows.map((row) => row.elapsedSeconds)).toEqual([0, 90 * 60]);
  });

  it('applies an explicit scene date independently to every visit', () => {
    const layout = buildRouteChronology(
      [
        { id: 'visit-one', position: 1, sceneId: 'fixed', isDeleted: false },
        { id: 'visit-two', position: 2, sceneId: 'fixed', isDeleted: false },
      ],
      [scene('fixed', { duration: 1, durationType: 'hours' })],
      { sceneElapsedOverrides: { fixed: 10 * 60 * 60 } },
    );

    expect(layout.rows.map((row) => row.elapsedSeconds)).toEqual([10 * 60 * 60, 10 * 60 * 60]);
  });
});
