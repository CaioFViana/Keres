import { CalendarDefinitionSchema } from '@keres/shared';
import {
  clampCoordinate,
  daysInMonthOf,
  defaultCoordinate,
  describeCoordinate,
  eraStartYearFor,
  hoursPerDayOf,
  minutesPerHourOf,
  monthCountOf,
  monthOptions,
} from '@/src/utils/calendar/calendarDateFields';

/** Thirteen months of 28 days, a 20-hour day of 50-minute hours, a named week, eras, a season and a moon. */
const invented = CalendarDefinitionSchema.parse({
  daysPerWeek: 4,
  weekdayNames: ['Ash', 'Bone', 'Clay', 'Dusk'],
  hoursPerDay: 20,
  minutesPerHour: 50,
  months: Array.from({ length: 13 }, (_, index) => ({
    name: index === 12 ? '' : `Moon ${index + 1}`,
    days: 28,
  })),
  eras: [
    { name: 'Old Age', abbreviation: 'O.A.', startYear: -2000, direction: 'forward' },
    { name: 'New Age', abbreviation: 'N.A.', startYear: 1, direction: 'forward' },
  ],
  seasons: [
    { name: 'Thaw', startDayOfYear: 1 },
    { name: 'Frost', startDayOfYear: 200 },
  ],
  moons: [{ name: 'Selene', periodDays: 28, referenceDay: 0 }],
});

describe('calendar sizes', () => {
  it('reads them from the definition, and from the Gregorian clock without one', () => {
    expect(monthCountOf(invented)).toBe(13);
    expect(hoursPerDayOf(invented)).toBe(20);
    expect(minutesPerHourOf(invented)).toBe(50);
    expect(monthCountOf(null)).toBe(12);
    expect(hoursPerDayOf(null)).toBe(24);
    expect(minutesPerHourOf(null)).toBe(60);
  });

  it('gives a custom month the same length every year, and Gregorian its leap days', () => {
    expect(daysInMonthOf(invented, 5, 13)).toBe(28);
    expect(daysInMonthOf(invented, -400, 1)).toBe(28);
    expect(daysInMonthOf(null, 2023, 2)).toBe(28);
    expect(daysInMonthOf(null, 2024, 2)).toBe(29);
    expect(daysInMonthOf(null, 1900, 2)).toBe(28);
    expect(daysInMonthOf(null, 2000, 2)).toBe(29);
    expect(daysInMonthOf(null, 2023, 4)).toBe(30);
  });
});

describe('clampCoordinate', () => {
  const at = (year: number, month: number, day: number, hour = 0, minute = 0) => ({
    year,
    month,
    day,
    hour,
    minute,
  });

  it('leaves a date that exists alone', () => {
    expect(clampCoordinate(invented, at(-400, 13, 28, 19, 49))).toEqual(at(-400, 13, 28, 19, 49));
    expect(clampCoordinate(null, at(2024, 2, 29, 23, 59))).toEqual(at(2024, 2, 29, 23, 59));
  });

  it('pulls a day the month does not have to its last day', () => {
    expect(clampCoordinate(null, at(2023, 2, 31))).toEqual(at(2023, 2, 28));
    expect(clampCoordinate(null, at(2023, 4, 31))).toEqual(at(2023, 4, 30));
    expect(clampCoordinate(invented, at(1, 1, 30))).toEqual(at(1, 1, 28));
  });

  it('keeps the 29th of February only in a leap year', () => {
    expect(clampCoordinate(null, at(2023, 2, 29))).toEqual(at(2023, 2, 28));
    expect(clampCoordinate(null, at(2024, 2, 29))).toEqual(at(2024, 2, 29));
  });

  it('pulls a month, an hour or a minute the calendar lacks to its edge', () => {
    expect(clampCoordinate(null, at(2023, 13, 1)).month).toBe(12);
    expect(clampCoordinate(invented, at(1, 14, 1)).month).toBe(13);
    expect(clampCoordinate(invented, at(1, 1, 1, 23, 59))).toEqual(at(1, 1, 1, 19, 49));
    expect(clampCoordinate(null, at(1, 1, 1, 30, 90))).toEqual(at(1, 1, 1, 23, 59));
  });

  it('never goes below the first day, month, hour or minute', () => {
    expect(clampCoordinate(invented, at(1, 0, 0, -1, -1))).toEqual(at(1, 1, 1, 0, 0));
  });

  it('adapts a date to another calendar when the writer changes it', () => {
    // 13th month, day 28, hour 19 of the invented calendar, read as Gregorian.
    expect(clampCoordinate(null, at(1500, 13, 28, 19, 49))).toEqual(at(1500, 12, 28, 19, 49));
  });
});

describe('defaultCoordinate', () => {
  it('is the first moment of year one', () => {
    expect(defaultCoordinate()).toEqual({ year: 1, month: 1, day: 1, hour: 0, minute: 0 });
  });
});

describe('monthOptions', () => {
  it('lists a custom calendar by its own names, numbering the unnamed month', () => {
    const options = monthOptions(invented, 'en');

    expect(options).toHaveLength(13);
    expect(options[0]).toEqual({ label: 'Moon 1', value: '1' });
    expect(options[12]).toEqual({ label: '13', value: '13' });
  });

  it('lists the twelve Gregorian months in the language of the app', () => {
    const english = monthOptions(null, 'en');
    const portuguese = monthOptions(null, 'pt');

    expect(english).toHaveLength(12);
    expect(english[0].label.toLowerCase()).toBe('january');
    expect(portuguese[0].label.toLowerCase()).toBe('janeiro');
    expect(english[11].value).toBe('12');
  });
});

describe('eraStartYearFor', () => {
  it('finds the era a year is in, whatever order they were declared in', () => {
    expect(eraStartYearFor(invented, 300)).toBe(1);
    expect(eraStartYearFor(invented, -5)).toBe(-2000);
    expect(eraStartYearFor(invented, 1)).toBe(1);
  });

  it('has none before the first era, or without eras or a calendar', () => {
    expect(eraStartYearFor(invented, -3000)).toBeNull();
    expect(eraStartYearFor(null, 5)).toBeNull();
    expect(
      eraStartYearFor(CalendarDefinitionSchema.parse({ months: [{ name: 'One', days: 30 }] }), 5),
    ).toBeNull();
  });
});

describe('describeCoordinate', () => {
  it('writes a custom date as the calendar would, with its week, season and moon', () => {
    // Year 1, month 1, day 1 is day number 0: weekday 0, the first day of the year, a new moon.
    const description = describeCoordinate(invented, { year: 1, month: 1, day: 1 }, 'en');

    expect(description.date).toBe('1 Moon 1, 1 N.A.');
    expect(description.weekday).toBe('Ash');
    expect(description.season).toBe('Thaw');
    expect(description.moons).toEqual([{ name: 'Selene', phase: 0 }]);
  });

  it('follows the week through the year', () => {
    expect(describeCoordinate(invented, { year: 1, month: 1, day: 3 }, 'en').weekday).toBe('Clay');
    expect(describeCoordinate(invented, { year: 1, month: 1, day: 5 }, 'en').weekday).toBe('Ash');
  });

  it('writes a Gregorian date with its weekday and no season or moons', () => {
    const description = describeCoordinate(null, { year: 2023, month: 1, day: 1 }, 'en', 'iso');

    expect(description.date).toBe('2023-01-01');
    expect(description.weekday).toBe('Sun');
    expect(description.season).toBeNull();
    expect(description.moons).toEqual([]);
  });

  it('writes a Gregorian date in the format asked for', () => {
    expect(describeCoordinate(null, { year: 2023, month: 3, day: 9 }, 'en', 'dmy').date).toBe(
      '09/03/2023',
    );
  });

  it('says nothing about the weekday of a calendar that names no days', () => {
    const unnamed = CalendarDefinitionSchema.parse({ months: [{ name: 'One', days: 30 }] });

    expect(describeCoordinate(unnamed, { year: 1, month: 1, day: 1 }, 'en').weekday).toBeNull();
  });
});
