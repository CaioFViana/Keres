import { StyleSheet } from 'react-native';
import { useThemeStore } from '../state/themeStore';
import { themes } from './palettes';
import { ThemeColors } from './ThemeColors';

// Helper function to slightly saturate a hex color
export const saturateColor = (hex: string, factor: number = 1.1): string => {
  if (!hex || hex.length !== 7) return hex; // Expects #RRGGBB

  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);

  r = Math.min(255, Math.floor(r * factor));
  g = Math.min(255, Math.floor(g * factor));
  b = Math.min(255, Math.floor(b * factor));

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

export const isColorLight = (hexColor: string): boolean => {
  // Remove '#' if present
  const cleanHex = hexColor.startsWith('#') ? hexColor.slice(1) : hexColor;

  // Parse r, g, b values
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  // Calculate luminance (perceived brightness)
  // Formula: 0.299*R + 0.587*G + 0.114*B
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Return true if luminance is above a threshold (e.g., 0.5 for light, 0.5 for dark)
  // A common threshold is 0.5 or 0.6. Let's use 0.5 for now.
  return luminance > 0.5;
};

export const getThemeColors = (themeName: string | null | undefined): ThemeColors => {
  const { darkMode } = useThemeStore(); // Get darkMode state

  const selectedTheme = themes[themeName || 'default'] || themes["default"];

  return darkMode ? selectedTheme.darkColors : selectedTheme.lightColors;
};

export const getCommonCardStyles = (colors: ThemeColors) => StyleSheet.create({
  cardContainer: {
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderColor: colors.primary,
    borderWidth: 1,
    backgroundColor: saturateColor(colors.card),
  },
  cardText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.onSurface,
  },
});

export const getCommonContainerStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 20
  },
  // Add other common container styles here if needed
});

export const getCommonInputStyles = (colors: ThemeColors) => StyleSheet.create({
  input: {
    height: 50,
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 10,
    marginBottom: 0,
    color: colors.text,
    backgroundColor: colors.surface,
    width: '100%',
  },
  // Add other common input styles here if needed
});
