import { ThemeColors } from '../ThemeColors';

const lightColors: ThemeColors = {
  primary: '#4682B4', // SteelBlue
  primaryVariant: '#5F9EA0', // CadetBlue
  primaryContainer: '#BBDEFB', // Added light blue
  onPrimaryContainer: '#1976D2', // Added dark blue
  secondary: '#6A5ACD', // SlateBlue
  secondaryVariant: '#7B68EE', // MediumSlateBlue
  background: '#E0F2F7', // Light Cyan - Pastel blue
  surface: '#FFFFFF',
  error: '#DC3545',
  onPrimary: '#FFFFFF',
  onSecondary: '#FFFFFF',
  onBackground: '#000000',
  onSurface: '#000000',
  onError: '#FFFFFF',
  text: '#000000',
  textSecondary: '#666666',
  card: '#B0E0E6', // PowderBlue - Pastel blue
  border: '#ADD8E6', // Light Blue
  notification: '#FFC107',
  accent: '#00BCD4', // Cyan for a vibrant accent
  star: '#FFD700',
  shadow: '#000000', // Added shadow for light theme
};

const darkColors: ThemeColors = {
  primary: '#6A5ACD', // SlateBlue
  primaryVariant: '#7B68EE', // MediumSlateBlue
  primaryContainer: '#3F51B5', // Added darker blue
  onPrimaryContainer: '#BBDEFB', // Added light blue
  secondary: '#4682B4', // SteelBlue
  secondaryVariant: '#5F9EA0', // CadetBlue
  background: '#1A2B3C', // Dark blue with subtle tint
  surface: '#2A3B4C', // Slightly lighter dark blue
  error: '#FF6347', // Tomato
  onPrimary: '#FFFFFF',
  onSecondary: '#FFFFFF',
  onBackground: '#FFFFFF',
  onSurface: '#FFFFFF',
  onError: '#000000',
  text: '#FFFFFF',
  textSecondary: '#AAAAAA',
  card: '#2C405A', // Darker blue with subtle tint
  border: '#3A506B', // Medium dark blue
  notification: '#FFC107',
  accent: '#4DD0E1', // A lighter cyan for accent in dark mode
  star: '#FFD700',
  shadow: 'rgba(255, 255, 255, 0.2)', // Added shadow for dark theme
};

export const oceanTheme = { lightColors, darkColors };
