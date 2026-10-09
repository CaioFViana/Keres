import { getOnColorForFill } from '@keres/shared';
import React, { useMemo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Platform, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '../../../../theme';

/**
 * `primary` is the filled call to action; `secondary` and `danger` are outlined, for what is offered
 * next to it - so a row of choices does not read as a row of equally loud buttons.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'danger';

interface ButtonProps {
  variant?: ButtonVariant;
  onPress: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
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
    const outline = variant === 'secondary' ? colors.primary : colors.error;
    const outlined = variant !== 'primary';
    const base = {
      backgroundColor: outlined ? 'transparent' : colors.primary,
      ...(outlined ? { borderWidth: 1.5, borderColor: outline } : {}),
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
        color: outlined ? outline : getOnColorForFill(colors, background),
        fontSize: 16,
        fontWeight: 'bold',
      },
    });
  }, [colors, style, variant]);

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
