import { ThemeColors } from '../ThemeColors';
import { defaultTheme } from './default';
import { forestTheme } from './forest';
import { oceanTheme } from './ocean';

export type Theme = {
  lightColors: ThemeColors;
  darkColors: ThemeColors;
};

export const themes: { [key: string]: Theme } = {
  default: defaultTheme,
  ocean: oceanTheme,
  forest: forestTheme,
};
