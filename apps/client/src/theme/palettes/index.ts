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
import { scarletFlamesTheme } from './scarletFlamesTheme';
import { seaOfStarsTheme } from './seaOfStarsTheme';
import { sunsetTheme } from './sunset';
import { twilightTheme } from './twilightTheme';

export type Theme = {
  lightColors: ThemeColors;
  darkColors: ThemeColors;
};

export const themes: { [key: string]: Theme } = {
  default: defaultTheme,
  scarletFlames: scarletFlamesTheme,
  sunset: sunsetTheme,
  goldenHour: goldenHourTheme,
  forest: forestTheme,
  ocean: oceanTheme,
  twilight: twilightTheme,
  amethyst: amethystTheme,
  earthyTones: earthyTonesTheme,
  cherryBlossom: cherryBlossomTheme,
  monochromaticGray: monochromaticGrayTheme,
  crimsonSunset: crimsonSunsetTheme,
  seaOfStars: seaOfStarsTheme,
};

export const themeDisplayOptions = [
  { value: 'default', labelKey: 'theme_default_label' },
  { value: 'scarletFlames', labelKey: 'theme_scarletFlames_label' },
  { value: 'sunset', labelKey: 'theme_sunset_label' },
  { value: 'goldenHour', labelKey: 'theme_goldenHour_label' },
  { value: 'forest', labelKey: 'theme_forest_label' },
  { value: 'ocean', labelKey: 'theme_ocean_label' },
  { value: 'twilight', labelKey: 'theme_twilight_label' },
  { value: 'amethyst', labelKey: 'theme_amethyst_label' },
  { value: 'earthyTones', labelKey: 'theme_earthyTones_label' },
  { value: 'cherryBlossom', labelKey: 'theme_cherryBlossom_label' },
  { value: 'monochromaticGray', labelKey: 'theme_monochromaticGray_label' },
  { value: 'crimsonSunset', labelKey: 'theme_crimsonSunset_label' },
  { value: 'seaOfStars', labelKey: 'theme_seaOfStars_label' },
];
