import { ThemeColors } from '../ThemeColors';

const lightColors: ThemeColors = {
  primary: '#424242', // Dark Gray
  primaryVariant: '#616161', // Medium Gray
  primaryContainer: '#EEEEEE', // Very Light Gray
  onPrimaryContainer: '#424242', // On Very Light Gray
  secondary: '#757575', // Gray
  secondaryVariant: '#9E9E9E', // Light Gray
  background: '#F5F5F5', // Lightest Gray background
  surface: '#FFFFFF',
  error: '#B00020',
  onPrimary: '#FFFFFF',
  onSecondary: '#FFFFFF',
  onBackground: '#000000',
  onSurface: '#000000',
  onError: '#FFFFFF',
  text: '#000000',
  textSecondary: '#666666',
  card: '#E0E0E0', // Lighter Gray for cards
  border: '#BDBDBD', // Medium-light Gray border
  notification: '#FFC107',
  accent: '#2196F3', // Vibrant Blue accent
  star: '#FFD700',
  shadow: '#000000',
};

const darkColors: ThemeColors = {
  primary: '#BDBDBD', // Light Gray for dark mode
  primaryVariant: '#9E9E9E', // Medium-light Gray
  primaryContainer: '#616161', // Medium Gray
  onPrimaryContainer: '#EEEEEE', // On Medium Gray
  secondary: '#757575', // Gray
  secondaryVariant: '#424242', // Dark Gray
  background: '#212121', // Very Dark Gray background
  surface: '#303030', // Darker Gray
  error: '#CF6679',
  onPrimary: '#000000',
  onSecondary: '#000000',
  onBackground: '#FFFFFF',
  onSurface: '#FFFFFF',
  onError: '#000000',
  text: '#FFFFFF',
  textSecondary: '#AAAAAA',
  card: '#424242', // Dark Gray for cards
  border: '#616161', // Medium Gray border
  notification: '#FFC107',
  accent: '#64B5F6', // Lighter Vibrant Blue accent
  star: '#FFD700',
  shadow: 'rgba(255, 255, 255, 0.2)',
};

export const monochromaticGrayTheme = { lightColors, darkColors };
