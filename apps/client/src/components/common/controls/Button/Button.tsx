import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Platform, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '../../../../theme';

interface ButtonProps {
  onPress: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

const Button: React.FC<ButtonProps> = ({
  onPress,
  children,
  style,
  disabled,
  testID,
  accessibilityLabel,
  accessibilityHint,
}) => {
  const { colors } = useTheme();

  const styles = StyleSheet.create({
    button: {
      backgroundColor: colors.primary,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      ...(Platform.OS === 'web' ? { outlineWidth: 0, outlineColor: 'transparent' } : {}),
    },
    disabledButton: {
      opacity: 0.6,
    },
    buttonText: {
      color: colors.onPrimary,
      fontSize: 16,
      fontWeight: 'bold',
    },
  });

  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.disabledButton, style]}
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
    >
      {typeof children === 'string' ? <Text style={styles.buttonText}>{children}</Text> : children}
    </TouchableOpacity>
  );
};

export default Button;
