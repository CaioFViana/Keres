import { StyleSheet } from 'react-native';
import type { ThemeColors } from '../../../../theme';

/**
 * `characterListItemStyles.ts` and `worldRuleListItemStyles.ts` were identical line by line;
 * `chapterListItemStyles.ts`, `choiceListItemStyles.ts` and `sceneListItemStyles.ts` also
 * shared the same shape. One factory per shape, instead of one file per entity.
 */
export const createSimpleEntityListItemStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flexShrink: 1,
    },
    name: {
      color: colors.text,
      fontSize: 18,
      fontWeight: 'bold',
      marginRight: 10,
    },
    itemTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 5,
    },
    summaryText: {
      color: colors.textSecondary,
      fontSize: 14,
      marginBottom: 5,
    },
    descriptionText: {
      color: colors.text,
      fontSize: 14,
      marginTop: 5,
    },
  });

export const createReferenceListItemStyles = (colors: ThemeColors) =>
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
      flexShrink: 1,
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
