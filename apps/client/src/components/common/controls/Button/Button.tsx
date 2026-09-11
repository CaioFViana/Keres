import { getOnColorForFill } from '@keres/shared';
import React, { useMemo } from 'react';
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

  const styles = useMemo(() => {
    const base = {
      backgroundColor: colors.primary,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 8,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      ...(Platform.OS === 'web' ? { outlineWidth: 0, outlineColor: 'transparent' } : {}),
    };
    const flattened = StyleSheet.flatten([base, style]);
    const background =
      typeof flattened?.backgroundColor === 'string' ? flattened.backgroundColor : colors.primary;

    return StyleSheet.create({
      button: base,
      disabledButton: {
        opacity: 0.6,
      },
      buttonText: {
        color: getOnColorForFill(colors, background),
        fontSize: 16,
        fontWeight: 'bold',
      },
    });
  }, [colors, style]);

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
