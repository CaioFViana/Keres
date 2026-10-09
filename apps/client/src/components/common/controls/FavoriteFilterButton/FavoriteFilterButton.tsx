import { Ionicons } from '@expo/vector-icons';
import { getOnColorForFill } from '@keres/shared';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../../../theme';
import type { FavoriteFilterState } from '../../../../types/entityFilters';

const ICON: Record<FavoriteFilterState, keyof typeof Ionicons.glyphMap> = {
  all: 'star-outline',
  favorite: 'star',
  'not-favorite': 'ban-outline',
};

interface FavoriteFilterButtonProps {
  state: FavoriteFilterState;
  /** Cycles all → favorites → not favorites; the caller owns the state. */
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * The favorites view toggle of a list and of Global Search.
 *
 * Every colour comes from the active theme. At rest it is a primary button like its neighbours.
 * Once it narrows the list it turns into a ringed `primaryContainer` button, so it stands out in
 * every palette (a gold or red primary included, where a gold or red fill would blend in): the
 * theme's `star` marks "favorites only" and `onPrimaryContainer` marks "not favorites".
 */
const FavoriteFilterButton: React.FC<FavoriteFilterButtonProps> = ({ state, onPress, style }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const active = state !== 'all';
  const fill = active ? colors.primaryContainer : colors.primary;
  const iconColor = !active
    ? getOnColorForFill(colors, colors.primary)
    : state === 'favorite'
      ? colors.star
      : colors.onPrimaryContainer;
  const label =
    state === 'favorite'
      ? t('list_favorites_only')
      : state === 'not-favorite'
        ? t('list_favorites_not')
        : t('list_favorites_filter');

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.button,
        { backgroundColor: fill, borderColor: active ? iconColor : 'transparent' },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID="list-favorite-filter"
    >
      <Ionicons name={ICON[state]} size={24} color={iconColor} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 50,
    height: 50,
    borderRadius: 5,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default FavoriteFilterButton;
