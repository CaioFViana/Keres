import { defaultTheme } from './default';
import { oceanTheme } from './ocean';
import { forestTheme } from './forest';
import { ThemeColors } from '../types';

export type Theme = {
  lightColors: ThemeColors;
  darkColors: ThemeColors;
};

export const themes: { [key: string]: Theme } = {
  default: defaultTheme,
  ocean: oceanTheme,
  forest: forestTheme,
};
