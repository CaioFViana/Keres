import { useThemeStore } from '../state/themeStore'; // Import useThemeStore
import { themes } from './palettes'; // Import themes object and defaultTheme
import { ThemeColors } from './types';

export const getThemeColors = (themeName: string | null | undefined): ThemeColors => {
  const { darkMode } = useThemeStore(); // Get darkMode state

  const selectedTheme = themes[themeName || 'default'] || themes["default"];

  return darkMode ? selectedTheme.darkColors : selectedTheme.lightColors;
};

export const isColorLight = (hexColor: string): boolean => {
  // Remove '#' if present
  const cleanHex = hexColor.startsWith('#') ? hexColor.slice(1) : hexColor;

  // Parse r, g, b values
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  // Calculate luminance (perceived brightness)
  // Formula: 0.299*R + 0.587*G + 0.114*B
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Return true if luminance is above a threshold (e.g., 0.5 for light, 0.5 for dark)
  // A common threshold is 0.5 or 0.6. Let's use 0.5 for now.
  return luminance > 0.5;
};