import { ThemeColors } from '../ThemeColors';

const lightColors: ThemeColors = {
  primary: '#A83A45', primaryVariant: '#852732', primaryContainer: '#FFD9DC', onPrimaryContainer: '#40000A',
  secondary: '#8C5639', secondaryVariant: '#704027', background: '#FFF8F7', surface: '#FFFBFF',
  error: '#BA1A1A', onPrimary: '#FFFFFF', onSecondary: '#FFFFFF', onBackground: '#211A1B', onSurface: '#211A1B', onError: '#FFFFFF',
  text: '#211A1B', textSecondary: '#625B5C', card: '#FBECEE', border: '#E8BEC3', notification: '#805B00', accent: '#B64B00', star: '#8A6500', shadow: '#000000',
};

const darkColors: ThemeColors = {
  primary: '#FFB2B9', primaryVariant: '#FF8F9A', primaryContainer: '#872934', onPrimaryContainer: '#FFD9DC',
  secondary: '#FFB68C', secondaryVariant: '#E99C72', background: '#1D1214', surface: '#26191B',
  error: '#FFB4AB', onPrimary: '#650016', onSecondary: '#51240D', onBackground: '#EDE0E1', onSurface: '#EDE0E1', onError: '#690005',
  text: '#EDE0E1', textSecondary: '#D5C2C4', card: '#332326', border: '#554044', notification: '#FFD166', accent: '#FFB77A', star: '#FFD166', shadow: '#000000',
};

export const crimsonSunsetTheme = { lightColors, darkColors };
