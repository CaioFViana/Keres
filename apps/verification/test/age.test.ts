import { describe, expect, it } from 'vitest';
import { ageOn, isAdultOn, isLeapYear, parseCalendarDate } from '../src/age';

const on = (iso: string): Date => new Date(`${iso}T12:00:00Z`);
const dob = (text: string) => {
  const parsed = parseCalendarDate(text);
  if (!parsed) throw new Error(`not a date: ${text}`);
  return parsed;
};

describe('calendar dates', () => {
  it('accepts real calendar dates, leap days included', () => {
    expect(parseCalendarDate('2000-02-29')).toEqual({ year: 2000, month: 2, day: 29 });
    expect(parseCalendarDate('2026-12-31')).toEqual({ year: 2026, month: 12, day: 31 });
  });

  it('refuses what is not a calendar date', () => {
    expect(parseCalendarDate('2026-02-29')).toBeUndefined();
    expect(parseCalendarDate('1900-02-29')).toBeUndefined();
    expect(parseCalendarDate('2026-04-31')).toBeUndefined();
    expect(parseCalendarDate('2026-13-01')).toBeUndefined();
    expect(parseCalendarDate('2026-00-10')).toBeUndefined();
    expect(parseCalendarDate('2026-1-01')).toBeUndefined();
    expect(parseCalendarDate('12/10/2008')).toBeUndefined();
    expect(parseCalendarDate('')).toBeUndefined();
  });

  it('knows the leap years: divisible by 4, except centuries not divisible by 400', () => {
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2026)).toBe(false);
  });
});

describe('the age rule: the birthday has come when the calendar says so', () => {
  it('is 18 on the 18th birthday and 17 the day before', () => {
    expect(isAdultOn(dob('2008-10-12'), on('2026-10-12'))).toBe(true);
    expect(isAdultOn(dob('2008-10-12'), on('2026-10-11'))).toBe(false);
    expect(ageOn(dob('2008-10-12'), on('2026-10-11'))).toBe(17);
  });

  it('counts a birthday late in the year against the year, not the age', () => {
    expect(isAdultOn(dob('2008-12-31'), on('2026-12-30'))).toBe(false);
    expect(isAdultOn(dob('2008-12-31'), on('2026-12-31'))).toBe(true);
  });

  it('gives a 29 February birthday in a year without one on 1 March, the later date', () => {
    // 2000-02-29: the 18th birthday is 2018, which has no 29 February.
    expect(isAdultOn(dob('2000-02-29'), on('2018-02-28'))).toBe(false);
    expect(isAdultOn(dob('2000-02-29'), on('2018-03-01'))).toBe(true);
    // In a leap year the birthday is the 29th itself.
    expect(isAdultOn(dob('2000-02-29'), on('2020-02-28'))).toBe(true);
    expect(isAdultOn(dob('2000-02-29'), on('2020-02-29'))).toBe(true);
  });

  it('reads a date of birth in the future as a negative age: not an adult', () => {
    expect(ageOn(dob('2030-01-01'), on('2026-10-12'))).toBe(-4);
    expect(isAdultOn(dob('2030-01-01'), on('2026-10-12'))).toBe(false);
  });

  it('uses the UTC calendar day of the decision, whatever the machine zone', () => {
    // 23:30 UTC on 11 October is still 11 October; the 18th birthday is on the 12th.
    expect(isAdultOn(dob('2008-10-12'), new Date('2026-10-11T23:30:00Z'))).toBe(false);
    expect(isAdultOn(dob('2008-10-12'), new Date('2026-10-12T00:00:00Z'))).toBe(true);
  });
});
