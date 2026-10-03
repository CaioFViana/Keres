import { describe, expect, it } from 'vitest';
import {
  addBillingMonths,
  addBillingPeriod,
  convertedPeriodStart,
  dailyCents,
  daysUntil,
  nextPeriodStart,
  wholeDays,
} from '../../utils/billingPeriod';

const at = (iso: string) => new Date(iso);

describe('addBillingPeriod', () => {
  it('ends a month paid on the 3rd on the 3rd of the next month, at the same time of day', () => {
    expect(addBillingPeriod(at('2026-03-03T14:30:15.250Z'), 'monthly').toISOString()).toBe(
      '2026-04-03T14:30:15.250Z',
    );
  });

  it('ends a year on the same day of the next year', () => {
    expect(addBillingPeriod(at('2026-03-03T00:00:00.000Z'), 'yearly').toISOString()).toBe(
      '2027-03-03T00:00:00.000Z',
    );
  });

  it('crosses the end of the year', () => {
    expect(addBillingPeriod(at('2026-12-15T10:00:00.000Z'), 'monthly').toISOString()).toBe(
      '2027-01-15T10:00:00.000Z',
    );
  });

  it('falls on the last day of a shorter month instead of spilling into the next', () => {
    expect(addBillingPeriod(at('2026-01-31T00:00:00.000Z'), 'monthly').toISOString()).toBe(
      '2026-02-28T00:00:00.000Z',
    );
    expect(addBillingPeriod(at('2028-01-31T00:00:00.000Z'), 'monthly').toISOString()).toBe(
      '2028-02-29T00:00:00.000Z',
    );
    expect(addBillingPeriod(at('2026-08-31T00:00:00.000Z'), 'monthly').toISOString()).toBe(
      '2026-09-30T00:00:00.000Z',
    );
  });

  it('puts a yearly period that starts on a leap day on the last day of February', () => {
    expect(addBillingPeriod(at('2028-02-29T00:00:00.000Z'), 'yearly').toISOString()).toBe(
      '2029-02-28T00:00:00.000Z',
    );
  });
});

describe('nextPeriodStart', () => {
  it('extends from where the paid period ends when the payment comes early', () => {
    expect(
      nextPeriodStart(at('2026-04-03T00:00:00.000Z'), at('2026-04-01T00:00:00.000Z')).toISOString(),
    ).toBe('2026-04-03T00:00:00.000Z');
  });

  it('starts from the payment itself when the period had already ended', () => {
    expect(
      nextPeriodStart(at('2026-04-03T00:00:00.000Z'), at('2026-04-10T00:00:00.000Z')).toISOString(),
    ).toBe('2026-04-10T00:00:00.000Z');
  });

  it('starts from the payment on a first payment', () => {
    expect(nextPeriodStart(null, at('2026-04-10T00:00:00.000Z')).toISOString()).toBe(
      '2026-04-10T00:00:00.000Z',
    );
  });

  it('treats a payment exactly at the end as a late one', () => {
    expect(
      nextPeriodStart(at('2026-04-03T00:00:00.000Z'), at('2026-04-03T00:00:00.000Z')).toISOString(),
    ).toBe('2026-04-03T00:00:00.000Z');
  });
});

describe('daysUntil', () => {
  it('counts whole days, rounding a started day up, and goes to zero or below once past', () => {
    const now = at('2026-04-01T12:00:00.000Z');
    expect(daysUntil(at('2026-04-03T12:00:00.000Z'), now)).toBe(2);
    expect(daysUntil(at('2026-04-03T13:00:00.000Z'), now)).toBe(3);
    expect(daysUntil(at('2026-04-01T12:00:00.000Z'), now)).toBe(0);
    expect(daysUntil(at('2026-03-30T12:00:00.000Z'), now)).toBe(-2);
  });
});

describe('addBillingMonths', () => {
  it('adds calendar months, clamping to the last day of a shorter one', () => {
    expect(addBillingMonths(at('2026-01-31T10:00:00.000Z'), 1).toISOString()).toBe(
      '2026-02-28T10:00:00.000Z',
    );
    expect(addBillingMonths(at('2026-03-03T00:00:00.000Z'), 3).toISOString()).toBe(
      '2026-06-03T00:00:00.000Z',
    );
    expect(addBillingMonths(at('2026-11-15T00:00:00.000Z'), 14).toISOString()).toBe(
      '2028-01-15T00:00:00.000Z',
    );
  });
});

describe('dailyCents', () => {
  it('puts a monthly and a yearly price on the same footing', () => {
    expect(dailyCents(36525, 'yearly')).toBeCloseTo(100);
    expect(dailyCents(3043.75, 'monthly')).toBeCloseTo(100);
    // A yearly price below twelve monthly ones is cheaper per day.
    expect(dailyCents(25000, 'yearly')).toBeLessThan(dailyCents(2500, 'monthly'));
  });
});

describe('convertedPeriodStart', () => {
  const now = at('2026-03-03T00:00:00.000Z');
  const days = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);
  const daysBetween = (from: Date, to: Date) => (to.getTime() - from.getTime()) / 86_400_000;

  it('turns twenty days of a R$ 25 plan into about seven days of a R$ 70 one', () => {
    const start = convertedPeriodStart(
      now,
      days(20),
      dailyCents(2500, 'monthly'),
      dailyCents(7000, 'monthly'),
    );

    expect(daysBetween(now, start)).toBeCloseTo(20 * (25 / 70), 1);
  });

  it('turns time into more days of a cheaper plan, in proportion', () => {
    const start = convertedPeriodStart(
      now,
      days(20),
      dailyCents(7000, 'monthly'),
      dailyCents(2500, 'monthly'),
    );

    expect(daysBetween(now, start)).toBeCloseTo(20 * (70 / 25), 1);
  });

  it('does not let a year of a cheap plan become a year of an expensive one', () => {
    const start = convertedPeriodStart(
      now,
      days(365),
      dailyCents(25000, 'yearly'),
      dailyCents(7000, 'monthly'),
    );

    // R$ 250 buy about 107 days at R$ 70 a month - not 365.
    expect(daysBetween(now, start)).toBeLessThan(110);
    expect(daysBetween(now, start)).toBeGreaterThan(100);
  });

  it('keeps the time as it is for the same price per day', () => {
    const start = convertedPeriodStart(now, days(10), 100, 100);

    expect(daysBetween(now, start)).toBeCloseTo(10, 5);
  });

  it('starts now when there is nothing left, or nothing to value it by', () => {
    expect(convertedPeriodStart(now, days(-3), 100, 100)).toEqual(now);
    expect(convertedPeriodStart(now, days(10), 0, 100)).toEqual(now);
    expect(convertedPeriodStart(now, days(10), 100, 0)).toEqual(now);
  });
});

describe('wholeDays', () => {
  it('rounds to the nearest day', () => {
    expect(wholeDays(7.4 * 86_400_000)).toBe(7);
    expect(wholeDays(7.6 * 86_400_000)).toBe(8);
  });
});
