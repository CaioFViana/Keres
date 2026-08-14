import {
  formatChapterUniverseDuration,
  formatSceneGap,
  formatSceneUniverseDuration,
  hasSceneUniverseDuration,
} from '../../src/utils/sceneTiming';
import type { TFunction } from 'i18next';

const t = ((key: string, options?: { count?: number }) =>
  `${key}:${options?.count ?? 0}`) as unknown as TFunction;

describe('scene timing', () => {
  it('uses zero minutes for incomplete values and surfaces valid durations', () => {
    expect(formatSceneUniverseDuration({ duration: null, durationType: 'hours' }, t)).toBe(
      'scene_time_minutes:0',
    );
    expect(formatSceneGap({ gap: 0, gapType: 'hours' }, t)).toBe('scene_time_minutes:0');
    expect(hasSceneUniverseDuration({ duration: 4, durationType: 'hours' })).toBe(true);
    expect(hasSceneUniverseDuration({ duration: 4, durationType: 'unknown' })).toBe(false);
  });

  it('normalizes time using the narrative conversion rules', () => {
    expect(formatSceneUniverseDuration({ duration: 25, durationType: 'hours' }, t, true)).toBe(
      'scene_time_days:1, scene_time_hours:1',
    );
  });

  it('excludes the first scene gap from the chapter total', () => {
    const scenes = [
      { gap: 9, gapType: 'hours', duration: 1, durationType: 'hours' },
      { gap: 2, gapType: 'hours', duration: 3, durationType: 'hours' },
    ];

    expect(formatChapterUniverseDuration(scenes, t)).toBe('scene_time_hours:6');
  });
});
