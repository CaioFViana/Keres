import type { TimingUnit } from '../metadata/TimingUnit';
import { TIMING_UNITS } from '../metadata/TimingUnit';
import type {
  CalendarDefinitionType,
  CalendarMoonType,
  CalendarSeasonType,
} from '../schemas/StoryCalendarSchemas';

/**
 * The arithmetic of a story's own calendar.
 *
 * Everything here is a pure function of a definition and an integer **day number**. The day number
 * is the only currency: day 0 is the first day of year 1, negatives run backwards from there, and
 * every conversion in the app goes through it. That is what lets several calendars coexist without
 * touching storage - each one is a different reading of the same integer.
 *
 * ## Why there are no leap rules
 *
 * A year here is the sum of its months, and months have integer lengths, so a year is an integer
 * number of days and every division below is exact. Invented calendars are almost always designed
 * that way. A fractional year would drift `dayOfYear` and pull a correction rule into every function
 * in this file, in exchange for a fidelity nobody reading a novel would notice.
 *
 * ## Why moons and seasons are here and not in a table
 *
 * They are read-only derivations. Nothing is ever written in moons - no duration is "one moon", no
 * gap is "a season". They exist to situate a date, in parallel to the story, and that constraint is
 * exactly what keeps them two short functions instead of a second time system.
 */

/** Euclidean division: floors towards negative infinity, so days before year 1 behave. */
const floorDiv = (value: number, divisor: number) => Math.floor(value / divisor);
const floorMod = (value: number, divisor: number) => value - floorDiv(value, divisor) * divisor;

/**
 * Precomputed calendar facts. A definition is immutable while it is being read, so caching against
 * its object identity keeps date rendering independent of the number of scenes on screen. In
 * particular, formatting every row of a long timeline must not repeatedly sum months and sort eras.
 */
interface CalendarMath {
  daysPerYear: number;
  monthStarts: number[];
  eras: CalendarDefinitionType['eras'];
  seasons: CalendarDefinitionType['seasons'];
}

const calendarMathCache = new WeakMap<CalendarDefinitionType, CalendarMath>();

const mathFor = (definition: CalendarDefinitionType): CalendarMath => {
  const cached = calendarMathCache.get(definition);
  if (cached) return cached;

  let daysPerYear = 0;
  const monthStarts = definition.months.map((month) => {
    const start = daysPerYear;
    daysPerYear += month.days;
    return start;
  });
  const math: CalendarMath = {
    daysPerYear,
    monthStarts,
    eras: [...definition.eras].sort((a, b) => a.startYear - b.startYear),
    seasons: [...definition.seasons].sort((a, b) => a.startDayOfYear - b.startDayOfYear),
  };
  calendarMathCache.set(definition, math);
  return math;
};

/** Index of the last item whose ordered key is at most `value`, or -1 if there is none. */
const lastAtOrBefore = <T>(items: T[], value: number, key: (item: T) => number): number => {
  let low = 0;
  let high = items.length - 1;
  let result = -1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (key(items[middle]) <= value) {
      result = middle;
      low = middle + 1;
    } else high = middle - 1;
  }
  return result;
};

/** Re-exported so callers of the arithmetic do not need a second import for the vocabulary. */
export { TIMING_UNITS };
export type CalendarTimingUnit = TimingUnit;

/**
 * What the app used before calendars existed, and what it still uses for a story that has none.
 *
 * These are the two Gregorian tables the feature replaces, kept in one place as the fallback: a
 * month of 30.4375 days and a year of 365.25 are the averages the timeline was drawn with.
 */
export const FALLBACK_UNIT_DAYS: Record<CalendarTimingUnit, number> = {
  seconds: 1 / 86_400,
  minutes: 1 / 1440,
  hours: 1 / 24,
  days: 1,
  weeks: 7,
  months: 30.4375,
  years: 365.25,
  millennia: 365.25 * 1000,
  eons: 365.25 * 1_000_000_000,
};

export const FALLBACK_SECONDS_PER_DAY = 86_400;

/** The number of days in one year of this calendar. Always an integer. */
export function calendarDaysPerYear(definition: CalendarDefinitionType): number {
  return mathFor(definition).daysPerYear;
}

/** The number of the calendar's own seconds in one of its days. */
export function calendarSecondsPerDay(definition: CalendarDefinitionType): number {
  return definition.hoursPerDay * definition.minutesPerHour * definition.secondsPerMinute;
}

/**
 * How many days each duration unit is worth in this calendar.
 *
 * `millennia` and `eons` stay at 1000 and 10^9 years deliberately: they are decimal magnitude words,
 * not calendar facts. A world where a millennium is not a thousand years means something else by the
 * word and should rename the unit rather than redefine the arithmetic.
 *
 * `months` is the *average* month, because a duration of "3 months" is not anchored to a position in
 * the year and so cannot know which three.
 */
export function calendarUnitDays(
  definition: CalendarDefinitionType | null | undefined,
): Record<CalendarTimingUnit, number> {
  if (!definition) return { ...FALLBACK_UNIT_DAYS };

  const { daysPerYear } = mathFor(definition);
  const secondsPerDay = calendarSecondsPerDay(definition);
  return {
    seconds: 1 / secondsPerDay,
    minutes: definition.secondsPerMinute / secondsPerDay,
    hours: (definition.minutesPerHour * definition.secondsPerMinute) / secondsPerDay,
    days: 1,
    weeks: definition.daysPerWeek,
    months: daysPerYear / definition.months.length,
    years: daysPerYear,
    millennia: daysPerYear * 1000,
    eons: daysPerYear * 1_000_000_000,
  };
}

/**
 * The carry chain `sceneTiming` normalises with, smallest unit first.
 *
 * Each entry says how many of `from` make one `to`. Non-integer steps are rounded, because a carry
 * exists to say "90 minutes is 1 hour 30", and a fractional carry cannot say anything.
 */
export function calendarCarryChain(
  definition: CalendarDefinitionType | null | undefined,
): { from: CalendarTimingUnit; to: CalendarTimingUnit; amount: number }[] {
  const monthsPerYear = definition?.months.length ?? 12;
  const daysPerYear = definition ? calendarDaysPerYear(definition) : 365;
  const daysPerWeek = definition?.daysPerWeek ?? 7;
  const daysPerMonth = daysPerYear / monthsPerYear;

  return [
    { from: 'seconds', to: 'minutes', amount: definition?.secondsPerMinute ?? 60 },
    { from: 'minutes', to: 'hours', amount: definition?.minutesPerHour ?? 60 },
    { from: 'hours', to: 'days', amount: definition?.hoursPerDay ?? 24 },
    { from: 'days', to: 'weeks', amount: daysPerWeek },
    { from: 'weeks', to: 'months', amount: Math.max(1, Math.round(daysPerMonth / daysPerWeek)) },
    { from: 'months', to: 'years', amount: monthsPerYear },
    { from: 'years', to: 'millennia', amount: 1000 },
  ];
}

/** A day number resolved into a calendar's own components. */
export interface CalendarDateParts {
  /** Absolute year. 1 is the first year; 0 and below are before it. */
  year: number;
  /** 1-based index into `definition.months`. */
  month: number;
  /** 1-based day within that month. */
  day: number;
  /** 1-based day within the year. */
  dayOfYear: number;
  /** 0-based index into `weekdayNames`, or `null` when the calendar names no days. */
  weekday: number | null;
}

/** A timezone-free coordinate authored against either Gregorian or a custom calendar. */
export interface CalendarDateCoordinate {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

const CALENDAR_COORDINATE = /^(-?\d+)-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** Parses the ISO-like storage notation without involving JavaScript Date or a time zone. */
export function parseCalendarDateCoordinate(
  value: string | null | undefined,
): CalendarDateCoordinate | null {
  if (!value) return null;
  const match = CALENDAR_COORDINATE.exec(value);
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  return [year, month, day, hour, minute].every(Number.isSafeInteger)
    ? { year, month, day, hour, minute }
    : null;
}

/** Canonical, sortable, timezone-free representation used by Scene date overrides. */
export function formatCalendarDateCoordinate(parts: CalendarDateCoordinate): string {
  const year =
    parts.year < 0
      ? `-${String(Math.abs(parts.year)).padStart(4, '0')}`
      : String(parts.year).padStart(4, '0');
  return `${year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}T${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}

/** Syntax alone is intentionally insufficient: a calendar edit can make retained coordinates invalid. */
export function isCalendarDateCoordinateInBounds(
  definition: CalendarDefinitionType,
  parts: CalendarDateCoordinate,
): boolean {
  return (
    parts.month >= 1 &&
    parts.month <= definition.months.length &&
    parts.day >= 1 &&
    parts.day <= definition.months[parts.month - 1]!.days &&
    parts.hour >= 0 &&
    parts.hour < definition.hoursPerDay &&
    parts.minute >= 0 &&
    parts.minute < definition.minutesPerHour
  );
}

/** The components of an absolute day number in this calendar. */
export function dayNumberToParts(
  definition: CalendarDefinitionType,
  dayNumber: number,
): CalendarDateParts {
  const { daysPerYear, monthStarts } = mathFor(definition);
  const year = floorDiv(dayNumber, daysPerYear) + 1;
  const dayOfYear = floorMod(dayNumber, daysPerYear);

  const month = Math.max(
    0,
    lastAtOrBefore(monthStarts, dayOfYear, (start) => start),
  );
  const remaining = dayOfYear - monthStarts[month];

  return {
    year,
    month: month + 1,
    day: remaining + 1,
    dayOfYear: dayOfYear + 1,
    weekday:
      definition.weekdayNames.length > 0 ? floorMod(dayNumber, definition.daysPerWeek) : null,
  };
}

/**
 * The absolute day number for a calendar date.
 *
 * Out-of-range components are clamped rather than rejected: this is fed by a form where a writer
 * switching from a 31-day month to a 28-day one would otherwise be holding an impossible date while
 * they finish typing.
 */
export function partsToDayNumber(
  definition: CalendarDefinitionType,
  parts: { year: number; month: number; day: number },
): number {
  const { daysPerYear, monthStarts } = mathFor(definition);
  const monthIndex = Math.min(Math.max(parts.month, 1), definition.months.length) - 1;
  const daysBefore = monthStarts[monthIndex];
  const day = Math.min(Math.max(parts.day, 1), definition.months[monthIndex].days);

  return (parts.year - 1) * daysPerYear + daysBefore + (day - 1);
}

/** The era a year falls in, and the year as that era counts it. */
export function calendarEraFor(
  definition: CalendarDefinitionType,
  year: number,
): { name: string; abbreviation: string; year: number } | null {
  const ordered = mathFor(definition).eras;
  const index = lastAtOrBefore(ordered, year, (era) => era.startYear);
  const forward =
    index === -1
      ? undefined
      : [...ordered.slice(0, index + 1)].reverse().find((era) => era.direction !== 'backward');
  if (forward) {
    return {
      name: forward.name,
      abbreviation: forward.abbreviation,
      year: year - forward.startYear + 1,
    };
  }

  // A backward era beginning at year 1 reads year 0 as "1 B.C." and year -399 as "400 B.C.".
  const backward = ordered.find((era) => era.direction === 'backward' && era.startYear > year);
  if (!backward) return null;
  return {
    name: backward.name,
    abbreviation: backward.abbreviation,
    year: backward.startYear - year,
  };
}

/** How many named phases a moon is bucketed into for display. */
export const MOON_PHASE_COUNT = 8;

export interface CalendarMoonPhase {
  name: string;
  /** 0 at new, rising to 1 just before the next new. */
  fraction: number;
  /** 0..7, where 0 is new and 4 is full. Indexes the `moon_phase_*` labels. */
  phase: number;
}

/**
 * Where each of the calendar's moons is on a given day.
 *
 * Purely informative: a writer reads it to situate a scene, and never writes it. See the module
 * docs for why that constraint is what makes this five lines instead of a subsystem.
 */
export function calendarMoonPhases(
  definition: CalendarDefinitionType,
  dayNumber: number,
): CalendarMoonPhase[] {
  return definition.moons.map((moon: CalendarMoonType) => {
    const fraction = floorMod(dayNumber - moon.referenceDay, moon.periodDays) / moon.periodDays;
    return {
      name: moon.name,
      fraction,
      // Rounded rather than floored so that "full" is centred on the halfway point rather than
      // starting at it - a moon one day past full should still read as full.
      phase: Math.round(fraction * MOON_PHASE_COUNT) % MOON_PHASE_COUNT,
    };
  });
}

/**
 * The season a day of the year falls in.
 *
 * A day before the first declared start belongs to the **last** season, which is the one that began
 * late in the previous year and has not ended yet. Without that wrap, a winter spanning New Year
 * would leave the first weeks of the year with no season at all.
 */
export function calendarSeasonFor(
  definition: CalendarDefinitionType,
  dayOfYear: number,
): CalendarSeasonType | null {
  if (definition.seasons.length === 0) return null;
  const ordered = mathFor(definition).seasons;
  const index = lastAtOrBefore(ordered, dayOfYear, (season) => season.startDayOfYear);
  const found: CalendarSeasonType | undefined = index === -1 ? undefined : ordered[index];
  return found ?? ordered[ordered.length - 1];
}

/**
 * A day number written the way the calendar would write it: `14 Harvest, 3019 T.A.`
 *
 * No translated words are involved, and none should be: every name in the output comes from the
 * calendar the writer defined. A calendar with no eras drops the last part, and one whose months
 * are unnamed falls back to the month's number, because a blank in the middle of a date reads as a
 * bug rather than as an omission.
 */
export function formatCalendarDate(definition: CalendarDefinitionType, dayNumber: number): string {
  const parts = dayNumberToParts(definition, dayNumber);
  const month = definition.months[parts.month - 1]?.name?.trim();
  const era = calendarEraFor(definition, parts.year);
  const head = `${parts.day} ${month || parts.month}`;
  return era ? `${head}, ${era.year} ${era.abbreviation}` : `${head}, ${parts.year}`;
}

/**
 * The day a scene falls on, given where the story starts.
 *
 * `elapsedSeconds` is what the timeline already measured to lay the scene out, so this is a change
 * of unit rather than a second traversal - and it means the dates cannot drift from the drawing.
 */
export function dayNumberForElapsed(
  definition: CalendarDefinitionType,
  epochDay: number,
  elapsedSeconds: number,
  epochSeconds = 0,
): number {
  return epochDay + Math.floor((epochSeconds + elapsedSeconds) / calendarSecondsPerDay(definition));
}
