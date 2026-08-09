import { ThemeColors } from '../ThemeColors';

const lightColors: ThemeColors = {
  primary: '#5F5E62', primaryVariant: '#47464A', primaryContainer: '#E4E1E6', onPrimaryContainer: '#1C1B1F',
  secondary: '#5D5F62', secondaryVariant: '#45474A', background: '#FAF9FC', surface: '#FFFBFF',
  error: '#BA1A1A', onPrimary: '#FFFFFF', onSecondary: '#FFFFFF', onBackground: '#1C1B1F', onSurface: '#1C1B1F', onError: '#FFFFFF',
  text: '#1C1B1F', textSecondary: '#5F5E62', card: '#F0EEF2', border: '#C9C5CA', notification: '#805B00', accent: '#406A9A', star: '#8A6500', shadow: '#000000',
};

const darkColors: ThemeColors = {
  primary: '#C9C5CA', primaryVariant: '#AEAAAF', primaryContainer: '#47464A', onPrimaryContainer: '#E4E1E6',
  secondary: '#C5C6CA', secondaryVariant: '#AAABAE', background: '#141315', surface: '#1D1B1E',
  error: '#FFB4AB', onPrimary: '#303034', onSecondary: '#2F3033', onBackground: '#E6E1E6', onSurface: '#E6E1E6', onError: '#690005',
  text: '#E6E1E6', textSecondary: '#C9C5CA', card: '#272529', border: '#47464A', notification: '#FFD166', accent: '#A8C7FA', star: '#FFD166', shadow: '#000000',
};

export const monochromaticGrayTheme = { lightColors, darkColors };
