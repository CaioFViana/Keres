import { StyleSheet } from 'react-native';
import type { ThemeColors } from '../../../../theme/ThemeColors'; // Corrected import

export const createLocationStyles = (
  colors: ThemeColors, // Corrected type
) =>
  StyleSheet.create({
    headerLeft: {
      flex: 1,
      justifyContent: 'center',
    },
    name: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 4,
    },
    itemTitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 2,
    },
    summaryText: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    descriptionText: {
      fontSize: 14,
      color: colors.text,
      marginBottom: 4,
    },
  });
