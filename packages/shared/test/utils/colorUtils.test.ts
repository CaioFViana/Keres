import { describe, expect, it } from 'vitest';
import {
  getColorLuminance,
  getContrastTextColor,
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
    expect(isColorLight('#ffffff')).toBe(true);
    expect(getContrastTextColor('#ffffff')).toBe('black');
    expect(getContrastTextColor('#000000')).toBe('white');
    expect(getContrastTextColor('invalid')).toBe('black');
  });
});
