import React, { createContext, useContext, useState, useMemo } from 'react';
import { lightColors, darkColors, Colors } from './colors';

interface ThemeContextType {
  colors: Colors;
  isDarkMode: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  const toggleTheme = () => {
    setIsDarkMode(prevMode => !prevMode);
  };

  const colors = useMemo(() => (isDarkMode ? darkColors : lightColors), [isDarkMode]);

  const value = useMemo(() => ({ colors, isDarkMode, toggleTheme }), [colors, isDarkMode, toggleTheme]);

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
