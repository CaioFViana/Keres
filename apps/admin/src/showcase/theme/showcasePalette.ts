import { getContrastTextColor, themes, type ThemeColors } from '@keres/shared';
import type { ResolvedTheme } from '../../theme/theme';

/**
 * The public site's palette, from the server's `sitePalette`.
 *
 * Same mechanics as the panel's `applyPalette`: a named palette overrides the `--color-*`
 * variables on `<html>`, and `default` (or anything unknown) removes the overrides so the
 * original CSS stands. Only the site frame is touched - never `--story-*`, which stays the
 * open story's own tint.
 */

/** Tokens copied straight across: each one is already used on its own background. */
const PALETTE_TO_CSS_VAR: Array<[keyof ThemeColors, string]> = [
  ['primary', '--color-primary'],
  ['background', '--color-bg'],
  ['surface', '--color-surface'],
  ['surface', '--color-bg-elevated'],
  ['text', '--color-text'],
  ['textSecondary', '--color-text-secondary'],
  ['border', '--color-border'],
  ['error', '--color-error'],
  ['accent', '--color-accent'],
];

/** Mixes two hexadecimal colours; `amount` is how much of the second one goes in (0 to 1). */
function mixHexColors(base: string, blend: string, amount: number): string {
  const parse = (hex: string) => {
    const value = hex.replace('#', '');
    const full =
      value.length === 3
        ? value
            .split('')
            .map((character) => character + character)
            .join('')
        : value.slice(0, 6);
    return [0, 2, 4].map((offset) => parseInt(full.slice(offset, offset + 2), 16));
  };

  const [baseRed, baseGreen, baseBlue] = parse(base);
  const [blendRed, blendGreen, blendBlue] = parse(blend);
  const channel = (from: number, to: number) =>
    Math.round(from + (to - from) * amount)
      .toString(16)
      .padStart(2, '0');

  return `#${channel(baseRed, blendRed)}${channel(baseGreen, blendGreen)}${channel(baseBlue, blendBlue)}`;
}

function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((character) => character + character)
          .join('')
      : value.slice(0, 6);
  const [red, green, blue] = [0, 2, 4].map((offset) =>
    parseInt(full.slice(offset, offset + 2), 16),
  );
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

/**
 * Derived colours. The header is the surface translucent, as in the original CSS; the hero fades
 * from a primary-tinted wash into the background; the text on primary buttons follows the real
 * background's luminance, the same rule the panel uses.
 */
function derivedShowcaseVars(colors: ThemeColors): Array<[string, string]> {
  return [
    ['--color-header', hexToRgba(colors.surface, 0.85)],
    ['--color-hero-from', mixHexColors(colors.background, colors.primary, 0.14)],
    ['--color-hero-to', colors.background],
    [
      '--color-on-primary',
      getContrastTextColor(colors.primary) === 'black' ? '#000000' : '#ffffff',
    ],
  ];
}

/** Every variable a palette writes - also used to clear them. */
const MANAGED_CSS_VARS = [
  ...PALETTE_TO_CSS_VAR.map(([, cssVar]) => cssVar),
  '--color-header',
  '--color-hero-from',
  '--color-hero-to',
  '--color-on-primary',
];

export function applyShowcasePalette(
  palette: string | null | undefined,
  mode: ResolvedTheme,
): void {
  const root = document.documentElement;
  for (const cssVar of MANAGED_CSS_VARS) {
    root.style.removeProperty(cssVar);
  }
  if (!palette || palette === 'default' || !(palette in themes)) {
    return;
  }
  const colors = mode === 'dark' ? themes[palette].darkColors : themes[palette].lightColors;
  for (const [token, cssVar] of PALETTE_TO_CSS_VAR) {
    root.style.setProperty(cssVar, colors[token]);
  }
  for (const [cssVar, value] of derivedShowcaseVars(colors)) {
    root.style.setProperty(cssVar, value);
  }
}
