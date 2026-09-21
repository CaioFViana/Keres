import React, { useCallback, useMemo, useState } from 'react';
import type { AppDrizzleClient } from '../db';
import { useThemeStore } from '../state/themeStore';
import { setEntityAppearanceScheme, setGraphEntityPaletteScheme, themes } from '@keres/shared';
import { ThemeContext } from './ThemeContext';

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultThemeName?: string;
  drizzleClient: AppDrizzleClient | null;
}

/**
 * Owns the palette for the current story: dark/light comes from the persisted theme store
 * (toggled through `toggleTheme`, which needs the database), while the palette name is
 * session state defaulting to 'default'. Unknown names fall back to default with a warning
 * rather than crashing the tree. The shared entity/graph palettes are synced from the same
 * dark-mode flag so canvases match the UI.
 */
export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultThemeName = 'default',
  drizzleClient,
}) => {
  const { darkMode, toggleDarkMode } = useThemeStore();
  const [currentThemeName, setCurrentThemeName] = useState(defaultThemeName);

  const toggleTheme = useCallback(() => {
    if (drizzleClient) {
      toggleDarkMode(drizzleClient);
    } else {
      console.warn('Drizzle client not available for theme toggling.');
    }
  }, [toggleDarkMode, drizzleClient]);

  const setTheme = useCallback((themeName: string) => {
    if (themes[themeName]) {
      setCurrentThemeName(themeName);
    } else {
      console.warn(`Theme "${themeName}" not found. Falling back to default theme.`);
      setCurrentThemeName('default');
    }
  }, []);

  const colors = useMemo(() => {
    const selectedTheme = themes[currentThemeName];
    return darkMode ? selectedTheme.darkColors : selectedTheme.lightColors;
  }, [darkMode, currentThemeName]);

  setEntityAppearanceScheme(darkMode);
  setGraphEntityPaletteScheme(darkMode);

  const value = useMemo(
    () => ({
      colors,
      isDarkMode: darkMode,
      toggleTheme,
      currentThemeName,
      setTheme,
    }),
    [colors, darkMode, toggleTheme, currentThemeName, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
