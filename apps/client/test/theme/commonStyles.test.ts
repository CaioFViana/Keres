import type { ThemeColors } from '@keres/shared';
import { Platform, StyleSheet } from 'react-native';
import {
  commonDetailStyleDefs,
  commonScreenStyleDefs,
  getCommonCardStyles,
  getCommonContainerStyles,
  getCommonInputStyles,
  hexToRgb,
  hsvToRgb,
  isColorLight,
  rgbToHex,
  rgbToHsv,
  saturateColor,
} from '../../src/theme/commonStyles';

const colors = {
  primary: '#112233',
  background: '#ffffff',
  surface: '#f0f0f0',
  card: '#808080',
  text: '#111111',
  textSecondary: '#666666',
  onSurface: '#222222',
} as ThemeColors;

describe('saturateColor', () => {
  it('returns non-#RRGGBB input untouched', () => {
    expect(saturateColor('')).toBe('');
    expect(saturateColor('abc')).toBe('abc');
    expect(saturateColor('#fff')).toBe('#fff');
  });

  it('scales each channel by the default factor', () => {
    expect(saturateColor('#808080')).toBe('#8c8c8c');
  });

  it('honours an explicit factor and clamps at white', () => {
    expect(saturateColor('#404040', 2)).toBe('#808080');
    expect(saturateColor('#ffffff')).toBe('#ffffff');
    expect(saturateColor('#000000')).toBe('#000000');
  });
});

describe('color conversion helpers', () => {
  it('parses hex with or without a hash and falls back to black', () => {
    expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb('00ff00')).toEqual({ r: 0, g: 255, b: 0 });
    expect(hexToRgb('zzz')).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('converts primary colors to HSV', () => {
    expect(rgbToHsv(255, 0, 0)).toEqual({ h: 0, s: 100, v: 100 });
    expect(rgbToHsv(0, 255, 0)).toEqual({ h: 120, s: 100, v: 100 });
    expect(rgbToHsv(0, 0, 255)).toEqual({ h: 240, s: 100, v: 100 });
  });

  it('gives achromatic colors zero hue and saturation', () => {
    expect(rgbToHsv(128, 128, 128)).toEqual({ h: 0, s: 0, v: expect.closeTo(50.2, 1) });
  });

  it('converts HSV back to RGB', () => {
    expect(hsvToRgb(0, 100, 100)).toEqual({ r: 255, g: 0, b: 0 });
    expect(hsvToRgb(120, 100, 100)).toEqual({ r: 0, g: 255, b: 0 });
    expect(hsvToRgb(0, 0, 50)).toEqual({ r: 128, g: 128, b: 128 });
  });

  it('formats RGB as padded hex', () => {
    expect(rgbToHex(255, 0, 16)).toBe('#ff0010');
    expect(rgbToHex(0, 0, 0)).toBe('#000000');
  });

  it('re-exports the shared lightness check', () => {
    expect(isColorLight('#ffffff')).toBe(true);
    expect(isColorLight('#000000')).toBe(false);
  });
});

describe('style factories', () => {
  it('builds card styles from the theme', () => {
    const styles = getCommonCardStyles(colors);
    expect(StyleSheet.flatten(styles.cardContainer)).toMatchObject({
      padding: 15,
      borderRadius: 8,
      marginBottom: 10,
      borderColor: colors.primary,
      backgroundColor: saturateColor(colors.card),
    });
    expect(StyleSheet.flatten(styles.cardText)).toMatchObject({
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.onSurface,
    });
  });

  it('builds container styles from the theme', () => {
    const styles = getCommonContainerStyles(colors);
    expect(StyleSheet.flatten(styles.container)).toMatchObject({
      flex: 1,
      backgroundColor: colors.background,
      width: '100%',
      padding: 20,
    });
  });

  it('builds input styles without a web outline on native', () => {
    const styles = getCommonInputStyles(colors);
    const input = StyleSheet.flatten(styles.input) as Record<string, unknown>;
    expect(input).toMatchObject({
      height: 50,
      borderColor: colors.primary,
      borderWidth: 1,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.surface,
    });
    expect(input.outlineStyle).toBeUndefined();
    expect(StyleSheet.flatten(styles.multiline)).toMatchObject({
      minHeight: 100,
      textAlignVertical: 'top',
    });
  });

  it('removes the browser outline on web', () => {
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    try {
      const input = StyleSheet.flatten(getCommonInputStyles(colors).input) as Record<
        string,
        unknown
      >;
      expect(input).toMatchObject({
        outlineColor: 'transparent',
        outlineStyle: 'none',
        outlineWidth: 0,
      });
    } finally {
      Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
    }
  });

  it('builds detail-screen skeleton definitions', () => {
    const defs = commonDetailStyleDefs(colors);
    expect(defs.mainTitle).toMatchObject({ fontSize: 28, color: colors.text });
    expect(defs.sectionTitle).toMatchObject({ fontSize: 18, color: colors.text });
    expect(defs.emptyText).toMatchObject({ color: colors.textSecondary, textAlign: 'center' });
    expect(defs.emptyContainer).toMatchObject({ flex: 1, padding: 32 });
  });

  it('builds full-bleed screen definitions', () => {
    expect(commonScreenStyleDefs(colors)).toEqual({
      container: { flex: 1, backgroundColor: colors.background },
    });
  });
});
