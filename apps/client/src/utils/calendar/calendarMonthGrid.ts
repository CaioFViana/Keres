import {
  dayNumberToParts,
  gregorianDayNumber,
  gregorianPartsFromDayNumber,
  partsToDayNumber,
} from '@keres/shared';
import { type CalendarOrGregorian, daysInMonthOf, monthCountOf } from './calendarDateFields';

/** Gregorian day zero is 0001-01-01, a Monday; the weekday labels start on Sunday. */
const GREGORIAN_DAY_ZERO_COLUMN = 1;
const GREGORIAN_DAYS_PER_WEEK = 7;

export interface CalendarDay {
  year: number;
  month: number;
  day: number;
}

export interface MonthWeeks {
  /** Rows of day numbers; the days before and after the month are the neighbouring months'. */
  weeks: number[][];
  daysPerWeek: number;
}

export function dayNumberOf(calendar: CalendarOrGregorian, parts: CalendarDay): number {
  return calendar
    ? partsToDayNumber(calendar, parts)
    : gregorianDayNumber({
        year: parts.year,
        month: parts.month,
        day: Math.min(parts.day, daysInMonthOf(null, parts.year, parts.month)),
      });
}

export function dayPartsOf(calendar: CalendarOrGregorian, dayNumber: number): CalendarDay {
  const { year, month, day } = calendar
    ? dayNumberToParts(calendar, dayNumber)
    : gregorianPartsFromDayNumber(dayNumber);
  return { year, month, day };
}

/**
 * The month laid out in rows of the calendar's own week length.
 *
 * The column of a day is its number modulo the week, shifted for Gregorian: its day zero is a Monday
 * and its week starts on Sunday, so counting from zero alone shows every month one column early.
 */
export function calendarMonthWeeks(
  calendar: CalendarOrGregorian,
  year: number,
  month: number,
): MonthWeeks {
  const daysPerWeek = calendar?.daysPerWeek ?? GREGORIAN_DAYS_PER_WEEK;
  const first = dayNumberOf(calendar, { year, month, day: 1 });
  const length = daysInMonthOf(calendar, year, month);
  const shift = calendar ? 0 : GREGORIAN_DAY_ZERO_COLUMN;
  const offset = (((first + shift) % daysPerWeek) + daysPerWeek) % daysPerWeek;

  const weeks: number[][] = [];
  let week: number[] = Array.from({ length: offset }, (_, index) => first - offset + index);
  for (let day = 0; day < length; day += 1) {
    week.push(first + day);
    if (week.length === daysPerWeek) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    let next = first + length;
    while (week.length < daysPerWeek) {
      week.push(next);
      next += 1;
    }
    weeks.push(week);
  }
  return { weeks, daysPerWeek };
}

/** The month before or after, wrapping the year at the calendar's own month count. */
export function shiftMonth(
  calendar: CalendarOrGregorian,
  year: number,
  month: number,
  direction: 1 | -1,
): { year: number; month: number } {
  const months = monthCountOf(calendar);
  const zeroBased = month - 1 + direction;
  return {
    year: year + Math.floor(zeroBased / months),
    month: (((zeroBased % months) + months) % months) + 1,
  };
}
