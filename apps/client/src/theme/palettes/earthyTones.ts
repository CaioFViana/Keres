import { ThemeColors } from '../ThemeColors';

const lightColors: ThemeColors = {
  primary: '#6D4C41', // Brown (Darker earth tone)
  primaryVariant: '#8D6E63', // Lighter Brown
  primaryContainer: '#D7CCC8', // Very light brown/beige
  onPrimaryContainer: '#6D4C41', // On Very light brown
  secondary: '#FFB74D', // Orange (Sun/sand)
  secondaryVariant: '#FF9800', // Darker Orange
  background: '#FBE9E7', // Lightest peach/beige background
  surface: '#FFFFFF',
  error: '#B00020',
  onPrimary: '#FFFFFF',
  onSecondary: '#000000',
  onBackground: '#000000',
  onSurface: '#000000',
  onError: '#FFFFFF',
  text: '#000000',
  textSecondary: '#666666',
  card: '#EFEBE9', // Light beige for cards
  border: '#BCAAA4', // Medium beige border
  notification: '#FFC107',
  accent: '#4CAF50', // Green accent (foliage)
  star: '#FFD700',
  shadow: '#000000',
};

const darkColors: ThemeColors = {
  primary: '#A1887F', // Lighter Brown for dark mode
  primaryVariant: '#8D6E63', // Brown
  primaryContainer: '#5D4037', // Dark Brown
  onPrimaryContainer: '#D7CCC8', // On Dark Brown
  secondary: '#FFCC80', // Light Orange (Sun/sand)
  secondaryVariant: '#FFB74D', // Orange
  background: '#3E2723', // Very dark brown background
  surface: '#2C1D1B', // Darker brown
  error: '#CF6679',
  onPrimary: '#FFFFFF',
  onSecondary: '#000000',
  onBackground: '#FFFFFF',
  onSurface: '#FFFFFF',
  onError: '#000000',
  text: '#FFFFFF',
  textSecondary: '#AAAAAA',
  card: '#4E342E', // Dark brown for cards
  border: '#6D4C41', // Medium brown border
  notification: '#FFC107',
  accent: '#81C784', // Lighter green accent
  star: '#FFD700',
  shadow: 'rgba(255, 255, 255, 0.2)',
};

export const earthyTonesTheme = { lightColors, darkColors };
