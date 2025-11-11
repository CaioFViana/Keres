import { ThemeColors } from '../types';

const lightColors: ThemeColors = {
  primary: '#6200EE',
  primaryVariant: '#3700B3',
  secondary: '#03DAC6',
  secondaryVariant: '#018786',
  background: '#FFFFFF',
  surface: '#FFFFFF',
  error: '#B00020',
  onPrimary: '#FFFFFF',
  onSecondary: '#000000',
  onBackground: '#000000',
  onSurface: '#000000',
  onError: '#FFFFFF',
  text: '#000000',
  textSecondary: '#666666',
  card: '#F5F5F5',
  border: '#E0E0E0',
  notification: '#FFC107',
  star: '#FFD700',
};

const darkColors: ThemeColors = {
  primary: '#BB86FC',
  primaryVariant: '#3700B3',
  secondary: '#03DAC6',
  secondaryVariant: '#03DAC6',
  background: '#121212',
  surface: '#121212',
  error: '#CF6679',
  onPrimary: '#000000',
  onSecondary: '#000000',
  onBackground: '#FFFFFF',
  onSurface: '#FFFFFF',
  onError: '#000000',
  text: '#FFFFFF',
  textSecondary: '#AAAAAA',
  card: '#1E1E1E',
  border: '#333333',
  notification: '#FFC107',
  star: '#FFD700',
};

export const defaultTheme = { lightColors, darkColors };
