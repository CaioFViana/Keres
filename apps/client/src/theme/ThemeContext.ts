import { createContext, useContext } from 'react';
import type { ThemeColors } from '@keres/shared';

export interface ThemeContextType {
  colors: ThemeColors;
  isDarkMode: boolean;
  toggleTheme: () => void;
  currentThemeName: string;
  setTheme: (themeName: string) => void;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * The current story's colours, for any component.
 *
 * It deliberately lives apart from `ThemeProvider`: the provider needs the theme store, which
 * needs the settings service, which needs the database - and a component that only draws
 * a card started dragging the whole of drizzle and expo-sqlite along because of this single hook.
 * Here it costs `react` and a type.
 */
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
