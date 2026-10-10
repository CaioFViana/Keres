import type { ThemeColors } from '@keres/shared';
import { Platform, StyleSheet } from 'react-native';
import {
  commonDetailStyleDefs,
  commonScreenStyleDefs,
  getCommonCardStyles,
  getCommonContainerStyles,
  getCommonInputStyles,
  isColorLight,
} from '../../src/theme/commonStyles';
import { saturateColor } from '../../src/utils/colorMath';

const colors = {
  primary: '#112233',
  background: '#ffffff',
  surface: '#f0f0f0',
  card: '#808080',
  text: '#111111',
  textSecondary: '#666666',
  onSurface: '#222222',
} as ThemeColors;

describe('compatibility re-exports', () => {
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
