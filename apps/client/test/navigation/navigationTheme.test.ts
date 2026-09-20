import type { ThemeColors } from '@keres/shared';
import { DefaultTheme } from '@react-navigation/native';
import { buildNavigationTheme } from '../../src/navigation/navigationTheme';

const palette: ThemeColors = {
  primary: '#0000ff',
  primaryVariant: '#0000cc',
  primaryContainer: '#e0e0ff',
  onPrimaryContainer: '#000088',
  secondary: '#00aa00',
  secondaryVariant: '#008800',
  background: '#ffffff',
  surface: '#f0f0f0',
  error: '#ff0000',
  onPrimary: '#ffffff',
  onSecondary: '#ffffff',
  onBackground: '#000000',
  onSurface: '#111111',
  onError: '#ffffff',
  text: '#111111',
  textSecondary: '#555555',
  card: '#fafafa',
  border: '#cccccc',
  notification: '#ff0000',
  onNotification: '#ffffff',
  accent: '#ff8800',
  onAccent: '#000000',
  star: '#ffdd00',
  shadow: '#000000',
};

describe('buildNavigationTheme', () => {
  it.each([true, false])('maps the app palette with dark=%s', (isDarkMode) => {
    expect(buildNavigationTheme(palette, isDarkMode)).toEqual({
      ...DefaultTheme,
      dark: isDarkMode,
      colors: {
        ...DefaultTheme.colors,
        primary: palette.primary,
        background: palette.background,
        card: palette.surface,
        text: palette.text,
        border: palette.border,
        notification: palette.notification,
      },
    });
  });
});
