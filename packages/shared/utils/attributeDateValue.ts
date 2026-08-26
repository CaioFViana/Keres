/**
 * A value of `AttributeType.DATE` is a *floating* civil date: it deliberately carries no time zone.
 * `15/01/2024 10:30` is the story's internal time, not an instant in real time - it has to render
 * identically in Brasília, Tokyo and London.
 *
 * That forces three precautions this file centralises, and which no other point of the code should
 * reimplement:
 *
 * 1. The value is NEVER parsed with `new Date(string)`. `new Date('2024-01-15')` is interpreted as
 *    midnight UTC and prints 14/01 in any negative time zone - the classic bug. Here the parser is a
 *    regex that extracts the components.
 * 2. `Date` is only ever built in UTC (`Date.UTC` + `getUTC*`), including to find the day of the
 *    week, and every formatting call passes `timeZone: 'UTC'`. That way the device's time zone
 *    cannot shift anything.
 * 3. `Date.UTC(15, 0, 1)` means 1915, not year 15 - which is why the year is always reapplied with
 *    `setUTCFullYear` after construction.
 */

export interface AttributeDateParts {
  /** 1 a 9999. */
  year: number;
  /** 1 to 12 (not JS's month index). */
  month: number;
  day: number;
  /** `null` in both fields means "date only, no time". */
  hour: number | null;
  minute: number | null;
}

/** `YYYY-MM-DD`, opcionalmente seguido de `THH:mm` (ou ` HH:mm`, aceito na entrada). */
const CANONICAL_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/;

export const MIN_ATTRIBUTE_DATE_YEAR = 1;
export const MAX_ATTRIBUTE_DATE_YEAR = 9999;

/**
 * A `Date` in UTC representing the given components. Kept separate because it is the only safe way
 * to feed `Intl` without the device's time zone entering the arithmetic.
 */
export function toUtcDate(parts: AttributeDateParts): Date {
  const date = new Date(
    Date.UTC(2000, parts.month - 1, parts.day, parts.hour ?? 0, parts.minute ?? 0),
  );
  // Years from 1 to 99 would be remapped to 1901-1999 by `Date.UTC` - reapplying is what avoids that.
  date.setUTCFullYear(parts.year);
  return date;
}

/**
 * The components of a canonical string, or `null` if the string is not a valid date. It rejects an
 * impossible date (30 February) by round-trip, not by numeric range alone.
 */
export function parseAttributeDate(raw: string | null | undefined): AttributeDateParts | null {
  if (!raw) {
    return null;
  }
  const match = CANONICAL_DATE_REGEX.exec(raw.trim());
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hasTime = match[4] !== undefined;
  const hour = hasTime ? Number(match[4]) : null;
  const minute = hasTime ? Number(match[5]) : null;

  if (year < MIN_ATTRIBUTE_DATE_YEAR || year > MAX_ATTRIBUTE_DATE_YEAR) {
    return null;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  if (hasTime && (hour! > 23 || minute! > 59)) {
    return null;
  }

  const parts: AttributeDateParts = { year, month, day, hour, minute };
  const utc = toUtcDate(parts);
  // 2024-02-30 becomes 2024-03-01 on construction; if the components do not come back identical, the
  // date simply does not exist on the calendar.
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return null;
  }

  return parts;
}

export function isValidAttributeDate(raw: string | null | undefined): boolean {
  return parseAttributeDate(raw) !== null;
}

function pad(value: number, length: number): string {
  return String(value).padStart(length, '0');
}

/** Components → canonical string (`YYYY-MM-DD` or `YYYY-MM-DDTHH:mm`). */
export function formatAttributeDate(parts: AttributeDateParts): string {
  const date = `${pad(parts.year, 4)}-${pad(parts.month, 2)}-${pad(parts.day, 2)}`;
  if (parts.hour === null || parts.minute === null) {
    return date;
  }
  return `${date}T${pad(parts.hour, 2)}:${pad(parts.minute, 2)}`;
}

/** Day of the week, 0 (Sunday) to 6 (Saturday). Immune to time zones because it is read in UTC. */
export function attributeDateWeekday(parts: AttributeDateParts): number {
  return toUtcDate(parts).getUTCDay();
}

/** How many days the month has (`month` from 1 to 12), leap years respected. */
export function daysInMonth(year: number, month: number): number {
  const date = new Date(Date.UTC(2000, 0, 1));
  // The `month` index is already the NEXT month (the API is 0-based), and day 0 of it is the last day
  // of this one.
  date.setUTCFullYear(year, month, 0);
  return date.getUTCDate();
}

function safeFormat(
  language: string,
  options: Intl.DateTimeFormatOptions,
  date: Date,
  fallback: string,
): string {
  try {
    return new Intl.DateTimeFormat(language, { ...options, timeZone: 'UTC' }).format(date);
  } catch {
    // A runtime without full ICU: the canonical string is still readable, better than breaking the screen.
    return fallback;
  }
}

/**
 * A date in the APPLICATION's language (not the device's), always with the day of the week, and with
 * the time only when the value has one. `null` when the string is not a canonical date - the caller
 * decides what to do (the screens show the raw value, so legacy text does not disappear).
 *
 * `use24HourTime` comes from the user's preference (Settings), not from the language: `pt` and `en`
 * have opposite conventions, and the choice is theirs. `undefined` lets the locale decide.
 */
export function formatAttributeDateForDisplay(
  raw: string | null | undefined,
  language: string,
  use24HourTime?: boolean,
): string | null {
  const parts = parseAttributeDate(raw);
  if (!parts) {
    return null;
  }

  const utc = toUtcDate(parts);
  const canonical = formatAttributeDate(parts);
  const hasTime = parts.hour !== null && parts.minute !== null;

  return safeFormat(
    language,
    {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      ...(hasTime
        ? {
            hour: '2-digit',
            minute: '2-digit',
            ...(use24HourTime === undefined ? {} : { hour12: !use24HourTime }),
          }
        : {}),
    },
    utc,
    canonical,
  );
}

/**
 * Wall-clock hour from an hour of 0 to 23: in 24h it returns the same; in AM/PM it returns 1 to 12
 * plus the period. It exists so the picker's hour field shows what the person expects, without the
 * canonical value (always 0-23) changing shape.
 */
export function toClockHour(
  hour24: number,
  use24HourTime: boolean,
): { hour: number; isPm: boolean } {
  if (use24HourTime) {
    return { hour: hour24, isPm: hour24 >= 12 };
  }
  const isPm = hour24 >= 12;
  const hour = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { hour, isPm };
}

/** The inverse of `toClockHour`: clock hour (1-12 with a period, or 0-23) to 0-23. */
export function fromClockHour(hour: number, isPm: boolean, use24HourTime: boolean): number {
  if (use24HourTime) {
    return clampHour(hour);
  }
  const base = hour % 12; // 12 AM -> 0, 12 PM -> 12
  return clampHour(isPm ? base + 12 : base);
}

function clampHour(hour: number): number {
  return Math.min(23, Math.max(0, hour));
}

/** Short month + year label for the calendar's header ("January 2024"). */
export function formatAttributeDateMonthLabel(
  year: number,
  month: number,
  language: string,
): string {
  const utc = toUtcDate({ year, month, day: 1, hour: null, minute: null });
  return safeFormat(
    language,
    { year: 'numeric', month: 'long' },
    utc,
    `${pad(year, 4)}-${pad(month, 2)}`,
  );
}

/**
 * Initials/abbreviations of the 7 days of the week in the app's language, starting on Sunday (the
 * same order as `attributeDateWeekday`). Derived from `Intl` instead of written by hand in each
 * translation file.
 */
export function attributeDateWeekdayLabels(language: string): string[] {
  // 2023-01-01 was a Sunday - an arbitrary anchor, only to walk the 7 days.
  return Array.from({ length: 7 }, (_, index) => {
    const utc = new Date(Date.UTC(2023, 0, 1 + index));
    return safeFormat(language, { weekday: 'short' }, utc, String(index));
  });
}
