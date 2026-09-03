import { describe, expect, it } from 'vitest';
import {
  getColorLuminance,
  getContrastRatio,
  getContrastTextColor,
  getRelativeLuminance,
  isColorLight,
  isValidHexColor,
} from '../../utils/colorUtils';

describe('color utilities', () => {
  it('validates supported hexadecimal colors', () => {
    expect(isValidHexColor('#abc')).toBe(true);
    expect(isValidHexColor('#AABBCCDD')).toBe(true);
    expect(isValidHexColor('AABBCC')).toBe(false);
    expect(isValidHexColor('#abcdz')).toBe(false);
  });

  it('selects legible contrast text', () => {
    expect(getColorLuminance('#ffffff')).toBeCloseTo(1);
    expect(getColorLuminance('#ffff')).toBeCloseTo(1);
    expect(getColorLuminance('invalid')).toBeNull();
    expect(getRelativeLuminance('#ffffff')).toBeCloseTo(1);
    expect(getContrastRatio('#ffffff', '#000000')).toBeCloseTo(21);
    expect(isColorLight('#ffffff')).toBe(true);
    expect(getContrastTextColor('#ffffff')).toBe('black');
    expect(getContrastTextColor('#000000')).toBe('white');
    expect(getContrastTextColor('invalid')).toBe('black');
  });

  it('chooses the foreground with the greater WCAG contrast', () => {
    // The old 0.5 perceived-luminance cutoff chose white here (3.68:1).
    expect(getContrastTextColor('#F44336')).toBe('black');
    expect(getContrastRatio('#F44336', '#000000')).toBeGreaterThanOrEqual(4.5);
  });
});
