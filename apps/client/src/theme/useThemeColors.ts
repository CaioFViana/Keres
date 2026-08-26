import { useThemeStore } from '../state/themeStore';
import { themes } from '@keres/shared';
import type { ThemeColors } from '@keres/shared';

/**
 * The colours of an **arbitrary** palette, respecting the current light/dark - to show a story's
 * face without entering it (the story list paints each card with its own story's theme).
 *
 * It stays out of `commonStyles` because it reads the theme store, which pulls in the service and the database: a file
 * of style factories cannot drag that into every component that imports a margin.
 * For the **current** story's colours, use `useTheme` - it costs none of that.
 */
export const useThemeColors = (themeName: string | null | undefined): ThemeColors => {
  const { darkMode } = useThemeStore();
  const selectedTheme = themes[themeName || 'default'] || themes['default'];
  return darkMode ? selectedTheme.darkColors : selectedTheme.lightColors;
};
