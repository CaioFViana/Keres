import { describe, expect, it } from 'vitest';
import { formatStorage, splitBytes, toBytes } from '../../src/pages/tiers/storageUnits';

const MB = 1024 * 1024;

describe('splitBytes', () => {
  it('states a size in the largest unit that holds it exactly', () => {
    expect(splitBytes(100 * MB)).toEqual({ amount: 100, unit: 'MB' });
    expect(splitBytes(2 * 1024 * MB)).toEqual({ amount: 2, unit: 'GB' });
    // 1.5 MB is not a whole number of megabytes, so it is stated in kilobytes.
    expect(splitBytes(1536 * 1024)).toEqual({ amount: 1536, unit: 'KB' });
    expect(splitBytes(500)).toEqual({ amount: 500, unit: 'B' });
  });

  it('keeps no limit empty and zero as zero', () => {
    expect(splitBytes(null)).toEqual({ amount: null, unit: 'MB' });
    expect(splitBytes(0)).toEqual({ amount: 0, unit: 'MB' });
  });
});

describe('toBytes', () => {
  it('multiplies by the unit and rounds to the byte', () => {
    expect(toBytes(100, 'MB')).toBe(100 * MB);
    expect(toBytes(1.5, 'GB')).toBe(1.5 * 1024 * MB);
    expect(toBytes(0.3, 'KB')).toBe(307);
    expect(toBytes(null, 'GB')).toBeNull();
  });

  it('round-trips what was stored', () => {
    for (const bytes of [1, 1023, 1024, 1500000, 100 * MB, 5 * 1024 * MB]) {
      const { amount, unit } = splitBytes(bytes);
      expect(toBytes(amount, unit)).toBe(bytes);
    }
  });
});

describe('formatStorage', () => {
  it('writes the amount and unit, and infinity for no limit', () => {
    expect(formatStorage(100 * MB)).toBe('100 MB');
    expect(formatStorage(null)).toBe('∞');
    expect(formatStorage(0)).toBe('0 MB');
  });
});
