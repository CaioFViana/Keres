import { DefaultTheme, type Theme as NavigationTheme } from '@react-navigation/native';
import type { ThemeColors } from '../theme';

/**
 * Maps the app palette onto React Navigation's theme, so drawers and headers read the same
 * colors as the rest of the app instead of navigation's light defaults (which showed as a
 * white divider in a dark story or dark mode).
 *
 * It used to live inline as `NavigationThemeBridge` in App.tsx, providing the theme above
 * the navigator. When the NavigationContainer moved into AppNavigator (after the
 * expo-router removal), the mapping moved here with it: the container takes the built
 * theme as a prop, keeping navigator + theme in one self-sufficient place.
 */
export function buildNavigationTheme(colors: ThemeColors, isDarkMode: boolean): NavigationTheme {
  return {
    ...DefaultTheme,
    dark: isDarkMode,
    colors: {
      ...DefaultTheme.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.notification,
    },
  };
}
