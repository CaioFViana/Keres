import { StyleSheet } from 'react-native';
import { ThemeColors } from '../../../../theme';

export const createSceneStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    headerLeft: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    name: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      flexShrink: 1, // Allow text to shrink
    },
    summaryText: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 4,
    },
    notesText: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 4,
    },
  });
