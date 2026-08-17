import { Ionicons } from '@expo/vector-icons';
import { DrawerActions } from '@react-navigation/native';
import React from 'react';
import { Pressable } from 'react-native';
import { useTheme } from '../../../../theme';
import { navigationButtonStyles } from '../navigationButtonStyles';

interface NavigationDrawerButtonProps {
  navigation: {
    dispatch: (action: ReturnType<typeof DrawerActions.toggleDrawer>) => void;
  };
}

/** Drawer toggle used by the web header when the current screen is a root screen. */
const NavigationDrawerButton: React.FC<NavigationDrawerButtonProps> = ({ navigation }) => {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Menu"
      hitSlop={8}
      onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())}
      style={navigationButtonStyles.button}
    >
      <Ionicons name="menu" size={28} color={colors.text} />
    </Pressable>
  );
};

export default NavigationDrawerButton;
