import {
  type CalendarDateCoordinate,
  type CalendarDefinitionType,
  type GregorianDateDisplayFormat,
  attributeDateWeekday,
  attributeDateWeekdayLabels,
  calendarMoonPhases,
  calendarSeasonFor,
  daysInMonth,
  dayNumberToParts,
  formatCalendarDate,
  formatGregorianDate,
  partsToDayNumber,
} from '@keres/shared';

/**
 * The pure half of the story-date inputs. A calendar is a `CalendarDefinitionType`; `null` is the
 * Gregorian calendar, which has no definition of its own (its months, leap years and 24-hour day are
 * the shared `attributeDateValue` helpers').
 */
export type CalendarOrGregorian = CalendarDefinitionType | null;

const GREGORIAN_MONTHS = 12;
const GREGORIAN_HOURS = 24;
const GREGORIAN_MINUTES = 60;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const monthCountOf = (calendar: CalendarOrGregorian): number =>
  calendar ? calendar.months.length : GREGORIAN_MONTHS;

export const hoursPerDayOf = (calendar: CalendarOrGregorian): number =>
  calendar ? calendar.hoursPerDay : GREGORIAN_HOURS;

export const minutesPerHourOf = (calendar: CalendarOrGregorian): number =>
  calendar ? calendar.minutesPerHour : GREGORIAN_MINUTES;

/** How many days a month has; a custom calendar's months do not depend on the year. */
export function daysInMonthOf(calendar: CalendarOrGregorian, year: number, month: number): number {
  if (calendar) return calendar.months[clamp(month, 1, monthCountOf(calendar)) - 1]?.days ?? 1;
  return daysInMonth(year, clamp(month, 1, GREGORIAN_MONTHS));
}

/** The first moment of year one: where a date starts when a writer chooses to set one. */
export const defaultCoordinate = (): CalendarDateCoordinate => ({
  year: 1,
  month: 1,
  day: 1,
  hour: 0,
  minute: 0,
});

/**
 * The nearest date that exists in this calendar.
 *
 * Changing the month, the year or the calendar itself can leave a day the new month does not have
 * (the 31st, a 13th month, the 29th of February, the 25th hour); this keeps the numbers the writer
 * had wherever they still make sense and pulls the rest to the edge, instead of refusing the change.
 */
export function clampCoordinate(
  calendar: CalendarOrGregorian,
  parts: CalendarDateCoordinate,
): CalendarDateCoordinate {
  const month = clamp(parts.month, 1, monthCountOf(calendar));
  return {
    year: parts.year,
    month,
    day: clamp(parts.day, 1, daysInMonthOf(calendar, parts.year, month)),
    hour: clamp(parts.hour, 0, hoursPerDayOf(calendar) - 1),
    minute: clamp(parts.minute, 0, minutesPerHourOf(calendar) - 1),
  };
}

/** Whether every part of the date exists in this calendar - what a retained date may stop being. */
export function coordinateExists(
  calendar: CalendarOrGregorian,
  parts: CalendarDateCoordinate,
): boolean {
  const nearest = clampCoordinate(calendar, parts);
  return (
    nearest.month === parts.month &&
    nearest.day === parts.day &&
    nearest.hour === parts.hour &&
    nearest.minute === parts.minute
  );
}

/** The months to choose from: the calendar's own names, or the app language's for Gregorian. */
export function monthOptions(
  calendar: CalendarOrGregorian,
  language: string,
): { label: string; value: string }[] {
  if (calendar) {
    return calendar.months.map((month, index) => ({
      label: month.name || String(index + 1),
      value: String(index + 1),
    }));
  }
  return Array.from({ length: GREGORIAN_MONTHS }, (_, index) => {
    let label = String(index + 1);
    try {
      label = new Intl.DateTimeFormat(language, { month: 'long', timeZone: 'UTC' }).format(
        new Date(Date.UTC(2000, index, 1)),
      );
    } catch {
      // A runtime without full ICU: the month number is still a month.
    }
    return { label, value: String(index + 1) };
  });
}

/**
 * The `startYear` of the era a year falls in, found here because the era select is keyed by it and
 * `calendarEraFor` reports the era's name and the year counted within it instead.
 */
export function eraStartYearFor(calendar: CalendarOrGregorian, year: number): number | null {
  if (!calendar) return null;
  const era = [...calendar.eras]
    .sort((a, b) => a.startYear - b.startYear)
    .filter((candidate) => candidate.startYear <= year)
    .pop();
  return era ? era.startYear : null;
}

export interface CoordinateDescription {
  /** The date as the calendar writes it ("14 Harvest, 3019 T.A.", or "2023-01-14"). */
  date: string;
  weekday: string | null;
  season: string | null;
  moons: { name: string; phase: number }[];
}

/** A date written out, with what the calendar knows about the day. */
export function describeCoordinate(
  calendar: CalendarOrGregorian,
  parts: Pick<CalendarDateCoordinate, 'year' | 'month' | 'day'>,
  language: string,
  format: GregorianDateDisplayFormat = 'iso',
): CoordinateDescription {
  if (!calendar) {
    const labels = attributeDateWeekdayLabels(language);
    return {
      date: formatGregorianDate(parts, format),
      weekday: labels[attributeDateWeekday({ ...parts, hour: null, minute: null })] ?? null,
      season: null,
      moons: [],
    };
  }
  const dayNumber = partsToDayNumber(calendar, parts);
  const resolved = dayNumberToParts(calendar, dayNumber);
  return {
    date: formatCalendarDate(calendar, dayNumber),
    weekday: resolved.weekday === null ? null : (calendar.weekdayNames[resolved.weekday] ?? null),
    season: calendarSeasonFor(calendar, resolved.dayOfYear)?.name ?? null,
    moons: calendarMoonPhases(calendar, dayNumber).map(({ name, phase }) => ({ name, phase })),
  };
}
