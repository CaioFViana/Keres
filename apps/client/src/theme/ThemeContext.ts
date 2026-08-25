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
 * As cores da história atual, para qualquer componente.
 *
 * Vive à parte do `ThemeProvider` de propósito: o provider precisa do store de tema, que
 * precisa do serviço de configurações, que precisa do banco - e um componente que só desenha
 * um cartão passava a arrastar o drizzle e o expo-sqlite inteiros por causa deste único hook.
 * Aqui ele custa `react` e um tipo.
 */
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
