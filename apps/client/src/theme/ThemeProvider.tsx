import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AppDrizzleClient } from '../db'; // Import AppDrizzleClient
import { useThemeStore } from '../state/themeStore'; // Import useThemeStore
import { themes } from './palettes';
import { ThemeColors } from './ThemeColors';

interface ThemeContextType {
  colors: ThemeColors;
  isDarkMode: boolean;
  toggleTheme: () => void;
  currentThemeName: string;
  setTheme: (themeName: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultThemeName?: string; // Make defaultThemeName optional
  drizzleClient: AppDrizzleClient | null; // New prop for drizzleClient
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultThemeName = 'default',
  drizzleClient,
}) => {
  const { darkMode, toggleDarkMode } = useThemeStore(); // Use darkMode from themeStore
  const [currentThemeName, setCurrentThemeName] = useState(defaultThemeName);

  const toggleTheme = useCallback(() => {
    if (drizzleClient) {
      toggleDarkMode(drizzleClient); // Pass drizzleClient to toggleDarkMode
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

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
