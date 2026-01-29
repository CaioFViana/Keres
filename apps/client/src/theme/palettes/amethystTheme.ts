import { ThemeColors } from '../ThemeColors';

const lightColors: ThemeColors = {
  primary: '#7B1FA2', // Dark Violet
  primaryVariant: '#6A1B9A', // Even Darker Violet
  primaryContainer: '#E1BEE7', // Light Violet
  onPrimaryContainer: '#7B1FA2', // On Light Violet
  secondary: '#8BC34A', // Light Green (complementary/fresh)
  secondaryVariant: '#689F38', // Darker Green
  background: '#F3E5F5', // Very light violet background
  surface: '#FFFFFF',
  error: '#B00020',
  onPrimary: '#FFFFFF',
  onSecondary: '#FFFFFF',
  onBackground: '#000000',
  onSurface: '#000000',
  onError: '#FFFFFF',
  text: '#000000',
  textSecondary: '#666666',
  card: '#E1BEE7', // Pale violet for cards
  border: '#CE93D8', // Lighter Violet border
  notification: '#FFC107',
  accent: '#00BCD4', // Cyan accent
  star: '#FFD700',
  shadow: '#000000',
};

const darkColors: ThemeColors = {
  primary: '#BA68C8', // Lighter Violet for dark mode
  primaryVariant: '#9C27B0', // Violet
  primaryContainer: '#7B1FA2', // Dark Violet
  onPrimaryContainer: '#E1BEE7', // On Dark Violet
  secondary: '#A5D6A7', // Light Green
  secondaryVariant: '#8BC34A', // Green
  background: '#3A003A', // Very dark deep violet background
  surface: '#2C002C', // Darker deep violet
  error: '#CF6679',
  onPrimary: '#FFFFFF',
  onSecondary: '#000000',
  onBackground: '#FFFFFF',
  onSurface: '#FFFFFF',
  onError: '#000000',
  text: '#FFFFFF',
  textSecondary: '#AAAAAA',
  card: '#4F004F', // Darker violet for cards
  border: '#7F007F', // Dark Violet border
  notification: '#FFC107',
  accent: '#4DD0E1', // Lighter Cyan accent
  star: '#FFD700',
  shadow: 'rgba(255, 255, 255, 0.2)',
};

export const amethystTheme = { lightColors, darkColors };
