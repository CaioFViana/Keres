import { Ionicons } from '@expo/vector-icons';
import { DrawerActions } from '@react-navigation/native';
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../../../theme';

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
      style={styles.button}
    >
      <Ionicons name="menu" size={28} color={colors.text} />
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

export default NavigationDrawerButton;
