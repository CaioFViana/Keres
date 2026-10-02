import { describe, expect, it } from 'vitest';
import { addBillingPeriod, daysUntil, nextPeriodStart } from '../../utils/billingPeriod';

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
