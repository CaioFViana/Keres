import { afterEach, describe, expect, it } from 'vitest';
import {
  attributeDateWeekday,
  attributeDateWeekdayLabels,
  daysInMonth,
  formatAttributeDate,
  formatAttributeDateForDisplay,
  formatAttributeDateMonthLabel,
  isValidAttributeDate,
  parseAttributeDate,
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
