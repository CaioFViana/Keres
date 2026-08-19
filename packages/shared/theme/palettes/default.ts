import { ThemeColors } from '../ThemeColors';

const lightColors: ThemeColors = {
  primary: '#6200EE',
  primaryVariant: '#3700B3',
  primaryContainer: '#EADDFF', // Added
  onPrimaryContainer: '#21005D', // Added
  secondary: '#7E57C2',
  secondaryVariant: '#5E35B1',
  background: '#FFFFFF',
  surface: '#FFFFFF',
  error: '#B00020',
  onPrimary: '#FFFFFF',
  onSecondary: '#FFFFFF',
  onBackground: '#000000',
  onSurface: '#000000',
  onError: '#FFFFFF',
  text: '#000000',
  textSecondary: '#666666',
  card: '#F5F5F5',
  border: '#E0E0E0',
  notification: '#FFC107',
  accent: '#00C853', // A shade of green for accent
  star: '#FFD700',
  shadow: '#000000', // Added shadow for light theme
};

const darkColors: ThemeColors = {
  primary: '#BB86FC',
  primaryVariant: '#3700B3',
  primaryContainer: '#4F378B', // Added
  onPrimaryContainer: '#EADDFF', // Added
  secondary: '#D0BCFF',
  secondaryVariant: '#B69DF8',
  background: '#121212',
  surface: '#121212',
  error: '#CF6679',
  onPrimary: '#000000',
  onSecondary: '#381E72',
  onBackground: '#FFFFFF',
  onSurface: '#FFFFFF',
  onError: '#000000',
  text: '#FFFFFF',
  textSecondary: '#AAAAAA',
  card: '#1E1E1E',
  border: '#333333',
  notification: '#FFC107',
  accent: '#69F0AE', // A lighter shade of green for accent in dark mode
  star: '#FFD700',
  shadow: 'rgba(255, 255, 255, 0.2)', // Added shadow for dark theme (slightly transparent white)
};

export const defaultTheme = { lightColors, darkColors };
