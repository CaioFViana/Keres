import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { ThemeColors } from './types';
import { themes } from './palettes';
import { useThemeStore } from '../state/themeStore'; // Import useThemeStore

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
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children, defaultThemeName = 'default' }) => {
  const { darkMode, toggleDarkMode } = useThemeStore(); // Use darkMode from themeStore
  const [currentThemeName, setCurrentThemeName] = useState(defaultThemeName);

  const toggleTheme = useCallback(() => {
    toggleDarkMode(); // Toggle darkMode in the store
  }, [toggleDarkMode]);

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

  const value = useMemo(() => ({
    colors,
    isDarkMode: darkMode,
    toggleTheme,
    currentThemeName,
    setTheme
  }), [colors, darkMode, toggleTheme, currentThemeName, setTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
