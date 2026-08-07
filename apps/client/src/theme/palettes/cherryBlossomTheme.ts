import { ThemeColors } from '../ThemeColors';

const lightColors: ThemeColors = {
  primary: '#F48FB1', // Light Pink
  primaryVariant: '#E91E63', // Medium Pink
  primaryContainer: '#F8BBD0', // Very Light Pink
  onPrimaryContainer: '#E91E63', // On Very Light Pink
  secondary: '#8BC34A', // Green (complementary for freshness)
  secondaryVariant: '#689F38', // Darker Green
  background: '#FCE4EC', // Softest Pink background
  surface: '#FFFFFF',
  error: '#B00020',
  onPrimary: '#000000', // Black text on pink
  onSecondary: '#FFFFFF',
  onBackground: '#000000',
  onSurface: '#000000',
  onError: '#FFFFFF',
  text: '#000000',
  textSecondary: '#666666',
  card: '#FCE4EC', // Soft pink for cards
  border: '#F48FB1', // Light Pink border
  notification: '#FFC107',
  accent: '#00BCD4', // Cyan accent
  star: '#FFD700',
  shadow: '#000000',
};

const darkColors: ThemeColors = {
  primary: '#FF80AB', // Brighter Pink for dark mode
  primaryVariant: '#F50057', // Vibrant Pink
  primaryContainer: '#C2185B', // Dark Pink
  onPrimaryContainer: '#F8BBD0', // On Dark Pink
  secondary: '#A5D6A7', // Light Green
  secondaryVariant: '#8BC34A', // Green
  background: '#4A142C', // Very dark maroon/pink background
  surface: '#330E1F', // Darker maroon/pink
  error: '#CF6679',
  onPrimary: '#FFFFFF',
  onSecondary: '#000000',
  onBackground: '#FFFFFF',
  onSurface: '#FFFFFF',
  onError: '#000000',
  text: '#FFFFFF',
  textSecondary: '#AAAAAA',
  card: '#5D1B36', // Darker pink for cards
  border: '#880E4F', // Medium Pink border
  notification: '#FFC107',
  accent: '#4DD0E1', // Lighter Cyan accent
  star: '#FFD700',
  shadow: 'rgba(255, 255, 255, 0.2)',
};

export const cherryBlossomTheme = { lightColors, darkColors };
