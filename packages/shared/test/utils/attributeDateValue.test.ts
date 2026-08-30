import { afterEach, describe, expect, it } from 'vitest';
import {
  attributeDateWeekday,
  attributeDateWeekdayLabels,
  daysInMonth,
  formatAttributeDate,
  formatGregorianDate,
  formatAttributeDateForDisplay,
  formatAttributeDateMonthLabel,
  gregorianDayNumber,
  gregorianDayNumberForElapsed,
  gregorianPartsFromDayNumber,
  isValidAttributeDate,
  fromClockHour,
  parseAttributeDate,
  toClockHour,
  toUtcDate,
} from '../../utils/attributeDateValue';

describe('parseAttributeDate', () => {
  it('parses a date without time', () => {
    expect(parseAttributeDate('2024-01-15')).toEqual({
      year: 2024,
      month: 1,
      day: 15,
      hour: null,
      minute: null,
    });
  });

  it('parses a date with time', () => {
    expect(parseAttributeDate('2024-01-15T10:30')).toEqual({
      year: 2024,
      month: 1,
      day: 15,
      hour: 10,
      minute: 30,
    });
  });

  it('accepts a space instead of the T separator', () => {
    expect(parseAttributeDate('2024-01-15 10:30')?.hour).toBe(10);
  });

  it('rejects values that are not canonical', () => {
    for (const raw of [
      '',
      null,
      undefined,
      '15/01/2024',
      'January 15, 2024',
      '2024-1-5',
      '2024-01-15T10:30:00',
      '2024-01-15T10:30Z',
      '2024-01-15T25:00',
      '2024-01-15T10:60',
      '2024-13-01',
      '2024-00-10',
      '2024-01-00',
      '0000-01-01',
    ]) {
      expect(isValidAttributeDate(raw)).toBe(false);
    }
  });

  it('rejects a day that does not exist in that month', () => {
    expect(parseAttributeDate('2023-02-29')).toBeNull();
    expect(parseAttributeDate('2024-02-30')).toBeNull();
    expect(parseAttributeDate('2024-04-31')).toBeNull();
    // 2024 is a leap year, so this one does exist.
    expect(parseAttributeDate('2024-02-29')).not.toBeNull();
  });

  it('keeps years below 100 instead of mapping them to the 1900s', () => {
    const parts = parseAttributeDate('0015-06-10');
    expect(parts?.year).toBe(15);
    expect(toUtcDate(parts!).getUTCFullYear()).toBe(15);
  });
});

describe('Gregorian story-epoch coordinates', () => {
  it('round-trips leap days without a timezone or Unix-time dependency', () => {
    const day = gregorianDayNumber({ year: 2024, month: 2, day: 29 });

    expect(gregorianPartsFromDayNumber(day)).toEqual({ year: 2024, month: 2, day: 29 });
    expect(gregorianPartsFromDayNumber(day + 1)).toEqual({ year: 2024, month: 3, day: 1 });
  });

  it('moves a scene into the next civil day when the story opens at night', () => {
    const epochDay = gregorianDayNumber({ year: 2024, month: 1, day: 1 });

    expect(gregorianDayNumberForElapsed(epochDay, 7_200, 82_800)).toBe(epochDay + 1);
  });

  it('can display a timeline date beyond the date picker input range', () => {
    const dayAfterPickerRange = gregorianDayNumber({ year: 9999, month: 12, day: 31 }) + 1;

    expect(gregorianPartsFromDayNumber(dayAfterPickerRange)).toEqual({
      year: 10000,
      month: 1,
      day: 1,
    });
  });

  it('round-trips astronomical years before the common era', () => {
    const day = gregorianDayNumber({ year: 0, month: 2, day: 29 });

    expect(gregorianPartsFromDayNumber(day)).toEqual({ year: 0, month: 2, day: 29 });
    expect(gregorianPartsFromDayNumber(day - 1)).toEqual({ year: 0, month: 2, day: 28 });
  });

  it('formats Gregorian dates in each user-selectable presentation', () => {
    const commonEra = { year: 42, month: 3, day: 5 };
    const beforeCommonEra = { year: 0, month: 3, day: 5 };

    expect(formatGregorianDate(commonEra, 'iso')).toBe('0042-03-05');
    expect(formatGregorianDate(commonEra, 'dmy')).toBe('05/03/0042');
    expect(formatGregorianDate(commonEra, 'mdy')).toBe('03/05/0042');
    expect(formatGregorianDate(beforeCommonEra, 'dmy')).toBe('05/03/0001 BCE');
  });
});

describe('formatAttributeDate', () => {
  it('round-trips every canonical shape', () => {
    for (const raw of ['2024-01-15', '2024-01-15T10:30', '0015-06-10', '9999-12-31T23:59']) {
      expect(formatAttributeDate(parseAttributeDate(raw)!)).toBe(raw);
    }
  });

  it('zero-pads short years, months, days and times', () => {
    expect(formatAttributeDate({ year: 7, month: 2, day: 3, hour: 4, minute: 5 })).toBe(
      '0007-02-03T04:05',
    );
  });
});

describe('Gregorian month labels', () => {
  it('keeps the historical era visible in an agenda header', () => {
    expect(formatAttributeDateMonthLabel(0, 1, 'en-US')).toContain('BCE');
  });
});

describe('attributeDateWeekday', () => {
  it('returns the real weekday, sunday-based', () => {
    // 2024-01-15 was a Monday, 2024-01-14 a Sunday.
    expect(attributeDateWeekday(parseAttributeDate('2024-01-14')!)).toBe(0);
    expect(attributeDateWeekday(parseAttributeDate('2024-01-15')!)).toBe(1);
    expect(attributeDateWeekday(parseAttributeDate('2024-01-20')!)).toBe(6);
  });
});

describe('daysInMonth', () => {
  it('handles ordinary months, leap years and century rules', () => {
    expect(daysInMonth(2024, 1)).toBe(31);
    expect(daysInMonth(2024, 4)).toBe(30);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2023, 2)).toBe(28);
    expect(daysInMonth(1900, 2)).toBe(28);
    expect(daysInMonth(2000, 2)).toBe(29);
  });
});

describe('formatAttributeDateForDisplay', () => {
  it('includes the weekday and the full date', () => {
    const formatted = formatAttributeDateForDisplay('2024-01-15', 'en-US')!;
    expect(formatted).toContain('Monday');
    expect(formatted).toContain('January');
    expect(formatted).toContain('15');
    expect(formatted).toContain('2024');
  });

  it('appends the time only when the value has one', () => {
    expect(formatAttributeDateForDisplay('2024-01-15', 'en-US')).not.toMatch(/\d{1,2}:\d{2}/);
    expect(formatAttributeDateForDisplay('2024-01-15T10:30', 'en-US')).toMatch(/10:30/);
  });

  it('follows the requested language, not the host locale', () => {
    expect(formatAttributeDateForDisplay('2024-01-15', 'pt-BR')).toContain('janeiro');
    expect(formatAttributeDateForDisplay('2024-01-15', 'en-US')).toContain('January');
  });

  it('returns null for values that are not canonical dates', () => {
    expect(formatAttributeDateForDisplay('sometime next spring', 'en-US')).toBeNull();
    expect(formatAttributeDateForDisplay(null, 'en-US')).toBeNull();
  });
});

describe('12 vs 24 hour display', () => {
  it('follows the preference instead of the locale convention', () => {
    // en-US would default to AM/PM and pt-BR to 24h; the user's setting overrides both.
    expect(formatAttributeDateForDisplay('2024-01-15T14:30', 'en-US', true)).toMatch(/14:30/);
    expect(formatAttributeDateForDisplay('2024-01-15T14:30', 'pt-BR', false)).toMatch(/2:30/);
    expect(
      formatAttributeDateForDisplay('2024-01-15T14:30', 'pt-BR', false)?.toUpperCase(),
    ).toMatch(/PM/);
  });

  it('leaves the locale in charge when no preference is given', () => {
    expect(formatAttributeDateForDisplay('2024-01-15T14:30', 'pt-BR')).toMatch(/14:30/);
  });

  it('never changes the date-only output', () => {
    const withPreference = formatAttributeDateForDisplay('2024-01-15', 'en-US', false);
    expect(withPreference).toBe(formatAttributeDateForDisplay('2024-01-15', 'en-US', true));
  });
});

describe('clock hour conversion', () => {
  it('passes 24-hour values through untouched', () => {
    expect(toClockHour(0, true)).toEqual({ hour: 0, isPm: false });
    expect(toClockHour(23, true)).toEqual({ hour: 23, isPm: true });
    expect(fromClockHour(23, true, true)).toBe(23);
  });

  it('maps midnight and noon to 12, not 0', () => {
    expect(toClockHour(0, false)).toEqual({ hour: 12, isPm: false });
    expect(toClockHour(12, false)).toEqual({ hour: 12, isPm: true });
    expect(fromClockHour(12, false, false)).toBe(0);
    expect(fromClockHour(12, true, false)).toBe(12);
  });

  it('round-trips every hour of the day through the 12-hour clock', () => {
    for (let hour24 = 0; hour24 <= 23; hour24 += 1) {
      const { hour, isPm } = toClockHour(hour24, false);
      expect(hour).toBeGreaterThanOrEqual(1);
      expect(hour).toBeLessThanOrEqual(12);
      expect(fromClockHour(hour, isPm, false)).toBe(hour24);
    }
  });
});

describe('timezone independence', () => {
  const originalTz = process.env.TZ;

  afterEach(() => {
    process.env.TZ = originalTz;
  });

  /**
   * The whole point of the type: a story-internal date must render identically wherever the
   * reader is. UTC-3 is where `new Date('2024-01-15')` classically slips back to the 14th, and
   * UTC+9 is where it slips forward.
   */
  it('renders the same string under every host timezone', () => {
    const zones = ['UTC', 'America/Sao_Paulo', 'Asia/Tokyo', 'Pacific/Kiritimati'];

    for (const raw of ['2024-01-15', '2024-01-15T00:00', '2024-01-15T23:59']) {
      const rendered = new Set<string>();
      const weekdays = new Set<number>();
      for (const zone of zones) {
        process.env.TZ = zone;
        rendered.add(formatAttributeDateForDisplay(raw, 'en-US')!);
        weekdays.add(attributeDateWeekday(parseAttributeDate(raw)!));
      }
      expect(rendered.size).toBe(1);
      expect(weekdays.size).toBe(1);
      expect([...rendered][0]).toContain('January 15, 2024');
    }
  });
});

describe('calendar header helpers', () => {
  it('labels the month in the requested language', () => {
    expect(formatAttributeDateMonthLabel(2024, 1, 'en-US')).toContain('January');
    expect(formatAttributeDateMonthLabel(2024, 1, 'pt-BR')).toContain('janeiro');
  });

  it('lists seven weekday labels starting on sunday', () => {
    const labels = attributeDateWeekdayLabels('en-US');
    expect(labels).toHaveLength(7);
    expect(labels[0]).toContain('Sun');
    expect(labels[6]).toContain('Sat');
  });
});
