import { ThemeColors } from '../ThemeColors';

const lightColors: ThemeColors = {
  primary: '#C62828', // Dark Red
  primaryVariant: '#B71C1C', // Even Darker Red
  primaryContainer: '#FFCDD2', // Light Red
  onPrimaryContainer: '#C62828', // On Light Red
  secondary: '#FF8A65', // Lighter Orange-Red (Sunset feel)
  secondaryVariant: '#FF5722', // Orange-Red
  background: '#FFF8E1', // Very light cream/peach background
  surface: '#FFFFFF',
  error: '#B00020',
  onPrimary: '#FFFFFF',
  onSecondary: '#000000',
  onBackground: '#000000',
  onSurface: '#000000',
  onError: '#FFFFFF',
  text: '#000000',
  textSecondary: '#666666',
  card: '#FFEBEE', // Pale red for cards
  border: '#EF9A9A', // Lighter Red border
  notification: '#FFC107',
  accent: '#4CAF50', // Green for contrast
  star: '#FFD700',
  shadow: '#000000',
};

const darkColors: ThemeColors = {
  primary: '#EF5350', // Lighter Red for dark mode
  primaryVariant: '#E53935', // Red
  primaryContainer: '#C62828', // Dark Red
  onPrimaryContainer: '#FFCDD2', // On Dark Red
  secondary: '#FFAB91', // Orange-Red
  secondaryVariant: '#FF8A65', // Lighter Orange-Red
  background: '#3A0000', // Very dark deep red background
  surface: '#2C0000', // Darker deep red
  error: '#CF6679',
  onPrimary: '#FFFFFF',
  onSecondary: '#000000',
  onBackground: '#FFFFFF',
  onSurface: '#FFFFFF',
  onError: '#000000',
  text: '#FFFFFF',
  textSecondary: '#AAAAAA',
  card: '#4F0000', // Darker red for cards
  border: '#7F0000', // Dark Red border
  notification: '#FFC107',
  accent: '#81C784', // Lighter green accent
  star: '#FFD700',
  shadow: 'rgba(255, 255, 255, 0.2)',
};

export const crimsonSunsetTheme = { lightColors, darkColors };
