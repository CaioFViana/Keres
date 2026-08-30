import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';
import { useTheme } from '../../../../theme';
import { navigationButtonStyles } from '../navigationButtonStyles';

interface DrawerMenuButtonProps {
  onPress: () => void;
}

/** A menu affordance that stays available beside a nested screen's back button on narrow layouts. */
const DrawerMenuButton: React.FC<DrawerMenuButtonProps> = ({ onPress }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <Pressable
      accessibilityLabel={t('open_navigation_menu')}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={navigationButtonStyles.button}
      testID="drawer-menu-button"
    >
      <Ionicons name="menu" size={27} color={colors.text} />
    </Pressable>
  );
};

export default DrawerMenuButton;
