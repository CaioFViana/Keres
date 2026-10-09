import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getOnColorForFill } from '@keres/shared';
import { useTheme } from '../../../../theme';
import type { FavoriteFilterState } from '../../../../types/entityFilters';

/** Opens the field filters. It says what it is and how many fields are narrowing the list. */
export const FiltersButton: React.FC<{ count: number; onPress: () => void }> = ({
  count,
  onPress,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const onPrimary = getOnColorForFill(colors, colors.primary);
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.filters, { backgroundColor: colors.primary }]}
      accessibilityRole="button"
      accessibilityLabel={t('list_filters_button')}
      testID="list-filters-button"
    >
      <Ionicons name="options-outline" size={22} color={onPrimary} />
      <Text style={[styles.filtersLabel, { color: onPrimary }]}>{t('list_filters_button')}</Text>
      {count > 0 ? (
        <View
          style={[styles.badge, { backgroundColor: colors.accent }]}
          testID="list-filters-count"
        >
          <Text style={[styles.badgeText, { color: getOnColorForFill(colors, colors.accent) }]}>
            {count}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
};

const FAVORITE_ICON: Record<FavoriteFilterState, keyof typeof Ionicons.glyphMap> = {
  all: 'star-outline',
  favorite: 'star',
  'not-favorite': 'ban-outline',
};

/** Cycles all → favorites → not favorites. */
export const FavoriteFilterButton: React.FC<{
  state: FavoriteFilterState;
  onPress: () => void;
}> = ({ state, onPress }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const fill =
    state === 'favorite'
      ? colors.accent
      : state === 'not-favorite'
        ? colors.notification
        : colors.primary;
  const label =
    state === 'favorite'
      ? t('list_favorites_only')
      : state === 'not-favorite'
        ? t('list_favorites_not')
        : t('list_favorites_filter');
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.square, { backgroundColor: fill }]}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID="list-favorite-filter"
    >
      <Ionicons name={FAVORITE_ICON[state]} size={24} color={getOnColorForFill(colors, fill)} />
    </TouchableOpacity>
  );
};

export const SortDirectionButton: React.FC<{
  direction: 'asc' | 'desc';
  onPress: () => void;
}> = ({ direction, onPress }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.square, { backgroundColor: colors.primary }]}
      accessibilityRole="button"
      accessibilityLabel={
        direction === 'asc' ? t('list_sort_ascending') : t('list_sort_descending')
      }
      testID="list-sort-direction"
    >
      <Ionicons
        name={direction === 'asc' ? 'arrow-up' : 'arrow-down'}
        size={24}
        color={getOnColorForFill(colors, colors.primary)}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  filters: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 50,
    paddingHorizontal: 14,
    borderRadius: 5,
  },
  filtersLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  square: {
    width: 50,
    height: 50,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
