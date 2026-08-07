import { ThemeColors } from '../ThemeColors';

const lightColors: ThemeColors = {
  primary: '#E65100', // Deep Orange
  primaryVariant: '#BF360C', // Dark Orange
  primaryContainer: '#FFCCBC', // Light Orange
  onPrimaryContainer: '#E65100', // On Light Orange
  secondary: '#FFC107', // Amber
  secondaryVariant: '#FFA000', // Dark Amber
  background: '#FFF3E0', // Very light orange/cream
  surface: '#FFFFFF',
  error: '#B00020',
  onPrimary: '#FFFFFF',
  onSecondary: '#000000',
  onBackground: '#000000',
  onSurface: '#000000',
  onError: '#FFFFFF',
  text: '#000000',
  textSecondary: '#666666',
  card: '#FFECB3', // Pale Yellow for cards
  border: '#FFD54F', // Light Amber border
  notification: '#FFC107',
  accent: '#E91E63', // Pinkish-Red accent
  star: '#FFD700',
  shadow: '#000000',
};

const darkColors: ThemeColors = {
  primary: '#FF8A65', // Lighter Orange for dark mode
  primaryVariant: '#FF7043', // Orange
  primaryContainer: '#D84315', // Dark Orange
  onPrimaryContainer: '#FFCCBC', // On Dark Orange
  secondary: '#FFD54F', // Light Amber
  secondaryVariant: '#FFC107', // Amber
  background: '#3E2723', // Dark Brown background
  surface: '#2C1D1B', // Slightly lighter dark brown
  error: '#CF6679',
  onPrimary: '#000000',
  onSecondary: '#000000',
  onBackground: '#FFFFFF',
  onSurface: '#FFFFFF',
  onError: '#000000',
  text: '#FFFFFF',
  textSecondary: '#AAAAAA',
  card: '#5D4037', // Medium Brown for cards
  border: '#8D6E63', // Lighter Brown border
  notification: '#FFC107',
  accent: '#F06292', // Lighter Pink accent
  star: '#FFD700',
  shadow: 'rgba(255, 255, 255, 0.2)',
};

export const sunsetTheme = { lightColors, darkColors };
