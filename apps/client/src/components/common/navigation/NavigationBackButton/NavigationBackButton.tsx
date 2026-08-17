import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';
import { useTheme } from '../../../../theme';
import { navigationButtonStyles } from '../navigationButtonStyles';

interface NavigationBackButtonProps {
  onPress: () => void;
}

/** Back affordance used in the web Drawer header for nested screens. */
const NavigationBackButton: React.FC<NavigationBackButtonProps> = ({ onPress }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <Pressable
      accessibilityLabel={t('go_back')}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={navigationButtonStyles.button}
    >
      <Ionicons name="arrow-back" size={24} color={colors.text} />
    </Pressable>
  );
};

export default NavigationBackButton;
