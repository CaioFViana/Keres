import { Ionicons } from '@expo/vector-icons';
import { getEntityAppearance } from '@keres/shared';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import { useTheme } from '../../../../theme';

export interface GuidedEmptyStateAction {
  label: string;
  onPress: () => void;
  testID?: string;
}

export const GuidedEmptyState: React.FC<{
  title?: string;
  message?: string;
  actions?: GuidedEmptyStateAction[];
  entityName?: string;
  fallbackText: string;
}> = ({ title, message, actions, entityName, fallbackText }) => {
  const { colors } = useTheme();
  const entityIcon = entityName
    ? (getEntityAppearance(entityName).icon as keyof typeof Ionicons.glyphMap)
    : null;
  const visibleActions = (actions ?? []).slice(0, 2);
  if (!title && !message && visibleActions.length === 0) {
    return <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{fallbackText}</Text>;
  }
  return (
    <View style={styles.guidedEmpty} testID="guided-empty-state">
      {entityIcon ? (
        <View
          style={[styles.iconWrap, { backgroundColor: colors.primaryContainer }]}
          testID="guided-empty-icon"
        >
          <Ionicons name={entityIcon} size={28} color={colors.onPrimaryContainer} />
        </View>
      ) : null}
      {title ? <Text style={[styles.title, { color: colors.text }]}>{title}</Text> : null}
      {message ? (
        <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
      ) : null}
      {visibleActions.map((action, index) => (
        <Button
          key={action.testID ?? `guided-empty-action-${index}`}
          onPress={action.onPress}
          testID={action.testID ?? `guided-empty-action-${index}`}
          style={styles.button}
        >
          {action.label}
        </Button>
      ))}
    </View>
  );
};

/**
 * The list has rows, but the search and the filters leave none. It says so - the plain "no X yet"
 * would claim the list is empty - and offers the way back.
 */
export const NoResultsState: React.FC<{ onClear: () => void }> = ({ onClear }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <View style={styles.guidedEmpty} testID="no-results-state">
      <View style={[styles.iconWrap, { backgroundColor: colors.primaryContainer }]}>
        <Ionicons name="search-outline" size={28} color={colors.onPrimaryContainer} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{t('list_no_results_title')}</Text>
      <Text style={[styles.message, { color: colors.textSecondary }]}>
        {t('list_no_results_message')}
      </Text>
      <Button onPress={onClear} testID="no-results-clear" style={styles.button}>
        {t('list_clear_filters')}
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
  },
  guidedEmpty: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    gap: 12,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  title: {
    fontSize: 17,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  button: {
    marginTop: 4,
    minWidth: 200,
  },
});
