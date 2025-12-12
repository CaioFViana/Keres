import { ThemeColors } from '../ThemeColors';

const lightColors: ThemeColors = {
  primary: '#6B8E23', // OliveDrab
  primaryVariant: '#8FBC8F', // DarkSeaGreen
  secondary: '#556B2F', // DarkOliveGreen
  secondaryVariant: '#6B8E23', // OliveDrab
  background: '#E6F2E6', // Pastel green
  surface: '#FFFFFF',
  error: '#DC3545',
  onPrimary: '#FFFFFF',
  onSecondary: '#FFFFFF',
  onBackground: '#000000',
  onSurface: '#000000',
  onError: '#FFFFFF',
  text: '#000000',
  textSecondary: '#666666',
  card: '#C1E1C1', // Light pastel green
  border: '#A3D9A3', // Medium Green
  notification: '#FFC107',
  accent: '#7CFC00', // Lawn Green for a vibrant accent
  star: '#FFD700',
};

const darkColors: ThemeColors = {
  primary: '#8FBC8F', // DarkSeaGreen
  primaryVariant: '#6B8E23', // OliveDrab
  secondary: '#556B2F', // DarkOliveGreen
  secondaryVariant: '#6B8E23', // OliveDrab
  background: '#2F3E2F', // Dark green with subtle tint
  surface: '#3A4D3A', // Slightly lighter dark green
  error: '#FF6347', // Tomato
  onPrimary: '#FFFFFF',
  onSecondary: '#FFFFFF',
  onBackground: '#FFFFFF',
  onSurface: '#FFFFFF',
  onError: '#000000',
  text: '#FFFFFF',
  textSecondary: '#AAAAAA',
  card: '#3D523D', // Darker green with subtle tint
  border: '#4F6F4F', // Medium Dark Green
  notification: '#FFC107',
  accent: '#A2FF2C', // A bright green for accent in dark mode
  star: '#FFD700',
};

export const forestTheme = { lightColors, darkColors };
