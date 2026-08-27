import type { CalendarDefinitionType } from '@keres/shared';
import { calendarCarryChain } from '@keres/shared';
import type { TFunction } from 'i18next';

type SceneTimingUnit =
  | 'seconds'
  | 'minutes'
  | 'hours'
  | 'days'
  | 'weeks'
  | 'months'
  | 'years'
  | 'millennia'
  | 'eons';

/**
 * How a duration should be read back.
 *
 * `calendar` absent means the story has none, and the Gregorian averages the app has always used
 * apply - which is correct for that story rather than a fallback it is suffering.
 */
export interface SceneTimingOptions {
  normalize?: boolean;
  calendar?: CalendarDefinitionType | null;
}

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

const isSceneTimingUnit = (value: string | null | undefined): value is SceneTimingUnit =>
  value !== null && sceneTimingUnits.includes(value as SceneTimingUnit);

/**
 * The third argument used to be a bare `normalize` boolean, and still may be.
 *
 * Kept accepting one because the boolean form is `story.normalizeSceneTiming` passed straight
 * through, which reads clearly at the call sites that have no calendar to hand and would only be
 * noise to wrap.
 */
const asOptions = (options: SceneTimingOptions | boolean): SceneTimingOptions =>
  typeof options === 'boolean' ? { normalize: options } : options;

const getTimingPart = (value: number | null | undefined, unit: string | null | undefined) => {
  if (!value || !Number.isFinite(value) || !isSceneTimingUnit(unit)) {
    return null;
  }

  return { value, unit };
};

/**
 * How the story names a unit, falling back to the app's own word for it.
 *
 * A calendar may rename a week to a *ciclo*; it may also rename none of them. The name is taken by
 * position - the nth month name is what "months" is called - because the unit vocabulary is fixed
 * and the calendar only supplies labels for it.
 */
const unitName = (
  unit: SceneTimingUnit,
  value: number,
  t: TFunction,
  calendar?: CalendarDefinitionType | null,
): string => {
  const custom = calendar?.unitNames?.[unit];
  return custom ? `${value} ${custom}` : t(`scene_time_${unit}`, { count: value });
};

const formatTimingPart = (
  value: number,
  unit: SceneTimingUnit,
  t: TFunction,
  calendar?: CalendarDefinitionType | null,
): string => unitName(unit, value, t, calendar);

const formatTimingTotals = (
  totals: Map<SceneTimingUnit, number>,
  t: TFunction,
  options: SceneTimingOptions,
): string => {
  if (options.normalize) {
    /*
     * The carry chain comes from the story's own calendar, and falls back to the Gregorian
     * approximations the app used before calendars existed. Those were always a narrative display
     * aid rather than real-world arithmetic; what changes is that a story that has stated its own
     * ratios is now normalised with them instead.
     */
    for (const step of calendarCarryChain(options.calendar)) {
      const value = totals.get(step.from as SceneTimingUnit) ?? 0;
      const transferred = Math.trunc(value / step.amount);
      if (transferred > 0) {
        totals.set(step.from as SceneTimingUnit, value % step.amount);
        totals.set(
          step.to as SceneTimingUnit,
          (totals.get(step.to as SceneTimingUnit) ?? 0) + transferred,
        );
      }
    }
  }

  const parts = sceneTimingUnits
    .map((unit) => ({ unit, value: totals.get(unit) ?? 0 }))
    .filter(({ value }) => value !== 0)
    .map(({ unit, value }) => formatTimingPart(value, unit, t, options.calendar));

  return parts.length > 0 ? parts.join(', ') : formatTimingPart(0, 'minutes', t, options.calendar);
};

/** Formats a scene's own duration, treating incomplete timing data as zero minutes. */
export const formatSceneUniverseDuration = (
  scene: SceneTimingSource,
  t: TFunction,
  options: SceneTimingOptions | boolean = {},
): string => {
  const timing = getTimingPart(scene.duration, scene.durationType);
  const totals = new Map<SceneTimingUnit, number>();
  if (timing) totals.set(timing.unit, timing.value);
  return formatTimingTotals(totals, t, asOptions(options));
};

/** Formats the interval that happens before a scene, treating incomplete timing data as zero minutes. */
export const formatSceneGap = (
  scene: SceneTimingSource,
  t: TFunction,
  options: SceneTimingOptions | boolean = {},
): string => {
  const timing = getTimingPart(scene.gap, scene.gapType);
  const totals = new Map<SceneTimingUnit, number>();
  if (timing) totals.set(timing.unit, timing.value);
  return formatTimingTotals(totals, t, asOptions(options));
};

/** True only when a scene has a duration that should be surfaced in compact lists. */
export const hasSceneUniverseDuration = (scene: SceneTimingSource): boolean =>
  Boolean(getTimingPart(scene.duration, scene.durationType));

/** True only when a scene has a gap that should be surfaced in compact lists. */
export const hasSceneGap = (scene: SceneTimingSource): boolean =>
  Boolean(getTimingPart(scene.gap, scene.gapType));

/**
 * Calculates a linear chapter's elapsed in-universe time. A scene's gap belongs to the
 * transition into that scene, so the first scene's gap is intentionally excluded.
 * Units are kept separate instead of approximating months, years, or fictional eons.
 */
export const formatChapterUniverseDuration = (
  scenes: SceneTimingSource[],
  t: TFunction,
  options: SceneTimingOptions | boolean = {},
): string => {
  const totals = new Map<SceneTimingUnit, number>();
  const addTiming = (value: number | null | undefined, unit: string | null | undefined) => {
    const timing = getTimingPart(value, unit);
    if (timing) totals.set(timing.unit, (totals.get(timing.unit) ?? 0) + timing.value);
  };

  scenes.forEach((scene, index) => {
    if (index > 0) addTiming(scene.gap, scene.gapType);
    addTiming(scene.duration, scene.durationType);
  });

  return formatTimingTotals(totals, t, asOptions(options));
};
