import { ThemeColors } from './types';
import { StyleSheet } from 'react-native';

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
