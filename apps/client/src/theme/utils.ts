import { useThemeStore } from '../state/themeStore'; // Import useThemeStore
import { themes } from './palettes'; // Import themes object and defaultTheme
import { ThemeColors } from './types';

export const getThemeColors = (themeName: string | null | undefined): ThemeColors => {
  const { darkMode } = useThemeStore(); // Get darkMode state

  const selectedTheme = themes[themeName || 'default'] || themes["default"];

  return darkMode ? selectedTheme.darkColors : selectedTheme.lightColors;
};
