import { describe, expect, it } from 'vitest';
import {
  getColorLuminance,
  getContrastRatio,
  getContrastTextColor,
  getDistinctSeriesColor,
  getRelativeLuminance,
  isColorLight,
  isValidHexColor,
} from '../../utils/colorUtils';

describe('color utility contracts', () => {
  it('handles valid shorthand, extended colors, and invalid values', () => {
    expect(isValidHexColor('#abc')).toBe(true);
    expect(isValidHexColor('#abcd')).toBe(true);
    expect(isValidHexColor('#aabbccdd')).toBe(true);
    expect(isValidHexColor('red')).toBe(false);
    expect(getColorLuminance('#fff')).toBeCloseTo(1);
    expect(getColorLuminance('invalid')).toBeNull();
    expect(getRelativeLuminance('#000000')).toBe(0);
    expect(getRelativeLuminance('#ffffff')).toBe(1);
    expect(getRelativeLuminance('invalid')).toBeNull();
  });

  it('selects accessible contrast and deterministic palette fallbacks', () => {
    expect(getContrastRatio('#000', '#fff')).toBeCloseTo(21);
    expect(getContrastRatio('#000', 'invalid')).toBeNull();
    expect(isColorLight('#fff')).toBe(true);
    expect(isColorLight('invalid')).toBe(false);
    expect(getContrastTextColor('#fff')).toBe('black');
    expect(getContrastTextColor('#000')).toBe('white');
    expect(getContrastTextColor('invalid')).toBe('black');
    expect(getDistinctSeriesColor(1, 2, ['#a', '#b'])).toBe('#b');
    expect(getDistinctSeriesColor(0, 8)).toMatch(/^#[0-9a-f]{6}$/);
  });
});
