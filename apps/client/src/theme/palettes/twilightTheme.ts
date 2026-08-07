import { ThemeColors } from '../ThemeColors';

const lightColors: ThemeColors = {
  primary: '#3F51B5', // Indigo
  primaryVariant: '#303F9F', // Darker Indigo
  primaryContainer: '#C5CAE9', // Light Indigo
  onPrimaryContainer: '#3F51B5', // On Light Indigo
  secondary: '#FF4081', // Pink (accent/complementary)
  secondaryVariant: '#F50057', // Darker Pink
  background: '#E8EAF6', // Very light indigo background
  surface: '#FFFFFF',
  error: '#B00020',
  onPrimary: '#FFFFFF',
  onSecondary: '#FFFFFF',
  onBackground: '#000000',
  onSurface: '#000000',
  onError: '#FFFFFF',
  text: '#000000',
  textSecondary: '#666666',
  card: '#C5CAE9', // Pale indigo for cards
  border: '#9FA8DA', // Lighter Indigo border
  notification: '#FFC107',
  accent: '#00BCD4', // Cyan accent
  star: '#FFD700',
  shadow: '#000000',
};

const darkColors: ThemeColors = {
  primary: '#7986CB', // Lighter Indigo for dark mode
  primaryVariant: '#5C6BC0', // Indigo
  primaryContainer: '#3F51B5', // Dark Indigo
  onPrimaryContainer: '#C5CAE9', // On Dark Indigo
  secondary: '#F48FB1', // Light Pink
  secondaryVariant: '#FF4081', // Pink
  background: '#1A237E', // Very dark indigo background
  surface: '#0F155E', // Darker indigo
  error: '#CF6679',
  onPrimary: '#FFFFFF',
  onSecondary: '#000000',
  onBackground: '#FFFFFF',
  onSurface: '#FFFFFF',
  onError: '#000000',
  text: '#FFFFFF',
  textSecondary: '#AAAAAA',
  card: '#283593', // Dark indigo for cards
  border: '#3F51B5', // Medium indigo border
  notification: '#FFC107',
  accent: '#4DD0E1', // Lighter Cyan accent
  star: '#FFD700',
  shadow: 'rgba(255, 255, 255, 0.2)',
};

export const twilightTheme = { lightColors, darkColors };
