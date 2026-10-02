import { describe, expect, it } from 'vitest';
import { formatBytes, formatPrice, yearlyDiscountPercent } from '../../src/content/pricing';

describe('landing pricing display', () => {
  it('derives the yearly discount like the shared helper', () => {
    expect(yearlyDiscountPercent(1000, 9600)).toBe(20);
    expect(yearlyDiscountPercent(100, 1000)).toBe(17);
    expect(yearlyDiscountPercent(null, 1000)).toBeNull();
    expect(yearlyDiscountPercent(1000, null)).toBeNull();
    expect(yearlyDiscountPercent(1000, 12000)).toBeNull();
    expect(yearlyDiscountPercent(0, 0)).toBeNull();
  });

  it('formats minor units in the given currency', () => {
    expect(formatPrice(1990, 'BRL', 'en')).toContain('19.90');
    expect(formatPrice(1990, 'USD', 'en')).toContain('19.90');
  });

  it('falls back to a plain amount when the currency code is not one the runtime knows', () => {
    // `Intl.NumberFormat` throws a RangeError on a malformed code; the server's currency is data.
    expect(formatPrice(1990, 'NOT_A_CURRENCY', 'en')).toBe('19.90 NOT_A_CURRENCY');
  });

  it('formats byte limits', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(100 * 1024 * 1024)).toBe('100 MB');
    expect(formatBytes(2 * 1024 ** 3)).toBe('2 GB');
  });
});
