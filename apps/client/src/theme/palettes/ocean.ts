import { ThemeColors } from '../ThemeColors';

const lightColors: ThemeColors = {
  primary: '#00658F', primaryVariant: '#004C6C', primaryContainer: '#C7E7FF', onPrimaryContainer: '#001E2F',
  secondary: '#406476', secondaryVariant: '#284B5C', background: '#F6FAFD', surface: '#FCFCFF',
  error: '#BA1A1A', onPrimary: '#FFFFFF', onSecondary: '#FFFFFF', onBackground: '#191C1E', onSurface: '#191C1E', onError: '#FFFFFF',
  text: '#191C1E', textSecondary: '#4D616B', card: '#EAF3F8', border: '#B9C9D1', notification: '#805B00', accent: '#006A60', star: '#8A6500', shadow: '#000000',
};

const darkColors: ThemeColors = {
  primary: '#70D1FF', primaryVariant: '#3AB8EA', primaryContainer: '#004D6D', onPrimaryContainer: '#C7E7FF',
  secondary: '#A8CCDF', secondaryVariant: '#8DB1C3', background: '#10191D', surface: '#161F23',
  error: '#FFB4AB', onPrimary: '#00344D', onSecondary: '#103442', onBackground: '#E0E3E5', onSurface: '#E0E3E5', onError: '#690005',
  text: '#E0E3E5', textSecondary: '#B9C9D1', card: '#202A2F', border: '#3E4A50', notification: '#FFD166', accent: '#70F7E6', star: '#FFD166', shadow: '#000000',
};

export const oceanTheme = { lightColors, darkColors };
