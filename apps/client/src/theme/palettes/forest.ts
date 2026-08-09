import { ThemeColors } from '../ThemeColors';

const lightColors: ThemeColors = {
  primary: '#3F6B2A', primaryVariant: '#295315', primaryContainer: '#C0F1A6', onPrimaryContainer: '#102000',
  secondary: '#52634A', secondaryVariant: '#3B4B34', background: '#F8FBF4', surface: '#FDFDF9',
  error: '#BA1A1A', onPrimary: '#FFFFFF', onSecondary: '#FFFFFF', onBackground: '#1A1C18', onSurface: '#1A1C18', onError: '#FFFFFF',
  text: '#1A1C18', textSecondary: '#596057', card: '#EDF3E8', border: '#C2CABB', notification: '#805B00', accent: '#2E7D32', star: '#8A6500', shadow: '#000000',
};

const darkColors: ThemeColors = {
  primary: '#A5D786', primaryVariant: '#8EBD70', primaryContainer: '#285414', onPrimaryContainer: '#C0F1A6',
  secondary: '#BBCBB0', secondaryVariant: '#A0B097', background: '#141812', surface: '#1A1E17',
  error: '#FFB4AB', onPrimary: '#193800', onSecondary: '#263423', onBackground: '#E2E4DD', onSurface: '#E2E4DD', onError: '#690005',
  text: '#E2E4DD', textSecondary: '#C2CABB', card: '#242A20', border: '#41493C', notification: '#FFD166', accent: '#9CE59A', star: '#FFD166', shadow: '#000000',
};

export const forestTheme = { lightColors, darkColors };
