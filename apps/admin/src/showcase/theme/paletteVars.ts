import { themes, type ThemeColors } from '@keres/shared';

/**
 * A bridge between the app's palettes (token objects, made for React Native's `StyleSheet`) and
 * the site's CSS (custom properties).
 *
 * The translation exists so a story's page can be painted with the palette its author chose for it
 * inside Keres - it is the same `stories.theme`, now that the palettes live in `@keres/shared` and
 * no longer only in the client.
 */

/** Its own prefix: it does not collide with the admin panel's variables, which come from elsewhere. */
const VAR_PREFIX = '--story';

const TOKEN_TO_VAR: Array<[keyof ThemeColors, string]> = [
  ['primary', 'primary'],
  ['primaryVariant', 'primary-variant'],
  ['primaryContainer', 'primary-container'],
  ['onPrimaryContainer', 'on-primary-container'],
  ['secondary', 'secondary'],
  ['background', 'bg'],
  ['surface', 'surface'],
  ['card', 'card'],
  ['text', 'text'],
  ['textSecondary', 'text-secondary'],
  ['border', 'border'],
  ['accent', 'accent'],
  ['star', 'star'],
  ['onPrimary', 'on-primary'],
  ['error', 'error'],
];

export function paletteExists(themeName: string | null | undefined): boolean {
  return !!themeName && themeName in themes;
}

/**
 * A palette's CSS variables, in light or dark mode. Falls back to the `default` theme when the
 * story has no theme, or has one this build does not know (a package published by a newer version
 * of the app).
 */
export function paletteVars(
  themeName: string | null | undefined,
  mode: 'light' | 'dark',
): Record<string, string> {
  const palette = (themeName && themes[themeName]) || themes.default;
  const colors = mode === 'dark' ? palette.darkColors : palette.lightColors;

  return Object.fromEntries(
    TOKEN_TO_VAR.map(([token, name]) => [`${VAR_PREFIX}-${name}`, colors[token]]),
  );
}

/** A palette's display name, from the technical key (`seaOfStars` -> `Sea Of Stars`). */
export function paletteDisplayName(themeName: string | null | undefined): string {
  if (!paletteExists(themeName)) {
    return 'Default';
  }
  return themeName!
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (character) => character.toUpperCase())
    .trim();
}
