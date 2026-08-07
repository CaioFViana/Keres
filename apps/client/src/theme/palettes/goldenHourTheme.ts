import { ThemeColors } from '../ThemeColors';

const lightColors: ThemeColors = {
  primary: '#FFD140', // Golden Yellow
  primaryVariant: '#FFC107', // Amber
  primaryContainer: '#FFFDE7', // Very Light Yellow
  onPrimaryContainer: '#FFD140', // On Very Light Yellow
  secondary: '#8BC34A', // Light Green (complementary/nature)
  secondaryVariant: '#689F38', // Darker Green
  background: '#FFFDE7', // Lightest Yellow background
  surface: '#FFFFFF',
  error: '#B00020',
  onPrimary: '#000000', // Black text on yellow
  onSecondary: '#FFFFFF',
  onBackground: '#000000',
  onSurface: '#000000',
  onError: '#FFFFFF',
  text: '#000000',
  textSecondary: '#666666',
  card: '#FFF9C4', // Pale Yellow for cards
  border: '#FFEE58', // Brighter Yellow border
  notification: '#FFC107',
  accent: '#2196F3', // Blue accent
  star: '#FFD700',
  shadow: '#000000',
};

const darkColors: ThemeColors = {
  primary: '#FFECB3', // Very Light Yellow for dark mode
  primaryVariant: '#FFD700', // Gold
  primaryContainer: '#FFC107', // Amber
  onPrimaryContainer: '#000000', // On Amber
  secondary: '#A5D6A7', // Light Green
  secondaryVariant: '#8BC34A', // Green
  background: '#3A3A00', // Dark Olive background
  surface: '#2C2C00', // Darker Olive
  error: '#CF6679',
  onPrimary: '#000000',
  onSecondary: '#000000',
  onBackground: '#FFFFFF',
  onSurface: '#FFFFFF',
  onError: '#000000',
  text: '#FFFFFF',
  textSecondary: '#AAAAAA',
  card: '#4D4D00', // Dark Olive for cards
  border: '#6B6B00', // Medium Olive border
  notification: '#FFC107',
  accent: '#64B5F6', // Lighter Blue accent
  star: '#FFD700',
  shadow: 'rgba(255, 255, 255, 0.2)',
};

export const goldenHourTheme = { lightColors, darkColors };
