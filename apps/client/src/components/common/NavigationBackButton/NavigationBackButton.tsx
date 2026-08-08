import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../../theme';

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
      style={styles.button}
    >
      <Ionicons name="arrow-back" size={24} color={colors.text} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    minWidth: 36,
    minHeight: 36,
  },
});

export default NavigationBackButton;
