/**
 * Calendar arithmetic for the age rule. A date of birth is a calendar date, not an instant: it is compared with the
 * calendar date of the decision, in UTC, so the answer does not depend on the machine's time zone. The rule is "the
 * holder has reached 18 when the 18th birthday has come", so a person born on 12 October is 18 from 12 October, and
 * 17 on 11 October.
 */

export const ADULT_AGE = 18;

export interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export const isLeapYear = (year: number): boolean =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

const daysInMonth = (year: number, month: number): number =>
  month === 2 ? (isLeapYear(year) ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31;

/** `YYYY-MM-DD` as a real calendar date, or undefined (a 31 April or a 1 13 is not a date). */
export function parseCalendarDate(text: string): CalendarDate | undefined {
  const match = DATE_PATTERN.exec(text);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return undefined;
  return { year, month, day };
}

/**
 * Whole years the holder has completed on `on`. A person born on 29 February has their birthday on 1 March in the
 * years without a 29 February: the later of the two days, so that the rule never makes anyone an adult early.
 */
export function ageOn(dateOfBirth: CalendarDate, on: Date): number {
  const today: CalendarDate = {
    year: on.getUTCFullYear(),
    month: on.getUTCMonth() + 1,
    day: on.getUTCDate(),
  };
  const leapBirthdayMissing =
    dateOfBirth.month === 2 && dateOfBirth.day === 29 && !isLeapYear(today.year);
  const birthMonth = leapBirthdayMissing ? 3 : dateOfBirth.month;
  const birthDay = leapBirthdayMissing ? 1 : dateOfBirth.day;

  let years = today.year - dateOfBirth.year;
  if (today.month < birthMonth || (today.month === birthMonth && today.day < birthDay)) years -= 1;
  return years;
}

export const isAdultOn = (dateOfBirth: CalendarDate, on: Date): boolean =>
  ageOn(dateOfBirth, on) >= ADULT_AGE;
