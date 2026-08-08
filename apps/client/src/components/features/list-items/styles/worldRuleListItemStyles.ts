import { StyleSheet } from 'react-native';
import { ThemeColors } from '../../../../theme';

export const createWorldRuleStyles = (colors: ThemeColors) => StyleSheet.create({
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
