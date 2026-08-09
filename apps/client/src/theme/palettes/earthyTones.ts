import { ThemeColors } from '../ThemeColors';

const lightColors: ThemeColors = {
  primary: '#76513A', primaryVariant: '#5B3B27', primaryContainer: '#FFDBC8', onPrimaryContainer: '#2C1609',
  secondary: '#8A4F2D', secondaryVariant: '#6C3A1E', background: '#FFF9F6', surface: '#FFFBFF',
  error: '#BA1A1A', onPrimary: '#FFFFFF', onSecondary: '#FFFFFF', onBackground: '#211A17', onSurface: '#211A17', onError: '#FFFFFF',
  text: '#211A17', textSecondary: '#625B56', card: '#F8EEE8', border: '#DFC3B5', notification: '#805B00', accent: '#8A4F2D', star: '#8A6500', shadow: '#000000',
};

const darkColors: ThemeColors = {
  primary: '#E9BDA3', primaryVariant: '#CDA58D', primaryContainer: '#5B3D29', onPrimaryContainer: '#FFDBC8',
  secondary: '#FFB68D', secondaryVariant: '#E99C74', background: '#1D1713', surface: '#251D18',
  error: '#FFB4AB', onPrimary: '#442511', onSecondary: '#51230F', onBackground: '#EDE0DA', onSurface: '#EDE0DA', onError: '#690005',
  text: '#EDE0DA', textSecondary: '#D5C2B8', card: '#30251F', border: '#51443C', notification: '#FFD166', accent: '#FFB68D', star: '#FFD166', shadow: '#000000',
};

export const earthyTonesTheme = { lightColors, darkColors };
