import type { TFunction } from 'i18next';

type SceneTimingUnit = 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years' | 'millennia' | 'eons';

interface SceneTimingSource {
  gap?: number | null;
  gapType?: string | null;
  duration?: number | null;
  durationType?: string | null;
}

const sceneTimingUnits: SceneTimingUnit[] = [
  'eons',
  'millennia',
  'years',
  'months',
  'weeks',
  'days',
  'hours',
  'minutes',
  'seconds',
];

const isSceneTimingUnit = (value: string | null | undefined): value is SceneTimingUnit => (
  value !== null && sceneTimingUnits.includes(value as SceneTimingUnit)
);

const getTimingPart = (value: number | null | undefined, unit: string | null | undefined) => {
  if (!value || !Number.isFinite(value) || value < 0 || !isSceneTimingUnit(unit)) {
    return null;
  }

  return { value, unit };
};

const formatTimingPart = (value: number, unit: SceneTimingUnit, t: TFunction): string => (
  t(`scene_time_${unit}`, { count: value })
);

const formatTimingTotals = (totals: Map<SceneTimingUnit, number>, t: TFunction, normalize: boolean): string => {
  if (normalize) {
    const carry = (from: SceneTimingUnit, to: SceneTimingUnit, amount: number) => {
      const value = totals.get(from) ?? 0;
      const transferred = Math.floor(value / amount);
      if (transferred > 0) {
        totals.set(from, value % amount);
        totals.set(to, (totals.get(to) ?? 0) + transferred);
      }
    };
    carry('seconds', 'minutes', 60);
    carry('minutes', 'hours', 60);
    carry('hours', 'days', 24);
    carry('days', 'weeks', 7);
    // Calendar units are intentionally approximate: this is a narrative display aid,
    // not a real-world calendar or timestamp calculation.
    carry('weeks', 'months', 4);
    carry('months', 'years', 12);
    carry('years', 'millennia', 1000);
  }

  const parts = sceneTimingUnits
    .map((unit) => ({ unit, value: totals.get(unit) ?? 0 }))
    .filter(({ value }) => value > 0)
    .map(({ unit, value }) => formatTimingPart(value, unit, t));

  return parts.length > 0 ? parts.join(', ') : formatTimingPart(0, 'minutes', t);
};

/** Formats a scene's own duration, treating incomplete timing data as zero minutes. */
export const formatSceneUniverseDuration = (scene: SceneTimingSource, t: TFunction, normalize = false): string => {
  const timing = getTimingPart(scene.duration, scene.durationType);
  const totals = new Map<SceneTimingUnit, number>();
  if (timing) totals.set(timing.unit, timing.value);
  return formatTimingTotals(totals, t, normalize);
};

/** Formats the interval that happens before a scene, treating incomplete timing data as zero minutes. */
export const formatSceneGap = (scene: SceneTimingSource, t: TFunction, normalize = false): string => {
  const timing = getTimingPart(scene.gap, scene.gapType);
  const totals = new Map<SceneTimingUnit, number>();
  if (timing) totals.set(timing.unit, timing.value);
  return formatTimingTotals(totals, t, normalize);
};

/** True only when a scene has a duration that should be surfaced in compact lists. */
export const hasSceneUniverseDuration = (scene: SceneTimingSource): boolean => Boolean(
  getTimingPart(scene.duration, scene.durationType)
);

/** True only when a scene has a gap that should be surfaced in compact lists. */
export const hasSceneGap = (scene: SceneTimingSource): boolean => Boolean(
  getTimingPart(scene.gap, scene.gapType)
);

/**
 * Calculates a linear chapter's elapsed in-universe time. A scene's gap belongs to the
 * transition into that scene, so the first scene's gap is intentionally excluded.
 * Units are kept separate instead of approximating months, years, or fictional eons.
 */
export const formatChapterUniverseDuration = (scenes: SceneTimingSource[], t: TFunction, normalize = false): string => {
  const totals = new Map<SceneTimingUnit, number>();
  const addTiming = (value: number | null | undefined, unit: string | null | undefined) => {
    const timing = getTimingPart(value, unit);
    if (timing) totals.set(timing.unit, (totals.get(timing.unit) ?? 0) + timing.value);
  };

  scenes.forEach((scene, index) => {
    if (index > 0) addTiming(scene.gap, scene.gapType);
    addTiming(scene.duration, scene.durationType);
  });

  return formatTimingTotals(totals, t, normalize);
};
