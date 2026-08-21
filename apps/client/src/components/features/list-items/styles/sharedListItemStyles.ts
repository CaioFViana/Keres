import { StyleSheet } from 'react-native';
import { ThemeColors } from '../../../../theme';

/**
 * `characterListItemStyles.ts` e `worldRuleListItemStyles.ts` eram idênticos linha a linha;
 * `chapterListItemStyles.ts`, `choiceListItemStyles.ts` e `sceneListItemStyles.ts` também
 * compartilhavam a mesma forma. Uma factory só por formato, em vez de um arquivo por entidade.
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
