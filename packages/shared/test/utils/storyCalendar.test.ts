import { describe, expect, it } from 'vitest';
import { CalendarDefinitionSchema } from '../../schemas/StoryCalendarSchemas';
import {
  calendarCarryChain,
  calendarDaysPerYear,
  calendarEraFor,
  calendarMoonPhases,
  calendarSeasonFor,
  calendarSecondsPerDay,
  calendarUnitDays,
  dayNumberForElapsed,
  dayNumberToParts,
  FALLBACK_UNIT_DAYS,
  formatCalendarDate,
  partsToDayNumber,
} from '../../utils/storyCalendar';

/** A clean invented calendar: 10 months of 30 days, a 6-day week. */
const define = (overrides: Record<string, unknown> = {}) =>
  CalendarDefinitionSchema.parse({
    daysPerWeek: 6,
    weekdayNames: ['A', 'B', 'C', 'D', 'E', 'F'],
    months: Array.from({ length: 10 }, (_, index) => ({ name: `M${index + 1}`, days: 30 })),
    ...overrides,
  });

describe('the definition schema', () => {
  it('defaults the sub-day ratios to the clock the app already had', () => {
    const definition = define();

    expect(definition.secondsPerMinute).toBe(60);
    expect(definition.minutesPerHour).toBe(60);
    expect(definition.hoursPerDay).toBe(24);
  });

  it('refuses weekday names that do not match the length of the week', () => {
    expect(() =>
      CalendarDefinitionSchema.parse({
        daysPerWeek: 6,
        weekdayNames: ['A', 'B'],
        months: [{ name: 'One', days: 30 }],
      }),
    ).toThrow();
  });

  it('allows a calendar that names no days at all', () => {
    expect(() =>
      CalendarDefinitionSchema.parse({ daysPerWeek: 6, months: [{ name: 'One', days: 30 }] }),
    ).not.toThrow();
  });

  it('refuses a season starting on a day the year does not have', () => {
    expect(() =>
      CalendarDefinitionSchema.parse({
        months: [{ name: 'One', days: 30 }],
        seasons: [{ name: 'Late', startDayOfYear: 400 }],
      }),
    ).toThrow();
  });

  it('refuses a calendar with no months, since a year would be zero days', () => {
    expect(() => CalendarDefinitionSchema.parse({ months: [] })).toThrow();
  });
});

describe('derived lengths', () => {
  it('sums the months rather than storing a total', () => {
    expect(calendarDaysPerYear(define())).toBe(300);
    expect(
      calendarDaysPerYear(
        define({
          months: [
            { name: 'Short', days: 28 },
            { name: 'Long', days: 40 },
          ],
        }),
      ),
    ).toBe(68);
  });

  it('multiplies the sub-day ratios out', () => {
    expect(calendarSecondsPerDay(define())).toBe(86_400);
    expect(
      calendarSecondsPerDay(define({ hoursPerDay: 20, minutesPerHour: 50, secondsPerMinute: 50 })),
    ).toBe(50_000);
  });
});

describe('unit lengths', () => {
  it('falls back to the Gregorian averages when a story has no calendar', () => {
    expect(calendarUnitDays(null)).toEqual(FALLBACK_UNIT_DAYS);
    expect(calendarUnitDays(undefined).years).toBeCloseTo(365.25, 5);
  });

  it('measures a week and a year from the calendar', () => {
    const units = calendarUnitDays(define());

    expect(units.weeks).toBe(6);
    expect(units.years).toBe(300);
    expect(units.months).toBe(30);
  });

  it('keeps millennia and eons as decimal magnitudes of the calendar year', () => {
    const units = calendarUnitDays(define());

    expect(units.millennia).toBe(300 * 1000);
    expect(units.eons).toBe(300 * 1_000_000_000);
  });

  it('rescales the sub-day units when the clock is redefined', () => {
    const units = calendarUnitDays(
      define({ hoursPerDay: 10, minutesPerHour: 100, secondsPerMinute: 100 }),
    );

    // A day is a day whatever the clock; the parts of it move together.
    expect(units.days).toBe(1);
    expect(units.hours).toBeCloseTo(1 / 10, 10);
    expect(units.minutes).toBeCloseTo(1 / 1000, 10);
    expect(units.seconds).toBeCloseTo(1 / 100_000, 10);
  });
});

describe('the carry chain', () => {
  it('reads every step from the calendar', () => {
    const chain = calendarCarryChain(define());
    const amountOf = (from: string) => chain.find((step) => step.from === from)?.amount;

    expect(amountOf('days')).toBe(6);
    expect(amountOf('months')).toBe(10);
    // 30-day months over a 6-day week: five weeks make a month.
    expect(amountOf('weeks')).toBe(5);
  });

  it('carries the redefined clock', () => {
    const chain = calendarCarryChain(define({ hoursPerDay: 10, minutesPerHour: 100 }));
    const amountOf = (from: string) => chain.find((step) => step.from === from)?.amount;

    expect(amountOf('minutes')).toBe(100);
    expect(amountOf('hours')).toBe(10);
  });

  it("keeps the app's current chain when there is no calendar", () => {
    const chain = calendarCarryChain(null);

    expect(chain.map((step) => step.amount)).toEqual([60, 60, 24, 7, 4, 12, 1000]);
  });

  it('never carries by less than one, whatever the month length', () => {
    // A week longer than a month would otherwise produce a zero carry and an infinite loop.
    const chain = calendarCarryChain(
      define({ daysPerWeek: 40, weekdayNames: [], months: [{ name: 'Tiny', days: 5 }] }),
    );

    expect(chain.find((step) => step.from === 'weeks')?.amount).toBeGreaterThanOrEqual(1);
  });
});

describe('day numbers and dates', () => {
  it('puts day zero on the first day of year one', () => {
    expect(dayNumberToParts(define(), 0)).toMatchObject({
      year: 1,
      month: 1,
      day: 1,
      dayOfYear: 1,
    });
  });

  it('walks into the right month', () => {
    // 10 months of 30: day 65 is the 6th of the third month.
    expect(dayNumberToParts(define(), 65)).toMatchObject({ year: 1, month: 3, day: 6 });
  });

  it('handles uneven months', () => {
    const definition = define({
      months: [
        { name: 'Short', days: 10 },
        { name: 'Long', days: 50 },
      ],
    });

    expect(dayNumberToParts(definition, 9)).toMatchObject({ month: 1, day: 10 });
    expect(dayNumberToParts(definition, 10)).toMatchObject({ month: 2, day: 1 });
    expect(dayNumberToParts(definition, 59)).toMatchObject({ month: 2, day: 50 });
    expect(dayNumberToParts(definition, 60)).toMatchObject({ year: 2, month: 1, day: 1 });
  });

  it('runs backwards past year one without breaking', () => {
    // The ghost-anchor case: an era long before anything the story shows.
    expect(dayNumberToParts(define(), -1)).toMatchObject({ year: 0, month: 10, day: 30 });
    expect(dayNumberToParts(define(), -300)).toMatchObject({ year: 0, month: 1, day: 1 });
    expect(dayNumberToParts(define(), -301)).toMatchObject({ year: -1, month: 10, day: 30 });
  });

  it('round-trips a date back to its day number', () => {
    const definition = define();
    for (const day of [0, 65, 299, 300, -1, -455]) {
      const parts = dayNumberToParts(definition, day);
      expect(partsToDayNumber(definition, parts)).toBe(day);
    }
  });

  it('clamps an impossible day rather than rejecting it', () => {
    const definition = define({
      months: [
        { name: 'Short', days: 10 },
        { name: 'Long', days: 50 },
      ],
    });

    // Day 40 of a 10-day month: a writer mid-edit, not a corrupt value.
    expect(partsToDayNumber(definition, { year: 1, month: 1, day: 40 })).toBe(9);
    expect(partsToDayNumber(definition, { year: 1, month: 99, day: 1 })).toBe(10);
  });

  it('names the weekday only when the calendar names its days', () => {
    expect(dayNumberToParts(define(), 7).weekday).toBe(1);
    expect(dayNumberToParts(define({ weekdayNames: [] }), 7).weekday).toBeNull();
  });
});

describe('eras', () => {
  const withEras = define({
    eras: [
      { name: 'First Age', abbreviation: 'F.A.', startYear: 1 },
      { name: 'Third Age', abbreviation: 'T.A.', startYear: 500 },
    ],
  });

  it('counts the year from the era it falls in', () => {
    expect(calendarEraFor(withEras, 500)).toEqual({
      name: 'Third Age',
      abbreviation: 'T.A.',
      year: 1,
    });
    expect(calendarEraFor(withEras, 3518)?.year).toBe(3019);
  });

  it('uses the earlier era for a year before the later one begins', () => {
    expect(calendarEraFor(withEras, 499)?.abbreviation).toBe('F.A.');
  });

  it('has nothing to say about a year before every era, or with no eras at all', () => {
    expect(calendarEraFor(withEras, 0)).toBeNull();
    expect(calendarEraFor(define(), 5)).toBeNull();
  });

  it('does not depend on the eras being declared in order', () => {
    const unordered = define({
      eras: [
        { name: 'Third Age', abbreviation: 'T.A.', startYear: 500 },
        { name: 'First Age', abbreviation: 'F.A.', startYear: 1 },
      ],
    });

    expect(calendarEraFor(unordered, 600)?.abbreviation).toBe('T.A.');
  });
});

describe('moons', () => {
  const withMoon = define({ moons: [{ name: 'Selene', periodDays: 20, referenceDay: 0 }] });

  it('is new on its reference day and full halfway through', () => {
    expect(calendarMoonPhases(withMoon, 0)[0]).toMatchObject({ phase: 0, fraction: 0 });
    expect(calendarMoonPhases(withMoon, 10)[0]).toMatchObject({ phase: 4, fraction: 0.5 });
  });

  it('repeats every period', () => {
    expect(calendarMoonPhases(withMoon, 20)[0].phase).toBe(0);
    expect(calendarMoonPhases(withMoon, 30)[0].phase).toBe(4);
  });

  it('works before the reference day', () => {
    expect(calendarMoonPhases(withMoon, -10)[0]).toMatchObject({ phase: 4 });
    expect(calendarMoonPhases(withMoon, -20)[0]).toMatchObject({ phase: 0 });
  });

  it('never reports the eighth bucket, which is the next new moon', () => {
    const phases = Array.from(
      { length: 40 },
      (_, day) => calendarMoonPhases(withMoon, day)[0].phase,
    );

    expect(Math.max(...phases)).toBeLessThan(8);
  });

  it('tracks several moons independently', () => {
    const twoMoons = define({
      moons: [
        { name: 'Fast', periodDays: 10, referenceDay: 0 },
        { name: 'Slow', periodDays: 100, referenceDay: 0 },
      ],
    });
    const [fast, slow] = calendarMoonPhases(twoMoons, 5);

    expect(fast).toMatchObject({ name: 'Fast', fraction: 0.5 });
    expect(slow.fraction).toBeCloseTo(0.05, 10);
  });

  it('accepts a fractional period', () => {
    const fractional = define({ moons: [{ name: 'Odd', periodDays: 29.5, referenceDay: 0 }] });

    expect(calendarMoonPhases(fractional, 59)[0].fraction).toBeCloseTo(0, 10);
  });

  it('says nothing for a calendar with no moons', () => {
    expect(calendarMoonPhases(define(), 5)).toEqual([]);
  });
});

describe('seasons', () => {
  const withSeasons = define({
    seasons: [
      { name: 'Spring', startDayOfYear: 1 },
      { name: 'Summer', startDayOfYear: 76 },
      { name: 'Winter', startDayOfYear: 226 },
    ],
  });

  it('picks the last season that has started', () => {
    expect(calendarSeasonFor(withSeasons, 1)?.name).toBe('Spring');
    expect(calendarSeasonFor(withSeasons, 75)?.name).toBe('Spring');
    expect(calendarSeasonFor(withSeasons, 76)?.name).toBe('Summer');
    expect(calendarSeasonFor(withSeasons, 300)?.name).toBe('Winter');
  });

  it('wraps a year that opens mid-season back to the one still running', () => {
    // Nothing starts on day 1 here, so the first days belong to the season that began in the
    // previous year - without the wrap they would have no season at all.
    const lateStart = define({
      seasons: [
        { name: 'Thaw', startDayOfYear: 50 },
        { name: 'Frost', startDayOfYear: 200 },
      ],
    });

    expect(calendarSeasonFor(lateStart, 1)?.name).toBe('Frost');
    expect(calendarSeasonFor(lateStart, 49)?.name).toBe('Frost');
    expect(calendarSeasonFor(lateStart, 50)?.name).toBe('Thaw');
  });

  it('does not depend on the seasons being declared in order', () => {
    const unordered = define({
      seasons: [
        { name: 'Winter', startDayOfYear: 226 },
        { name: 'Spring', startDayOfYear: 1 },
      ],
    });

    expect(calendarSeasonFor(unordered, 100)?.name).toBe('Spring');
  });

  it('says nothing for a calendar with no seasons', () => {
    expect(calendarSeasonFor(define(), 100)).toBeNull();
  });
});

describe('writing a date', () => {
  const named = define({
    months: [
      { name: 'Thaw', days: 30 },
      { name: 'Harvest', days: 30 },
    ],
    eras: [{ name: 'Third Age', abbreviation: 'T.A.', startYear: 1 }],
  });

  it('writes the day, the month name and the era', () => {
    expect(formatCalendarDate(named, 0)).toBe('1 Thaw, 1 T.A.');
    expect(formatCalendarDate(named, 43)).toBe('14 Harvest, 1 T.A.');
  });

  it('counts the year from the era it falls in', () => {
    const laterEra = define({
      months: [{ name: 'Thaw', days: 100 }],
      eras: [{ name: 'Third Age', abbreviation: 'T.A.', startYear: 500 }],
    });

    // Absolute year 3518, which the Third Age calls 3019.
    expect(formatCalendarDate(laterEra, 3517 * 100)).toBe('1 Thaw, 3019 T.A.');
  });

  it('counts backward eras before their anchor year', () => {
    const beforeCommon = define({
      months: [{ name: 'Thaw', days: 100 }],
      eras: [
        { name: 'Common Era', abbreviation: 'C.E.', startYear: 1 },
        { name: 'Before Common Era', abbreviation: 'B.C.', startYear: 1, direction: 'backward' },
      ],
    });

    expect(formatCalendarDate(beforeCommon, -1)).toBe('100 Thaw, 1 B.C.');
    expect(formatCalendarDate(beforeCommon, -400 * 100)).toBe('1 Thaw, 400 B.C.');
    expect(calendarEraFor(beforeCommon, 1)?.abbreviation).toBe('C.E.');
  });

  it('falls back to the absolute year when no era covers it', () => {
    expect(formatCalendarDate(define(), 0)).toBe('1 M1, 1');
  });

  it('falls back to the month number when the month has no name', () => {
    // A blank in the middle of a date reads as a bug rather than as an omission.
    const unnamed = define({ months: [{ name: '   ', days: 30 }] });

    expect(formatCalendarDate(unnamed, 0)).toBe('1 1, 1');
  });
});

describe('elapsed time to a day number', () => {
  it('adds whole days to the epoch', () => {
    const definition = define();

    expect(dayNumberForElapsed(definition, 100, 0)).toBe(100);
    expect(dayNumberForElapsed(definition, 100, 86_400)).toBe(101);
    // Part of a day does not advance it: a scene two hours in is still that day.
    expect(dayNumberForElapsed(definition, 100, 7_200)).toBe(100);
  });

  it("counts in the calendar's own seconds", () => {
    const shortDay = define({ hoursPerDay: 10, minutesPerHour: 10, secondsPerMinute: 10 });

    expect(dayNumberForElapsed(shortDay, 0, 1_000)).toBe(1);
    expect(dayNumberForElapsed(shortDay, 0, 999)).toBe(0);
  });
});

describe('a calendar being typed', () => {
  /*
   * The form starts with two blank months, which is the only sensible thing for it to start with.
   * Requiring a month name made `CalendarDefinitionSchema.parse` throw inside the screen's state
   * initialiser, so the screen crashed on mount and the button that opened it looked inert.
   */
  it('accepts months that have not been named yet', () => {
    expect(() =>
      CalendarDefinitionSchema.parse({
        months: [
          { name: '', days: 30 },
          { name: '', days: 30 },
        ],
      }),
    ).not.toThrow();
  });

  it('still writes a date for an unnamed month, using its number', () => {
    const unnamed = CalendarDefinitionSchema.parse({ months: [{ name: '', days: 30 }] });

    expect(formatCalendarDate(unnamed, 5)).toBe('6 1, 1');
  });
});
