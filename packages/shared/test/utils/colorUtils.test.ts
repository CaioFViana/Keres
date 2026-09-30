import { describe, expect, it } from 'vitest';
import {
  getColorLuminance,
  getContrastRatio,
  getContrastTextColor,
  getReadableInk,
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

  describe('getReadableInk', () => {
    it('keeps a colour that already reads on every background', () => {
      expect(getReadableInk('#0D47A1', ['#FFFFFF', '#F5F5F5'])).toBe('#0D47A1');
    });

    it('darkens a pastel swatch on a light page until it reads, keeping its hue', () => {
      const ink = getReadableInk('#90CAF9', '#FFFFFF');
      expect(getContrastRatio(ink, '#FFFFFF')!).toBeGreaterThanOrEqual(4.5);
      const [red, , blue] = [1, 3, 5].map((i) => parseInt(ink.slice(i, i + 2), 16));
      expect(blue).toBeGreaterThan(red!);
    });

    it('reads on every surface of an alternating list, and honours a lower minimum', () => {
      const surfaces = ['#FFFFFF', '#EEEEEE'];
      const text = getReadableInk('#FFAB91', surfaces);
      const line = getReadableInk('#FFAB91', surfaces, 3);
      for (const surface of surfaces) {
        expect(getContrastRatio(text, surface)!).toBeGreaterThanOrEqual(4.5);
        expect(getContrastRatio(line, surface)!).toBeGreaterThanOrEqual(3);
      }
      expect(getContrastRatio(line, '#FFFFFF')!).toBeLessThan(getContrastRatio(text, '#FFFFFF')!);
    });

    it('lightens a deep swatch on a dark page', () => {
      const ink = getReadableInk('#1976D2', '#121212');
      expect(getContrastRatio(ink, '#121212')!).toBeGreaterThanOrEqual(4.5);
    });

    it('leaves what it cannot parse alone', () => {
      expect(getReadableInk('red', '#FFFFFF')).toBe('red');
    });
  });
});
