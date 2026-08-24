import { useThemeStore } from '../state/themeStore';
import { themes } from './palettes';
import type { ThemeColors } from './ThemeColors';

/**
 * As cores de uma paleta **arbitrária**, respeitando o claro/escuro atual - para mostrar a cara
 * de uma história sem entrar nela (a lista de histórias pinta cada cartão com o tema da sua).
 *
 * Fica fora de `commonStyles` porque lê o store de tema, que puxa serviço e banco: um arquivo
 * de fábricas de estilo não pode arrastar isso para todo componente que importa uma margem.
 * Para as cores da história **atual**, use `useTheme` - ele não custa nada disso.
 */
export const useThemeColors = (themeName: string | null | undefined): ThemeColors => {
  const { darkMode } = useThemeStore();
  const selectedTheme = themes[themeName || 'default'] || themes['default'];
  return darkMode ? selectedTheme.darkColors : selectedTheme.lightColors;
};
