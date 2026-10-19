import { CalendarDefinitionSchema, gregorianDayNumber } from '@keres/shared';
import {
  calendarMonthWeeks,
  dayNumberOf,
  dayPartsOf,
  shiftMonth,
} from '@/src/utils/calendar/calendarMonthGrid';

/** Twelve 30-day months and a 5-day week: every month is exactly six weeks, starting on the same column. */
const tidy = CalendarDefinitionSchema.parse({
  daysPerWeek: 5,
  weekdayNames: ['A', 'B', 'C', 'D', 'E'],
  months: Array.from({ length: 12 }, (_, index) => ({ name: `M${index + 1}`, days: 30 })),
});

/** Thirteen months of 28 days and a 7-day week: months are four weeks, then the 13th. */
const lunar = CalendarDefinitionSchema.parse({
  months: Array.from({ length: 13 }, (_, index) => ({ name: `L${index + 1}`, days: 28 })),
});

describe('dayNumberOf and dayPartsOf', () => {
  it('go back and forth in a custom calendar', () => {
    const day = dayNumberOf(lunar, { year: 3, month: 5, day: 9 });

    expect(dayPartsOf(lunar, day)).toEqual({ year: 3, month: 5, day: 9 });
    expect(dayNumberOf(lunar, { year: 1, month: 1, day: 1 })).toBe(0);
  });

  it('go back and forth in Gregorian, even before year one', () => {
    const day = dayNumberOf(null, { year: 2024, month: 2, day: 29 });

    expect(dayPartsOf(null, day)).toEqual({ year: 2024, month: 2, day: 29 });
    expect(dayPartsOf(null, dayNumberOf(null, { year: -44, month: 3, day: 15 }))).toEqual({
      year: -44,
      month: 3,
      day: 15,
    });
  });

  it('pull a Gregorian day the month lacks to its last day instead of throwing', () => {
    expect(dayPartsOf(null, dayNumberOf(null, { year: 2023, month: 2, day: 31 }))).toEqual({
      year: 2023,
      month: 2,
      day: 28,
    });
  });
});

describe('calendarMonthWeeks, a custom calendar', () => {
  it('starts the first month in the first column and fills whole weeks', () => {
    const { weeks, daysPerWeek } = calendarMonthWeeks(lunar, 1, 1);

    expect(daysPerWeek).toBe(7);
    expect(weeks).toHaveLength(4);
    expect(weeks[0]).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(weeks[3][6]).toBe(27);
  });

  it('shows the days of the neighbouring months in the partial weeks', () => {
    // Month 1 of the tidy calendar has 30 days = 6 weeks of 5, so month 2 starts in column 0 again.
    const first = calendarMonthWeeks(tidy, 1, 1);
    expect(first.weeks).toHaveLength(6);
    expect(first.weeks[5][4]).toBe(29);

    const odd = CalendarDefinitionSchema.parse({
      daysPerWeek: 4,
      months: [
        { name: 'A', days: 6 },
        { name: 'B', days: 6 },
      ],
    });
    const second = calendarMonthWeeks(odd, 1, 2);
    // Month B starts on day 6: column 2 of its first row. The first two cells are month A's last days.
    expect(second.weeks[0]).toEqual([4, 5, 6, 7]);
    expect(second.weeks[1]).toEqual([8, 9, 10, 11]);
  });

  it('puts the months of a later year in the right column', () => {
    // Year 2 of the lunar calendar begins at day 364, which is a multiple of 7.
    const { weeks } = calendarMonthWeeks(lunar, 2, 1);

    expect(weeks[0][0]).toBe(364);
  });

  it('counts every day of the month exactly once, in order', () => {
    const { weeks } = calendarMonthWeeks(lunar, 4, 7);
    const flat = weeks.flat();

    expect(flat.every((day, index) => index === 0 || day === flat[index - 1] + 1)).toBe(true);
    expect(weeks.every((row) => row.length === 7)).toBe(true);
  });
});

describe('calendarMonthWeeks, Gregorian', () => {
  const columnOf = (year: number, month: number, day: number) => {
    const target = gregorianDayNumber({ year, month, day });
    const { weeks } = calendarMonthWeeks(null, year, month);
    return weeks.flat().indexOf(target) % 7;
  };

  it('puts a Sunday in the first column, as the Sunday-first labels expect', () => {
    // 2023-01-01 was a Sunday.
    expect(columnOf(2023, 1, 1)).toBe(0);
    expect(calendarMonthWeeks(null, 2023, 1).weeks[0][0]).toBe(
      gregorianDayNumber({ year: 2023, month: 1, day: 1 }),
    );
  });

  it('puts the other weekdays where they belong', () => {
    // 2024-02-29 was a Thursday, 2000-01-01 a Saturday, 1969-07-20 a Sunday.
    expect(columnOf(2024, 2, 29)).toBe(4);
    expect(columnOf(2000, 1, 1)).toBe(6);
    expect(columnOf(1969, 7, 20)).toBe(0);
  });

  it('puts year one, whose first day was a Monday, in the second column', () => {
    expect(columnOf(1, 1, 1)).toBe(1);
  });

  it('pads February with the neighbouring months and respects the leap day', () => {
    const leap = calendarMonthWeeks(null, 2024, 2).weeks.flat();
    const plain = calendarMonthWeeks(null, 2023, 2).weeks.flat();
    const inFebruary = (days: number[], year: number) =>
      days.filter((day) => dayPartsOf(null, day).month === 2 && dayPartsOf(null, day).year === year)
        .length;

    expect(inFebruary(leap, 2024)).toBe(29);
    expect(inFebruary(plain, 2023)).toBe(28);
  });
});

describe('shiftMonth', () => {
  it('moves one month and wraps the year at the calendar’s own month count', () => {
    expect(shiftMonth(lunar, 3, 13, 1)).toEqual({ year: 4, month: 1 });
    expect(shiftMonth(lunar, 3, 1, -1)).toEqual({ year: 2, month: 13 });
    expect(shiftMonth(lunar, 3, 5, 1)).toEqual({ year: 3, month: 6 });
  });

  it('wraps a Gregorian year at twelve', () => {
    expect(shiftMonth(null, 2023, 12, 1)).toEqual({ year: 2024, month: 1 });
    expect(shiftMonth(null, 2023, 1, -1)).toEqual({ year: 2022, month: 12 });
  });

  it('crosses year zero', () => {
    expect(shiftMonth(null, 1, 1, -1)).toEqual({ year: 0, month: 12 });
  });
});
