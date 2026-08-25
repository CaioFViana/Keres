import { getContrastTextColor, themes, type ThemeColors } from '@keres/shared';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_PREFERENCE_KEY = 'keres_admin_theme_preference';
/** Palette chosen in the panel. Empty/absent = the `default` palette, which is the historical look. */
export const THEME_PALETTE_KEY = 'keres_admin_theme_palette';

/**
 * `key` exists because the public site (apps/admin/src/showcase) uses exactly these mechanics with
 * a key of its own - panel and site are separate things and each remembers its own choice.
 */
export function readThemePreference(key: string = THEME_PREFERENCE_KEY): ThemePreference {
  const raw = localStorage.getItem(key);
  if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  return 'system';
}

export function writeThemePreference(
  preference: ThemePreference,
  key: string = THEME_PREFERENCE_KEY,
): void {
  localStorage.setItem(key, preference);
}

export function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'light' || preference === 'dark') return preference;
  return systemPrefersDark() ? 'dark' : 'light';
}

export function cycleThemePreference(current: ThemePreference): ThemePreference {
  if (current === 'system') return 'light';
  if (current === 'light') return 'dark';
  return 'system';
}

export function applyResolvedTheme(theme: ResolvedTheme): void {
  document.documentElement.setAttribute('data-theme', theme);
}

/**
 * The panel's palette.
 *
 * The colours in `styles.css` were always a manual copy of the app's `default` palette. Now that
 * the palettes live in `@keres/shared`, the panel can use any of them: choosing one overrides the
 * variables on `<html>`, and "default" simply removes the overrides, letting the original CSS
 * stand - which is why nothing changes in appearance until somebody picks one.
 */
export const PALETTE_NAMES = Object.keys(themes);

export function readPaletteName(): string {
  const raw = localStorage.getItem(THEME_PALETTE_KEY);
  return raw && raw in themes ? raw : 'default';
}

export function writePaletteName(name: string): void {
  localStorage.setItem(THEME_PALETTE_KEY, name);
}

export function paletteLabel(name: string): string {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (character) => character.toUpperCase())
    .trim();
}

/** Tokens that can be copied straight across: each one is already used on its own background. */
const PALETTE_TO_CSS_VAR: Array<[keyof ThemeColors, string]> = [
  ['primary', '--color-primary'],
  ['primaryVariant', '--color-primary-variant'],
  ['background', '--color-bg'],
  ['surface', '--color-surface'],
  ['card', '--color-card'],
  ['text', '--color-text'],
  ['textSecondary', '--color-text-secondary'],
  ['border', '--color-border'],
  ['error', '--color-error'],
  ['accent', '--color-accent'],
  ['primary', '--color-focus'],
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

/**
 * Derived colours, computed from the background each one will be drawn on.
 *
 * The sidebar is the case that forced this: it uses `primaryVariant` as its background and used to
 * use `onPrimary` as its text. In the app's palettes those two tokens are not a pair - `onPrimary`
 * goes with `primary`, not with `primaryVariant` - and in a good number of themes the result was
 * light text on a light background, unreadable. Here the text comes from the real background's
 * luminance (`getContrastTextColor`, the same function the app uses), so any palette works.
 */
function derivedPaletteVars(colors: ThemeColors): Array<[string, string]> {
  const sidebarBackground = colors.primaryVariant;
  const sidebarForeground =
    getContrastTextColor(sidebarBackground) === 'black' ? '#000000' : '#ffffff';

  return [
    ['--color-sidebar-bg', sidebarBackground],
    ['--color-sidebar-text', sidebarForeground],
    // Secondary and hover are the same text/background pulled towards each other, rather than separate
    // tokens: that way they stay readable in any palette, light or dark.
    ['--color-sidebar-muted', mixHexColors(sidebarForeground, sidebarBackground, 0.35)],
    ['--color-sidebar-hover', mixHexColors(sidebarBackground, sidebarForeground, 0.18)],
    // The text on primary buttons follows the same rule, for the same reason.
    [
      '--color-on-primary',
      getContrastTextColor(colors.primary) === 'black' ? '#000000' : '#ffffff',
    ],
    ['--color-row-hover', mixHexColors(colors.surface, colors.primary, 0.08)],
    ['--color-table-head', mixHexColors(colors.surface, colors.text, 0.05)],
    ['--color-pre-bg', mixHexColors(colors.surface, colors.text, 0.07)],
  ];
}

/** Every variable a palette writes - also used to clear them. */
const MANAGED_CSS_VARS = [
  ...PALETTE_TO_CSS_VAR.map(([, cssVar]) => cssVar),
  '--color-sidebar-bg',
  '--color-sidebar-text',
  '--color-sidebar-muted',
  '--color-sidebar-hover',
  '--color-on-primary',
  '--color-row-hover',
  '--color-table-head',
  '--color-pre-bg',
];

export function applyPalette(name: string, mode: ResolvedTheme): void {
  const root = document.documentElement;
  for (const cssVar of MANAGED_CSS_VARS) {
    root.style.removeProperty(cssVar);
  }
  if (name === 'default' || !(name in themes)) {
    return;
  }
  const colors = mode === 'dark' ? themes[name].darkColors : themes[name].lightColors;
  for (const [token, cssVar] of PALETTE_TO_CSS_VAR) {
    root.style.setProperty(cssVar, colors[token]);
  }
  for (const [cssVar, value] of derivedPaletteVars(colors)) {
    root.style.setProperty(cssVar, value);
  }
}
