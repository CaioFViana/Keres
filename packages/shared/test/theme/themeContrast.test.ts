import { describe, expect, it } from 'vitest';
import { themes } from '../../theme/palettes';
import type { ThemeColors } from '../../theme/ThemeColors';
import { getContrastRatio, isValidHexColor } from '../../utils/colorUtils';

/** WCAG AA for normal text / icon labels on filled surfaces. */
const TEXT_MIN = 4.5;
/** WCAG for non-text UI (icons on background/card). */
const UI_MIN = 3;

type Pair = {
  label: string;
  background: keyof ThemeColors;
  foreground: keyof ThemeColors;
  minimum: number;
};

const SEMANTIC_PAIRS: Pair[] = [
  { label: 'primary/onPrimary', background: 'primary', foreground: 'onPrimary', minimum: TEXT_MIN },
  {
    label: 'secondary/onSecondary',
    background: 'secondary',
    foreground: 'onSecondary',
    minimum: TEXT_MIN,
  },
  {
    label: 'primaryContainer/onPrimaryContainer',
    background: 'primaryContainer',
    foreground: 'onPrimaryContainer',
    minimum: TEXT_MIN,
  },
  { label: 'error/onError', background: 'error', foreground: 'onError', minimum: TEXT_MIN },
  {
    label: 'accent/onAccent',
    background: 'accent',
    foreground: 'onAccent',
    minimum: TEXT_MIN,
  },
  {
    label: 'notification/onNotification',
    background: 'notification',
    foreground: 'onNotification',
    minimum: TEXT_MIN,
  },
  { label: 'background/text', background: 'background', foreground: 'text', minimum: TEXT_MIN },
  {
    label: 'surface/onSurface',
    background: 'surface',
    foreground: 'onSurface',
    minimum: TEXT_MIN,
  },
  { label: 'card/text', background: 'card', foreground: 'text', minimum: TEXT_MIN },
  {
    label: 'background/textSecondary',
    background: 'background',
    foreground: 'textSecondary',
    minimum: TEXT_MIN,
  },
  { label: 'background/star', background: 'background', foreground: 'star', minimum: UI_MIN },
  { label: 'card/star', background: 'card', foreground: 'star', minimum: UI_MIN },
];

const HEX_KEYS = Object.keys(themes.default.lightColors).filter(
  (key) => key !== 'shadow',
) as (keyof ThemeColors)[];

describe('theme palette contrast', () => {
  it.each(Object.keys(themes))('%s light and dark keep semantic pairs readable', (themeName) => {
    const theme = themes[themeName]!;

    for (const mode of ['lightColors', 'darkColors'] as const) {
      const colors = theme[mode];

      for (const key of HEX_KEYS) {
        const value = colors[key];
        expect(isValidHexColor(value), `${themeName} ${mode} ${key}=${value}`).toBe(true);
      }

      for (const pair of SEMANTIC_PAIRS) {
        const background = colors[pair.background];
        const foreground = colors[pair.foreground];
        const ratio = getContrastRatio(background, foreground);
        expect(
          ratio,
          `${themeName} ${mode} ${pair.label}: ${foreground} on ${background}`,
        ).toBeGreaterThanOrEqual(pair.minimum);
      }
    }
  });

  it('Sea of Stars dark shows why filled controls must use on* tokens, not body text', () => {
    // Regression guard for the GlobalSearch favorite filter: primary/accent fills are light
    // yellow/cyan while `text` is also light, so icons painted with `text` disappear.
    const colors = themes.seaOfStars!.darkColors;
    expect(getContrastRatio(colors.primary, colors.text)!).toBeLessThan(UI_MIN);
    expect(getContrastRatio(colors.accent, colors.text)!).toBeLessThan(UI_MIN);
    expect(getContrastRatio(colors.notification, colors.text)!).toBeLessThan(UI_MIN);
    expect(getContrastRatio(colors.primary, colors.onPrimary)!).toBeGreaterThanOrEqual(TEXT_MIN);
    expect(getContrastRatio(colors.accent, colors.onAccent)!).toBeGreaterThanOrEqual(TEXT_MIN);
    expect(getContrastRatio(colors.notification, colors.onNotification)!).toBeGreaterThanOrEqual(
      TEXT_MIN,
    );
  });
});
