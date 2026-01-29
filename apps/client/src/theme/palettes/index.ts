import { ThemeColors } from '../ThemeColors';
import { amethystTheme } from './amethystTheme';
import { cherryBlossomTheme } from './cherryBlossomTheme';
import { crimsonSunsetTheme } from './crimsonSunsetTheme';
import { defaultTheme } from './default';
import { earthyTonesTheme } from './earthyTones';
import { forestTheme } from './forest';
import { goldenHourTheme } from './goldenHourTheme';
import { monochromaticGrayTheme } from './monochromaticGray';
import { oceanTheme } from './ocean';
import { sunsetTheme } from './sunset';
import { twilightTheme } from './twilightTheme';

export type Theme = {
  lightColors: ThemeColors;
  darkColors: ThemeColors;
};

export const themes: { [key: string]: Theme } = {
  default: defaultTheme,
  ocean: oceanTheme,
  forest: forestTheme,
  sunset: sunsetTheme,
  monochromaticGray: monochromaticGrayTheme,
  earthyTones: earthyTonesTheme,
  crimsonSunset: crimsonSunsetTheme,
  goldenHour: goldenHourTheme,
  twilight: twilightTheme,
  amethyst: amethystTheme,
  cherryBlossom: cherryBlossomTheme
};

export const themeDisplayOptions = [
  { value: 'default', labelKey: 'theme_default_label' },
  { value: 'ocean', labelKey: 'theme_ocean_label' },
  { value: 'forest', labelKey: 'theme_forest_label' },
  { value: 'sunset', labelKey: 'theme_sunset_label' },
  { value: 'monochromaticGray', labelKey: 'theme_monochromaticGray_label' },
  { value: 'earthyTones', labelKey: 'theme_earthyTones_label' },
  { value: 'crimsonSunset', labelKey: 'theme_crimsonSunset_label' },
  { value: 'goldenHour', labelKey: 'theme_goldenHour_label' },
  { value: 'twilight', labelKey: 'theme_twilight_label' },
  { value: 'amethyst', labelKey: 'theme_amethyst_label' },
  { value: 'cherryBlossom', labelKey: "theme_cherryBlossom_label" }
];
